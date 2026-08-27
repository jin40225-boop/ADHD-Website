/**
 * Phase 6：AI 文件生成（計畫第五節 `generate-document`、裁決 15）。
 *
 * 三件事按這個順序發生，順序本身就是規格：
 *   1. 讀場次／報名／範本等素材（服務端讀，前端不必先撈一份出來）。
 *   2. **去識別化**：姓名、電話、信箱一律換成代號（〔家長1〕〔孩子1〕〔電話1〕〔信箱1〕…），
 *      判讀性內容照送。孩子姓名與家長姓名分開編碼，因為還原規則不同。
 *   3. 只把去識別化後的文字送給 Claude；回來的草稿**只還原家長姓名**，存成 draft 等人審。
 *      孩子姓名、電話、信箱都不還原——產出物裡寫〔孩子1〕就夠了。
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
/**
 * 代號對照表。`placeholders` 是送出前要換掉的全部真實字串；`restore` 只放**可以還原**的那些。
 * 兩者不對稱是刻意的：孩子姓名進 placeholders 但不進 restore——見 `buildRedaction`。
 */
interface Redaction { placeholders: Record<string, string>; restore: Record<string, string> }

const EMAIL_RE = /[\w.+-]+@[\w-]+\.[\w.-]+/g;
const PHONE_RE = /(?:\+886[-\s]?|0)\d{1,3}[-\s]?\d{3,4}[-\s]?\d{3,4}/g;

/** 表單裡會夾帶真實身分的欄位。孩子與家長分開收，因為還原規則不同。 */
const PARENT_NAME_KEYS = ['name', 'parentName', 'guardianName', 'contactName', 'displayName'];
const CHILD_NAME_KEYS = ['childName', 'childAlias'];
/** 舊報名沒有固定 schema，所以除了列舉的 key，也掃任何看起來像姓名欄位的鍵。 */
function looksLikeNameKey(key: string) { return /(^|_)name$/i.test(key) || key.includes('姓名') || key.includes('稱呼'); }

/**
 * 去識別化。姓名要逐一比對（它們不像信箱電話有形狀），所以先從素材裡收集已知姓名，
 * 由長到短替換——「林小明」必須先於「小明」被換掉，否則會留下半截真名。
 *
 * ⚠ **孩子姓名代號化後不還原。** 報名表那一欄寫的是「孩子姓名或代號」，實務上家長多半填真名，
 * 所以它就是兒少的真實姓名。家長姓名還原是因為草稿要寄給那位家長、信裡得有稱呼；
 * 孩子沒有這個需要——文件裡寫「〔孩子1〕」完全足夠，還原只是把兒少姓名重新寫回產出物。
 * 兩份對照表因此不對稱：孩子只進 placeholders，不進 restore。
 */
function buildRedaction(parentNames: string[], childNames: string[]): Redaction {
  const placeholders: Record<string, string> = {};
  const restore: Record<string, string> = {};
  const clean = (list: string[]) => [...new Set(list.map((n) => n.trim()).filter((n) => n.length >= 2))];
  const parents = clean(parentNames);
  // 孩子名若與某位家長同名，家長那條代號會先換掉它，這裡不重複建碼。
  const children = clean(childNames).filter((name) => !parents.includes(name));

  parents.forEach((name, index) => { const code = `〔家長${index + 1}〕`; placeholders[name] = code; restore[code] = name; });
  children.forEach((name, index) => { placeholders[name] = `〔孩子${index + 1}〕`; });

  // 由長到短排序後重建，確保「林小明」先於「小明」被替換。
  const ordered: Record<string, string> = {};
  for (const name of Object.keys(placeholders).sort((a, b) => b.length - a.length)) ordered[name] = placeholders[name];
  return { placeholders: ordered, restore };
}

