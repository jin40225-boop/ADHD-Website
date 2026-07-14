/**
 * 由 src/data/recommendations.json（公開資料）產生推薦資料庫種子 migration。
 * 用法：node scripts/gen-recommendations-migration.mjs
 * 【CLAUDE 專屬】K1 輔助腳本；資料更新後可重跑覆蓋。
 */
import { readFileSync, writeFileSync } from 'node:fs';
import { resolve, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';

const root = resolve(dirname(fileURLToPath(import.meta.url)), '..');
const data = JSON.parse(readFileSync(resolve(root, 'src/data/recommendations.json'), 'utf8'));

const q = (s) => (s === undefined || s === null ? 'null' : `'${String(s).replaceAll("'", "''")}'`);
const arr = (a) =>
  !a || a.length === 0
    ? "'{}'::text[]"
    : `array[${a.map((u) => q(u)).join(',')}]::text[]`;

const rows = data.map((r) =>
  `(${q(r.id)},${q(r.category)},${q(r.audience)},${q(r.region)},${q(r.hospital ?? '')},` +
  `${q(r.doctorOrName ?? '')},${arr(r.urls)},${q(r.experience ?? '')},${q(r.recommender)},` +
  `${r.verified ? 'true' : 'false'},${q(r.verifiedNote)},${r.updatedAt ? q(r.updatedAt) : 'null'})`,
);

const sql = `-- ============================================================================
-- ADHD 專管系統 K1 種子：就醫推薦資料庫 ${data.length} 筆（公開資料）
-- 由 scripts/gen-recommendations-migration.mjs 自 src/data/recommendations.json 產生，勿手改。
-- ============================================================================

insert into public.recommendations
  (id, category, audience, region, hospital, doctor_or_name, urls, experience, recommender, verified, verified_note, updated_at)
values
${rows.join(',\n')}
on conflict (id) do update set
  category = excluded.category,
  audience = excluded.audience,
  region = excluded.region,
  hospital = excluded.hospital,
  doctor_or_name = excluded.doctor_or_name,
  urls = excluded.urls,
  experience = excluded.experience,
  recommender = excluded.recommender,
  verified = excluded.verified,
  verified_note = excluded.verified_note,
  updated_at = excluded.updated_at;
`;

const out = resolve(root, 'supabase/migrations/20260712000003_seed_recommendations.sql');
writeFileSync(out, sql, 'utf8');
console.log(`written: ${out} (${data.length} rows)`);
