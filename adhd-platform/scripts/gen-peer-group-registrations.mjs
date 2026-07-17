/**
 * 互助聚會歷史資料遷移：Google 表單「【報名表】115年度成人ADHD線上互助聚會」67 筆回覆 → registrations migration。
 * 用法：node scripts/gen-peer-group-registrations.mjs
 * 【CLAUDE 專屬】輸入：scripts/peer-group-responses.private.csv（回覆試算表下載的 CSV，gitignored）。
 * 輸出：supabase/migrations/20260717000002_peer_group_google_form_registrations.sql（含個資，需加入 .gitignore）。
 * id＝md5(時間戳記+稱呼) 轉 UUID 格式（天然冪等鍵）；on conflict do nothing——重跑不覆蓋後台人工調整。
 * session_ids 留空（額滿觸發器只放行 open 場次）；勾選場次記於 answers.preferredSlots，
 * 對映的場次 UUID 記於 answers.sessionRefs（供日後串接）。
 */
import { createHash } from 'node:crypto';
import { readFileSync, writeFileSync } from 'node:fs';
import { resolve, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';

const root = resolve(dirname(fileURLToPath(import.meta.url)), '..');
const input = resolve(root, 'scripts/peer-group-responses.private.csv');
const PROJECT_ID = 'a1000000-0000-4000-8000-000000000001';

// 場次選項（表單原文，含歷史變體）→ sessions 固定 UUID（migration 20260717000001）
const SESSION_REF = [
  { match: /3月場/, id: 'b1150000-0000-4000-8000-000000000003' },
  { match: /4月場/, id: 'b1150000-0000-4000-8000-000000000004' },
  { match: /5月場/, id: 'b1150000-0000-4000-8000-000000000005' },
  { match: /6月場/, id: 'b1150000-0000-4000-8000-000000000006' },
  { match: /7月場/, id: 'b1150000-0000-4000-8000-000000000007' },
];

/** 最小 RFC4180 解析（Google 表單匯出：逗號分隔、雙引號跳脫、\r\n）。 */
function parseCsv(text) {
  const rows = [];
  let row = [], cell = '', inQuotes = false;
  for (let i = 0; i < text.length; i++) {
    const ch = text[i];
    if (inQuotes) {
      if (ch === '"') {
        if (text[i + 1] === '"') { cell += '"'; i++; } else inQuotes = false;
      } else cell += ch;
    } else if (ch === '"') inQuotes = true;
    else if (ch === ',') { row.push(cell); cell = ''; }
    else if (ch === '\n' || ch === '\r') {
      if (ch === '\r' && text[i + 1] === '\n') i++;
      row.push(cell); cell = '';
      if (row.some((c) => c !== '')) rows.push(row);
      row = [];
    } else cell += ch;
  }
  if (cell !== '' || row.length) { row.push(cell); if (row.some((c) => c !== '')) rows.push(row); }
  return rows;
}

/** Google 表單中文時間戳記（例：2026/3/2 下午 1:59:31）→ ISO（Asia/Taipei）。 */
function parseTimestamp(raw) {
  const m = raw.trim().match(/^(\d{4})\/(\d{1,2})\/(\d{1,2})\s*(上午|下午)?\s*(\d{1,2}):(\d{2}):(\d{2})$/);
  if (!m) throw new Error(`無法解析時間戳記「${raw}」`);
  let hour = Number(m[5]);
  if (m[4] === '下午' && hour < 12) hour += 12;
  if (m[4] === '上午' && hour === 12) hour = 0;
  const pad = (n) => String(n).padStart(2, '0');
  return `${m[1]}-${pad(m[2])}-${pad(m[3])} ${pad(hour)}:${m[6]}:${m[7]}+08`;
}

/** 內容雜湊 → UUID 格式冪等鍵。 */
function contentUuid(...parts) {
  const h = createHash('md5').update(parts.join('|')).digest('hex');
  return `${h.slice(0, 8)}-${h.slice(8, 12)}-${h.slice(12, 16)}-${h.slice(16, 20)}-${h.slice(20, 32)}`;
}

const q = (s) => `'${String(s).replaceAll("'", "''")}'`;
const jsonb = (obj) => `${q(JSON.stringify(obj))}::jsonb`;

const csv = parseCsv(readFileSync(input, 'utf8').replace(/^﻿/, ''));
const header = csv[0];
const col = (kw) => header.findIndex((h) => h.includes(kw));
const iTs = col('時間戳記');
const iName = col('稱呼');
const iEmail = col('電子信箱');
const iSessions = col('場次');
if (iTs < 0 || iName < 0 || iSessions < 0) {
  throw new Error(`表頭對不上：${JSON.stringify(header)}——請確認 CSV 為回覆試算表原始匯出`);
}

const rows = [];
for (const r of csv.slice(1)) {
  const name = (r[iName] ?? '').trim();
  const email = (r[iEmail] ?? '').trim();
  const createdAt = parseTimestamp(r[iTs]);
  // Google 表單複選以「, 」串接；選項文字不含 ASCII 逗號，安全切分
  const slots = (r[iSessions] ?? '')
    .split(', ')
    .map((s) => s.replace(/\s*\(已過\)\s*$/, '').trim())
    .filter(Boolean);
  const sessionRefs = slots
    .map((s) => SESSION_REF.find((ref) => ref.match.test(s))?.id)
    .filter(Boolean);
  const answers = {
    name,
    nickname: name,
    preferredSlots: slots,
    sessionRefs,
    migrationSource: 'google-form:115年度成人ADHD線上互助聚會',
  };
  if (email) answers.email = email;
  rows.push(
    `(${q(contentUuid(r[iTs], name, email))},${q(PROJECT_ID)},'{}'::uuid[],${jsonb(answers)},'success',${q(email)},${q(createdAt)})`,
  );
}

const sql = `-- ============================================================================
-- 互助聚會歷史報名遷移（Google 表單 ${rows.length} 筆回覆）
-- 由 scripts/gen-peer-group-registrations.mjs 產生，勿手改；含個資，絕不進公開 repo。
-- id＝內容雜湊（冪等）；on conflict do nothing（不覆蓋後台人工調整）。
-- ============================================================================

insert into public.registrations
  (id, project_id, session_ids, answers, status, email, created_at)
values
${rows.join(',\n')}
on conflict (id) do nothing;
`;

const out = resolve(root, 'supabase/migrations/20260717000002_peer_group_google_form_registrations.sql');
writeFileSync(out, sql, 'utf8');
console.log(`written: ${out}\n  rows: ${rows.length}`);