/** 從一筆報名的 answers 收集身分字串。回傳 [家長姓名, 孩子姓名]。 */
function collectNames(answers: Row): [string[], string[]] {
  const parents: string[] = [];
  const children: string[] = [];
  for (const [key, value] of Object.entries(answers ?? {})) {
    if (typeof value === 'string' && value.trim()) {
      if (CHILD_NAME_KEYS.includes(key)) children.push(value);
      else if (PARENT_NAME_KEYS.includes(key) || looksLikeNameKey(key)) parents.push(value);
    }
  }
  // 新版表單的孩子是可增減的陣列，代號欄位是 `alias`。
  if (Array.isArray(answers?.children)) {
    for (const child of answers.children) {
      if (child && typeof child === 'object') {
        for (const key of ['alias', 'name', 'childName']) {
          const value = (child as Row)[key];
          if (typeof value === 'string' && value.trim()) children.push(value);
        }
      }
    }
  }
  return [parents, children];
}

function redact(text: string, redaction: Redaction) {
  let out = text;
  for (const [name, code] of Object.entries(redaction.placeholders)) out = out.replaceAll(name, code);
  let mail = 0; let phone = 0;
  out = out.replace(EMAIL_RE, () => { mail += 1; const code = `〔信箱${mail}〕`; return code; });
  out = out.replace(PHONE_RE, () => { phone += 1; const code = `〔電話${phone}〕`; return code; });
  return out;
}

/**
 * 草稿回來後把**家長**姓名代號換回真名。
 * 刻意不還原的三種：信箱、電話（AI 沒有理由自己寫出聯絡方式）、以及**孩子姓名**
 * （見 `buildRedaction`——文件裡寫〔孩子1〕就夠了，還原等於把兒少姓名寫回產出物）。
 */
function restoreNames(text: string, redaction: Redaction) {
  let out = text;
  for (const [code, name] of Object.entries(redaction.restore)) out = out.replaceAll(code, name);
  return out;
}

/**
 * 文件類型 → 提示詞。UI 的六個選項與這裡的六個新鍵**一對一**：先前六個選項壓成三個鍵，
 * 三個選項按下去產出的是同一份東西，等於選單有一半是裝飾。
 *
 * 舊四鍵（session_summary／attendance_sheet／followup_notes／monthly_report）保留不刪：
 * 既有 `generated_documents` 的 `doc_type` 還存著那四個值，拿掉它們只會讓歷史紀錄變成
 * 認不得的類型。它們不再出現在 UI，但仍可被直接呼叫。
 */
const DOC_PROMPTS: Record<string, string> = {
  // --- 舊四鍵：保留給既有紀錄，UI 已不再列出 ---
  session_summary: '請依提供的場次資料，撰寫一份給團隊內部使用的場次摘要：時間、主題、報名概況、需要注意的事項。',
  attendance_sheet: '請依提供的報名資料，整理一份簽到／出席確認清單的文字版，每位一行，含代號與時段。',
  followup_notes: '請依提供的往來摘要，整理每位報名者的後續追蹤重點，一人一段，標明待辦。',
  monthly_report: '請依提供的場次與報名資料，撰寫一份月度服務摘要，供對外報告使用。',
  // --- 03_v4 六型：與 UI 的六個選項一對一 ---
  monthly_notice: '請依提供的下月場次清單，撰寫一封寄給家長的月度活動宣傳與通知信：開頭一段說明這個月的主題方向，接著逐場列出時間與剩餘名額，最後一段說明怎麼報名。語氣親切、不誇大、不承諾療效。',
  pre_event_reminder: '請依提供的場次資料與報名名冊，撰寫一封寄給該場全部報名者的行前提醒信：時間、參加方式、需要事先準備的事、當天流程重點。名冊只是讓你理解這群人的處境，信裡不要逐一點名，也不要複述任何一位的個別狀況。',
  event_plan: '請依提供的場次資料，撰寫一份可對外提供的活動計畫書：活動名稱、辦理時間、對象與人數規模、主題與講者、目的與內容大綱、預期效益。這份文件會給合作單位看，不得出現任何個別報名者的資訊。',
  social_post: '請依提供的場次清單，撰寫一則 FB／網路宣傳短文：300 字以內、口語、有畫面感，開頭先講中家長的處境，結尾附一句明確的報名導流句。',
  annual_report: '請依提供的統計數字，撰寫一份年度成果彙整：辦理場次數、報名筆數、各服務線的辦理概況與觀察。只使用提供的數字，不得推估、不得補充未提供的成果。',
  custom: '請依「補充指示」描述的需求，使用下方資料撰寫文件。指示沒有提到的事實一律不要自行補上。',
};

