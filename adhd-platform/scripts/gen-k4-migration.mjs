/**
 * K4 歷史資料遷移：Notion 備份三個報名資料庫 → registrations migration。
 * 用法：node scripts/gen-k4-migration.mjs
 * 【CLAUDE 專屬】讀 ../Notion完整備份_2026-07-11 的原始 JSON（非 CSV，保留欄位型別），
 * 以 notion_page_id 為 registrations.id（天然冪等鍵）；on conflict do nothing——
 * 重跑不會覆蓋後台已人工調整的狀態。
 */
import { readFileSync, writeFileSync } from 'node:fs';
import { resolve, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';

const root = resolve(dirname(fileURLToPath(import.meta.url)), '..');
const backup = resolve(root, '..', 'Notion完整備份_2026-07-11');

const PROJECT = {
  navigator: 'a1000000-0000-4000-8000-000000000002',
  parent: 'a1000000-0000-4000-8000-000000000003',
};

// user 裁示（2026-07-13）：測試資料不遷——導航「宋致靜」、2025 舊表「彥宇ㄉ媽」
const EXCLUDE = new Set([
  '31b8b808-4dad-81df-b9a8-fc70727b5826',
  '2088b808-4dad-8184-a404-d8a0fdf00ca9',
]);

// Notion 欄位值 → 純字串／字串陣列（answers 只允許 string | string[]）
function notionValue(prop) {
  if (!prop) return undefined;
  switch (prop.type) {
    case 'title':
      return prop.title.map((t) => t.plain_text).join('') || undefined;
    case 'rich_text':
      return prop.rich_text.map((t) => t.plain_text).join('') || undefined;
    case 'email':
      return prop.email ?? undefined;
    case 'phone_number':
      return prop.phone_number ?? undefined;
    case 'select':
      return prop.select?.name ?? undefined;
    case 'status':
      return prop.status?.name ?? undefined;
    case 'multi_select':
      return prop.multi_select.length ? prop.multi_select.map((o) => o.name) : undefined;
    case 'checkbox':
      return prop.checkbox ? '是' : '否';
    case 'created_time':
      return prop.created_time;
    case 'date':
      return prop.date?.start ?? undefined;
    case 'number':
      return prop.number === null || prop.number === undefined ? undefined : String(prop.number);
    case 'url':
      return prop.url ?? undefined;
    default:
      return undefined;
  }
}

// 「額滿」標記（全形/半形括號混用）是 Notion 選項的視覺註記，非資料本體
const stripFull = (v) =>
  v === undefined
    ? undefined
    : Array.isArray(v)
      ? v.map((s) => s.replace(/[（(]額滿[）)]/g, '').trim())
      : v.replace(/[（(]額滿[）)]/g, '').trim();

function buildAnswers(row, mapping) {
  const answers = {};
  for (const [notionName, spec] of Object.entries(mapping)) {
    const { key, strip } = typeof spec === 'string' ? { key: spec, strip: false } : spec;
    let v = notionValue(row.properties[notionName]);
    if (strip) v = stripFull(v);
    if (v !== undefined && v !== '') answers[key] = v;
  }
  answers.notionPageId = row.id;
  return answers;
}

function mapStatus(raw, table, dbLabel, rowTitle) {
  const mapped = table[raw ?? ''];
  if (!mapped) throw new Error(`未知審核狀態「${raw}」（${dbLabel}：${rowTitle}）——請先補 status 對映表`);
  return mapped;
}

const q = (s) => `'${String(s).replaceAll("'", "''")}'`;
const jsonb = (obj) => `${q(JSON.stringify(obj))}::jsonb`;

const rows = [];
const tally = [];

function migrate(file, { project, source, statusProp, statusMap, createdProp, mapping }) {
  const { rows: data } = JSON.parse(readFileSync(resolve(backup, file), 'utf8'));
  let excluded = 0;
  for (const row of data) {
    if (EXCLUDE.has(row.id)) {
      excluded++;
      continue;
    }
    const answers = buildAnswers(row, mapping);
    answers.migrationSource = source;
    // 審核台卡片以 answers.name 顯示——parent 兩表無 name 欄，補顯示用鍵
    if (!answers.name) answers.name = answers.childName ?? answers.parentName ?? '';
    const status = mapStatus(notionValue(row.properties[statusProp]), statusMap, source, answers.name ?? answers.childName);
    const createdAt = (createdProp && notionValue(row.properties[createdProp])) || row.created_time;
    rows.push(
      `(${q(row.id)},${q(PROJECT[project])},'{}'::uuid[],${jsonb(answers)},${q(status)},${q(answers.email ?? '')},${q(createdAt)})`,
    );
  }
  tally.push({ source, count: data.length - excluded, excluded });
  return data.length - excluded;
}

// 1. 導航計畫心理師諮詢報名（8 筆）→ navigator
migrate('資料庫_導航計畫心理師諮詢報名.json', {
  project: 'navigator',
  source: 'notion:導航計畫心理師諮詢報名',
  statusProp: '審核狀態',
  statusMap: { 報名成功: 'success', 退回: 'rejected', '報名未成功/候補': 'waitlist' },
  createdProp: '系統建檔時間',
  mapping: {
    姓名: 'name',
    電子信箱: 'email',
    性別: 'gender',
    年齡: 'age',
    職業: 'occupation',
    'ADHD 確診史': 'adhdHistory',
    欲諮詢的困擾議題簡述: 'issueDesc',
    聯繫電話: 'phone',
    報名月份: { key: 'registerMonth', strip: true },
    勾選可配合時段: { key: 'preferredSlots', strip: true },
    最終確定時段: 'finalSlot',
    諮商師回覆確認: 'counselorConfirmed',
    已寄信提醒: 'reminderSent',
    摘要: 'summary',
  },
});

// 2. 家長諮詢服務報名（13 筆，2026 現行表）→ parent
migrate('資料庫_家長諮詢服務報名.json', {
  project: 'parent',
  source: 'notion:家長諮詢服務報名',
  statusProp: '審核狀態',
  statusMap: { 報名成功: 'success', 已回絕: 'rejected' },
  createdProp: '系統建檔時間',
  mapping: {
    孩子姓名或代號: 'childName',
    報名家長姓名: 'parentName',
    與孩子的關係: 'relationship',
    電子信箱: 'email',
    聯繫手機號碼: 'phone',
    孩子性別: 'childGender',
    孩子年齡: 'childAge',
    '孩子年級/就學狀況': 'childGrade',
    家中組成描述: 'familyDesc',
    孩子目前狀況: 'childStatus',
    欲諮詢的困擾議題簡述: 'issueDesc',
    欲報名場次與時段: { key: 'preferredSlots', strip: true },
    留言: 'note',
    最終確定時段: 'finalSlot',
    報名月份: { key: 'registerMonth', strip: true },
    轉介諮商師回覆確認: 'counselorConfirmed',
    已寄信提醒: 'reminderSent',
    摘要: 'summary',
  },
});

// 3. 家長諮詢服務報名表_第二資料庫（6 筆，2025 舊表；欄位對映現行 schema，對不上的保留原名語意鍵）
migrate('家長諮詢服務報名表_第二資料庫/ADHD家長諮詢服務報名表.json', {
  project: 'parent',
  source: 'notion:2025家長諮詢服務報名表（第二資料庫）',
  statusProp: '處理狀態',
  statusMap: { 待處理: 'pending', 已聯繫: 'confirming', 已完成: 'success', 已取消: 'rejected' },
  createdProp: null,
  mapping: {
    家長代號: 'parentName',
    孩子姓名: 'childName',
    電子郵件: 'email',
    '聯絡電話或LINE ID': 'phone',
    孩子年齡: 'childAge',
    是否已有診斷ADHD: 'childStatus',
    詳細問題描述: 'issueDesc',
    主要諮詢問題: 'consultTopics',
    諮詢日期: 'consultDate',
    偏好諮詢日期: 'preferredDate',
    日期: 'confirmedDate',
    諮詢時間: 'consultTime',
    諮詢方式: 'consultMethod',
    '上述時間均無法，希望另約時間': 'altTime',
  },
});

const sql = `-- ============================================================================
-- ADHD 專管系統 K4：Notion 歷史報名資料遷移（${rows.length} 筆）
-- 由 scripts/gen-k4-migration.mjs 自 Notion完整備份_2026-07-11 原始 JSON 產生，勿手改。
-- id＝notion_page_id（冪等）；on conflict do nothing（不覆蓋後台人工調整）。
-- 對帳：${tally.map((t) => `${t.source}=${t.count}${t.excluded ? `（另排除測試 ${t.excluded} 筆）` : ''}`).join('、')}
-- ============================================================================

insert into public.registrations
  (id, project_id, session_ids, answers, status, email, created_at)
values
${rows.join(',\n')}
on conflict (id) do nothing;
`;

const out = resolve(root, 'supabase/migrations/20260713000001_k4_notion_registrations.sql');
writeFileSync(out, sql, 'utf8');
console.log(`written: ${out}`);
for (const t of tally) console.log(`  ${t.source}: ${t.count} rows${t.excluded ? ` (excluded ${t.excluded})` : ''}`);
console.log(`  total: ${rows.length}`);
