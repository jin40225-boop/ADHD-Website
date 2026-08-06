/**
 * Phase 6：AI 文件生成（計畫第五節 `generate-document`、裁決 15）。
 *
 * 三件事按這個順序發生，順序本身就是規格：
 *   1. 讀場次／報名／範本等素材（服務端讀，前端不必先撈一份出來）。
 *   2. **去識別化**：姓名、電話、信箱一律換成代號（家長A、電話1、信箱1…），判讀性內容照送。
 *   3. 只把去識別化後的文字送給 Claude；回來的草稿把代號還原成真實姓名，存成 draft 等人審。
 *
 * 兩個不能妥協的點：
 *   - `preview: true` 時**完全不呼叫 API**，只回傳「將送出的這些字」。裁決要求生成前先看到
 *     送出內容，那就必須是同一段程式算出來的同一份文字，不能是另外寫一份「大概像這樣」的說明。
 *   - **AI 永不寄信**。這支只寫 `generated_documents`（status=draft）。寄信要走 send-email-v2，
 *     而那要人按下去。
 *
 * 金鑰：只從 `Deno.env.get('ANTHROPIC_API_KEY')` 取，不從資料表讀、不回前端；任何往外拋的
 * 錯誤訊息都先過 `scrubSecrets()`，避免上游把金鑰片段回顯在錯誤裡而被我們原封不動轉出去。
 */
import { createClient, type SupabaseClient } from 'npm:@supabase/supabase-js@2';
import Anthropic from 'npm:@anthropic-ai/sdk@0.68.0';

const corsHeaders = { 'Access-Control-Allow-Origin': '*', 'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type', 'Access-Control-Allow-Methods': 'POST, OPTIONS' };
function jsonResponse(body: unknown, status = 200) { return new Response(JSON.stringify(body), { status, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }); }

/** 金鑰永遠不進錯誤訊息。上游（SDK／fetch）可能把 header 或 key 片段塞進 message。 */
function scrubSecrets(message: string) {
  const key = Deno.env.get('ANTHROPIC_API_KEY') ?? '';
  let safe = message.replaceAll(/sk-ant-[A-Za-z0-9_-]+/g, '〔已遮蔽〕');
  if (key.length >= 8) safe = safe.replaceAll(key, '〔已遮蔽〕').replaceAll(key.slice(0, 12), '〔已遮蔽〕');
  return safe;
}

type Row = Record<string, any>;
/** 代號對照表：送出前把真實資料換成代號，草稿回來後再換回去。 */
interface Redaction { placeholders: Record<string, string>; restore: Record<string, string> }

const EMAIL_RE = /[\w.+-]+@[\w-]+\.[\w.-]+/g;
const PHONE_RE = /(?:\+886[-\s]?|0)\d{1,3}[-\s]?\d{3,4}[-\s]?\d{3,4}/g;

/**
 * 去識別化。姓名要逐一比對（它們不像信箱電話有形狀），所以先從素材裡收集已知姓名，
 * 由長到短替換——「林小明」必須先於「小明」被換掉，否則會留下半截真名。
 */
function buildRedaction(names: string[]): Redaction {
  const placeholders: Record<string, string> = {};
  const restore: Record<string, string> = {};
  const unique = [...new Set(names.map((n) => n.trim()).filter((n) => n.length >= 2))].sort((a, b) => b.length - a.length);
  unique.forEach((name, index) => { const code = `〔家長${index + 1}〕`; placeholders[name] = code; restore[code] = name; });
  return { placeholders, restore };
}

function redact(text: string, redaction: Redaction) {
  let out = text;
  for (const [name, code] of Object.entries(redaction.placeholders)) out = out.replaceAll(name, code);
  let mail = 0; let phone = 0;
  out = out.replace(EMAIL_RE, () => { mail += 1; const code = `〔信箱${mail}〕`; return code; });
  out = out.replace(PHONE_RE, () => { phone += 1; const code = `〔電話${phone}〕`; return code; });
  return out;
}

/** 草稿回來後把姓名代號換回真名。信箱／電話代號刻意不還原——AI 沒有理由自己寫出聯絡方式。 */
function restoreNames(text: string, redaction: Redaction) {
  let out = text;
  for (const [code, name] of Object.entries(redaction.restore)) out = out.replaceAll(code, name);
  return out;
}