/**
 * 這三型本質上就是跨場次的彙整，選單一場次對它們沒有意義——真的照著單一場次做，
 * 產出與 UI 上寫的類型就對不起來了。這裡一律忽略 `sessionId`，讓素材與落庫的
 * scope／target 永遠一致（UI 那邊同樣不讓這三型選場次）。
 */
const AGGREGATE_ONLY = ['monthly_notice', 'social_post', 'annual_report'];

/**
 * 議題欄。原本讀的是 `answers.topic ?? answers.question`——這兩個 key 在任何一份現行
 * form_schema 裡都不存在，所以這一欄從來只印得出「未填」。真正存在的是 `issueDesc`
 * （困擾議題簡述，親職／導航／職涯三份表單都有）與 `consultTopics`（可複選）。
 */
function issueText(answers: Row): string {
  const topics = answers?.consultTopics;
  const joined = Array.isArray(topics)
    ? topics.filter((item) => typeof item === 'string' && item.trim()).join('、')
    : typeof topics === 'string' ? topics : '';
  const candidates = [
    typeof answers?.issueDesc === 'string' ? answers.issueDesc : '',
    joined,
    typeof answers?.topic === 'string' ? answers.topic : '',
    typeof answers?.question === 'string' ? answers.question : '',
  ];
  return candidates.find((value) => value.trim())?.trim() ?? '未填';
}

/**
 * 孩子欄。舊平面 key 是 `childName`，新表單改成可增減的 `children[]`（代號欄位 `alias`）。
 * 原本只讀 `childName`，用新形狀報名的那些人整欄會直接消失。形狀判斷與 `collectNames`
 * 對齊——那邊已經在收 `children[].alias` 了，這裡沒理由讀不到。
 */
function childText(answers: Row): string {
  if (Array.isArray(answers?.children)) {
    const aliases = answers.children
      .filter((child: unknown) => child && typeof child === 'object')
      .map((child: Row) => child.alias)
      .filter((value: unknown): value is string => typeof value === 'string' && value.trim().length > 0)
      .map((value: string) => value.trim());
    if (aliases.length) return aliases.join('、');
  }
  return typeof answers?.childName === 'string' ? answers.childName.trim() : '';
}

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
    // 自訂需求沒有指示就無從產起：與其送一份「請依補充指示」但補充指示是空的提示詞過去，
    // 不如當場擋下來。擋在素材查詢之前，不白讀資料。
    if (docType === 'custom' && !instruction) return jsonResponse({ error: 'INSTRUCTION_REQUIRED' }, 400);

    // ---- 素材 ----------------------------------------------------------------
    const targetSessionId = AGGREGATE_ONLY.includes(docType) ? undefined : sessionId;
    // 沒指定場次就退回彙整素材，對這些類型是錯的產出而不是次好的產出：
    // 「該場全部報名者的行前提醒信」拿一份跨場次清單來寫，寫出來的信寄給誰都不對。
    // 寧可擋下來講清楚，也不要產一份看起來像成品的東西。
    if (!targetSessionId && !AGGREGATE_ONLY.includes(docType) && docType !== 'custom') {
      return jsonResponse({ error: 'SESSION_REQUIRED' }, 400);
    }
    const materials: string[] = [];
    const parentNames: string[] = [];
    const childNames: string[] = [];
    /** 彙整型文件的統計區間（例 `2025-09~2026-08`），同時當作落庫的 target_id。 */
    let rangeText = '';

    if (targetSessionId) {
      const { data: session } = await admin.from('sessions')
        .select('title, starts_at, ends_at, capacity, booked_count, topic, guest, description, projects(name, description)')
        .eq('id', targetSessionId).maybeSingle();
      if (session) {
        const project = ((session as Row).projects ?? null) as Row | null;
        materials.push([
          `場次：${session.title}`,
          `時間：${session.starts_at} ~ ${session.ends_at}`,
          `名額：${session.booked_count}/${session.capacity}`,
          `主題：${session.topic ?? '未定'}`,
          `來賓：${session.guest ?? '未定'}`,
          `場次介紹：${session.description ?? '未填'}`,
          `服務線：${project?.name ?? '未標示'}`,
          `服務線說明：${project?.description ?? '未填'}`,
        ].join('\n'));
      }
      if (docType === 'event_plan') {
        // 計畫書是給合作單位看的：只給得出「幾個人報名」，一位報名者的資料都不進素材。
        const { count } = await admin.from('registrations')
          .select('id', { count: 'exact', head: true })
          .contains('session_ids', [targetSessionId]);
        materials.push(`報名人數：${count ?? 0} 人（本類型不提供個別報名者資料）`);
      } else {
        const { data: regs } = await admin
          .from('registrations')
          .select('status, email, answers, contacts(display_name)')
          .contains('session_ids', [targetSessionId]);
        for (const reg of (regs ?? []) as Row[]) {
          const name = reg.contacts?.display_name ?? reg.answers?.name ?? '';
          if (name) parentNames.push(String(name));
          // 姓名一律先收集再整段替換，所以自由填答（議題、家庭型態…）裡出現的同一個名字也會一起被換掉。
          const [answerParents, answerChildren] = collectNames(reg.answers ?? {});
          parentNames.push(...answerParents);
          childNames.push(...answerChildren);
          const childNote = childText(reg.answers ?? {});
          const child = childNote ? `／孩子：${childNote}` : '';
          materials.push(`報名：${name}（${reg.status}）${child}\n議題：${issueText(reg.answers ?? {})}`);
        }
      }
    } else {
      // 沒有指定場次不再直接失敗——彙整型文件本來就沒有「單一場次」可選，
      // 舊版在這裡回 NO_MATERIAL，等於預設選項按下去必定錯。
      const now = new Date();
      // 場次時間是台北時間，用 UTC 切月會把 1 號早上的場次算進上個月。
      const TAIPEI = 8 * 60 * 60 * 1000;
      const monthStart = (offset: number) => {
        const local = new Date(now.getTime() + TAIPEI);
        return new Date(Date.UTC(local.getUTCFullYear(), local.getUTCMonth() + offset, 1) - TAIPEI);
      };
      const ym = (date: Date) => {
        const local = new Date(date.getTime() + TAIPEI);
        return `${local.getUTCFullYear()}-${String(local.getUTCMonth() + 1).padStart(2, '0')}`;
      };

      if (docType === 'annual_report') {
        const from = monthStart(-11);
        rangeText = `${ym(from)}~${ym(now)}`;
        const { data: rows } = await admin.from('sessions')
          .select('id, title, starts_at, project_id, projects(name)')
          .eq('status', 'done')
          .gte('starts_at', from.toISOString())
          .lte('starts_at', now.toISOString())
          .order('starts_at');
        const done = (rows ?? []) as Row[];
        if (done.length) {
          // 年度彙整只送統計。報名這裡只讀 project_id 一欄——answers 一個字都不讀，
          // 因為成果報告用不到任何一位報名者的內容，讀了就是白白把個資送進提示詞。
          const { data: regRows } = await admin.from('registrations')
            .select('project_id')
            .overlaps('session_ids', done.map((row) => String(row.id)));
          const regs = (regRows ?? []) as Row[];
          const perProject = new Map<string, { name: string; sessions: number; regs: number }>();
          for (const row of done) {
            const key = String(row.project_id);
            const entry = perProject.get(key) ?? { name: String((row.projects as Row | null)?.name ?? '未標示'), sessions: 0, regs: 0 };
            entry.sessions += 1;
            perProject.set(key, entry);
          }
          for (const reg of regs) {
            const entry = perProject.get(String(reg.project_id));
            if (entry) entry.regs += 1;
          }
          materials.push(`統計期間：${rangeText}\n完成場次總數：${done.length} 場\n報名總筆數：${regs.length} 筆`);
          for (const entry of perProject.values()) {
            materials.push(`服務線：${entry.name}\n完成場次：${entry.sessions} 場\n報名筆數：${entry.regs} 筆`);
          }
          materials.push(`已完成場次清單：\n${done.map((row) => `・${String(row.starts_at).slice(0, 10)}　${row.title}`).join('\n')}`);
        }
      } else {
        // monthly_notice／social_post 看下個月；custom 沒指定場次時看本月起半年。
        const span = docType === 'custom' ? { from: 0, to: 6 } : { from: 1, to: 2 };
        const from = monthStart(span.from);
        const to = monthStart(span.to);
        rangeText = `${ym(from)}~${ym(monthStart(span.to - 1))}`;
        const { data: rows } = await admin.from('sessions')
          .select('title, starts_at, capacity, booked_count, project_id, projects(name, description)')
          .in('status', ['open', 'full'])
          .gte('starts_at', from.toISOString())
          .lt('starts_at', to.toISOString())
          .order('starts_at');
        const upcoming = (rows ?? []) as Row[];
        const seen = new Set<string>();
        for (const row of upcoming) {
          const project = (row.projects ?? null) as Row | null;
          const key = String(row.project_id);
          if (project && !seen.has(key)) {
            seen.add(key);
            materials.push(`服務線：${project.name}\n說明：${project.description ?? '未填'}`);
          }
        }
        for (const row of upcoming) {
          const left = Math.max(Number(row.capacity ?? 0) - Number(row.booked_count ?? 0), 0);
          materials.push(`場次：${row.title}\n時間：${row.starts_at}\n剩餘名額：${left}`);
        }
      }
    }
    if (!materials.length) return jsonResponse({ error: 'NO_MATERIAL' }, 400);

    const redaction = buildRedaction(parentNames, childNames);
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
        redactedChildren: Object.keys(redaction.placeholders).length - Object.keys(redaction.restore).length,
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
      // SDK 0.68.0 的型別還沒有 `output_config`（Opus 5 的 effort 參數），但 API 收得下。
      // 用斷言放行而不是刪掉它——刪掉會靜默改變送出的參數，那不是型別問題該付的代價。
    } as Anthropic.MessageCreateParamsNonStreaming);

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
      // 舊版不論素材是什麼都寫 'single'，於是彙整型文件在紀錄裡看起來像是某一場的文件，
      // 而「範圍」欄根本查不到那一場。scope 一律跟著素材走。
      scope: targetSessionId ? 'single' : 'aggregate',
      target_type: targetSessionId ? 'session' : 'range',
      target_id: targetSessionId ?? rangeText,
      title: `${docType}｜${new Date().toISOString().slice(0, 10)}`,
      content,
      status: 'draft',
      redacted: true,
      created_by: auth.user.id,
    }).select('id, title, content, status, created_at').single();
    if (error) throw new Error(error.message);

    return jsonResponse({ document: saved, redactedNames: Object.keys(redaction.placeholders).length, redactedChildren: Object.keys(redaction.placeholders).length - Object.keys(redaction.restore).length, usage: { input: message.usage.input_tokens, output: message.usage.output_tokens } });
  } catch (err) {
    const message = err instanceof Error ? err.message : '文件生成失敗';
    return jsonResponse({ error: scrubSecrets(message) }, 500);
  }
});