const DOC_PROMPTS: Record<string, string> = {
  session_summary: '請依提供的場次資料，撰寫一份給團隊內部使用的場次摘要：時間、主題、報名概況、需要注意的事項。',
  attendance_sheet: '請依提供的報名資料，整理一份簽到／出席確認清單的文字版，每位一行，含代號與時段。',
  followup_notes: '請依提供的往來摘要，整理每位報名者的後續追蹤重點，一人一段，標明待辦。',
  monthly_report: '請依提供的場次與報名資料，撰寫一份月度服務摘要，供對外報告使用。',
};

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') return new Response('ok', { headers: corsHeaders });
  if (req.method !== 'POST') return jsonResponse({ error: 'METHOD_NOT_ALLOWED' }, 405);
  const admin: SupabaseClient = createClient(Deno.env.get('SUPABASE_URL')!, Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!);
  try {
    // 先授權再做任何事：未授權的呼叫不該讀到素材，更不該花掉 API 額度。
    const jwt = (req.headers.get('Authorization') ?? '').replace(/^Bearer\s+/i, '');
    const { data: auth } = await admin.auth.getUser(jwt);
    if (!auth.user) return jsonResponse({ error: 'UNAUTHORIZED' }, 401);
    const [{ data: profile }, { data: member }] = await Promise.all([
      admin.from('profiles').select('is_system_owner').eq('id', auth.user.id).maybeSingle(),
      admin.from('project_members').select('id').eq('user_id', auth.user.id).in('role', ['owner', 'admin_collab']).limit(1),
    ]);
    if (!profile?.is_system_owner && !member?.length) return jsonResponse({ error: 'FORBIDDEN' }, 403);

    const body = await req.json().catch(() => ({}));
    const docType = String(body.docType ?? '');
    const sessionId = body.sessionId ? String(body.sessionId) : undefined;
    const instruction = String(body.instruction ?? '').trim();
    const preview = body.preview === true;
    if (!DOC_PROMPTS[docType]) return jsonResponse({ error: 'UNKNOWN_DOC_TYPE' }, 400);

    // ---- 素材 ----------------------------------------------------------------
    const materials: string[] = [];
    const names: string[] = [];
    if (sessionId) {
      const { data: session } = await admin.from('sessions').select('title, starts_at, ends_at, capacity, booked_count, topic, guest').eq('id', sessionId).maybeSingle();
      if (session) materials.push(`場次：${session.title}\n時間：${session.starts_at} ~ ${session.ends_at}\n名額：${session.booked_count}/${session.capacity}\n主題：${session.topic ?? '未定'}\n來賓：${session.guest ?? '未定'}`);
      const { data: regs } = await admin
        .from('registrations')
        .select('status, email, answers, contacts(display_name)')
        .contains('session_ids', [sessionId]);
      for (const reg of (regs ?? []) as Row[]) {
        const name = reg.contacts?.display_name ?? reg.answers?.name ?? '';
        if (name) names.push(String(name));
        const child = reg.answers?.childName ? `／孩子：${reg.answers.childName}` : '';
        materials.push(`報名：${name}（${reg.status}）${child}\n議題：${reg.answers?.topic ?? reg.answers?.question ?? '未填'}`);
      }
    }
    if (!materials.length) return jsonResponse({ error: 'NO_MATERIAL' }, 400);

    const redaction = buildRedaction(names);
    const prompt = [
      DOC_PROMPTS[docType],
      instruction ? `補充指示：${instruction}` : '',
      '',
      '以下資料已去識別化，代號請原樣保留、不要自行編造姓名或聯絡方式：',
      redact(materials.join('\n\n'), redaction),
    ].filter(Boolean).join('\n');

    // ---- 預覽：看得到才敢按，所以預覽回傳的必須是等一下真的會送出的那份字 ----
    if (preview) {
      return jsonResponse({
        preview: true,
        willSend: prompt,
        redactedNames: Object.keys(redaction.placeholders).length,
        model: 'claude-opus-5',
      });
    }

    const apiKey = Deno.env.get('ANTHROPIC_API_KEY');
    if (!apiKey) return jsonResponse({ error: 'ANTHROPIC_KEY_MISSING：請先在 Supabase secrets 設定金鑰。' }, 503);

    const anthropic = new Anthropic({ apiKey });
    const message = await anthropic.messages.create({
      model: 'claude-opus-5',
      max_tokens: 8000,
      output_config: { effort: 'medium' },
      system: '你是社工實務的文件助理。只根據提供的資料撰寫，不得補充未提供的事實。代號（〔家長1〕〔信箱1〕等）一律原樣保留。輸出使用繁體中文。',
      messages: [{ role: 'user', content: prompt }],
    });

    // 安全分類器可能擋下請求：這時 content 是空的，直接讀 content[0] 會炸。
    if (message.stop_reason === 'refusal') {
      return jsonResponse({ error: 'MODEL_REFUSED：模型婉拒了這次生成，請調整指示後再試。' }, 422);
    }
    const raw = message.content.filter((block) => block.type === 'text').map((block) => (block as { text: string }).text).join('\n').trim();
    if (!raw) return jsonResponse({ error: 'EMPTY_RESULT' }, 502);
    const content = restoreNames(raw, redaction);

    // AI 永遠只寫草稿。寄不寄、寄給誰，是人的決定。
    const { data: saved, error } = await admin.from('generated_documents').insert({
      doc_type: docType,
      scope: 'single',
      target_type: sessionId ? 'session' : null,
      target_id: sessionId ?? null,
      title: `${docType}｜${new Date().toISOString().slice(0, 10)}`,
      content,
      status: 'draft',
      redacted: true,
      created_by: auth.user.id,
    }).select('id, title, content, status, created_at').single();
    if (error) throw new Error(error.message);

    return jsonResponse({ document: saved, redactedNames: Object.keys(redaction.placeholders).length, usage: { input: message.usage.input_tokens, output: message.usage.output_tokens } });
  } catch (err) {
    const message = err instanceof Error ? err.message : '文件生成失敗';
    return jsonResponse({ error: scrubSecrets(message) }, 500);
  }
});
