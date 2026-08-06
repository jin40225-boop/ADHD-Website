/**
 * 全 src 靜默失敗體檢：會寫入資料庫、但失敗時使用者看不到任何反應的呼叫點。
 *
 * 第 1 段：從各 api 層找出真的會寫入的匯出函式（insert/update/delete/upsert/rpc/functions.invoke）。
 * 第 2 段：掃四種呼叫模式——
 *   a. 具名 async 箭頭函式 / function 宣告
 *   b. JSX 內的匿名 async 處理函式
 *   c. `void f(...)` 與 `f(...).then(...)`：沒有 .catch 就是沒人接
 *   d. useEffect 內的非同步寫入
 *
 * 判準：await 了會寫入的函式，卻沒有 try/catch 或 .catch。
 * 誤報會標示出來（例如包在一個自己有 try/catch 的 runner 裡），但一律列出、不自行剔除。
 */
import { readFileSync, readdirSync } from 'node:fs';
import { resolve } from 'node:path';

const root = process.env.AUDIT_ROOT ?? resolve(import.meta.dirname, '..');
const walk = (dir) => readdirSync(resolve(root, dir), { withFileTypes: true }).flatMap((e) =>
  e.isDirectory() ? walk(`${dir}/${e.name}`) : /\.tsx?$/.test(e.name) ? [`${dir}/${e.name}`] : []);
const files = walk('src');

const sliceBody = (src, from) => {
  const open = src.indexOf('{', from);
  if (open === -1) return '';
  let depth = 0;
  for (let i = open; i < src.length; i += 1) {
    if (src[i] === '{') depth += 1;
    else if (src[i] === '}') { depth -= 1; if (depth === 0) return src.slice(open, i + 1); }
  }
  return src.slice(open);
};
const WRITES = /\.(insert|update|delete|upsert)\(|\.rpc\(|functions\.invoke\(|storage\.from\([^)]*\)\.(remove|upload)\(/;

// 第 1 段
const writers = new Set();
for (const file of files) {
  const src = readFileSync(resolve(root, file), 'utf8');
  for (const re of [/export (?:async )?function (\w+)\s*(?:<[^>]*>)?\s*\(/g, /export const (\w+)\s*=\s*(?:async\s*)?\(/g]) {
    for (const m of src.matchAll(re)) {
      const next = src.indexOf('\nexport ', m.index + 1);
      if (WRITES.test(src.slice(m.index, next === -1 ? src.length : next))) writers.add(m[1]);
    }
  }
}
// 呼叫寫入函式的本地包裝也算寫入路徑（例如 invokeSendEmail、adminSaveX 的轉呼叫）
for (let pass = 0; pass < 2; pass += 1) {
  for (const file of files) {
    const src = readFileSync(resolve(root, file), 'utf8');
    for (const re of [/export (?:async )?function (\w+)\s*(?:<[^>]*>)?\s*\(/g, /export const (\w+)\s*=\s*(?:async\s*)?\(/g]) {
      for (const m of src.matchAll(re)) {
        if (writers.has(m[1])) continue;
        const next = src.indexOf('\nexport ', m.index + 1);
        const body = src.slice(m.index, next === -1 ? src.length : next);
        if ([...body.matchAll(/await\s+(\w+)\(/g)].some((x) => writers.has(x[1]))) writers.add(m[1]);
      }
    }
  }
}

const isApiLayer = (file) => /\/(operations\/api|operations\/case-api|lib\/api)\.ts$/.test(file);
const findings = [];
for (const file of files) {
  if (isApiLayer(file)) continue;
  const src = readFileSync(resolve(root, file), 'utf8');
  const lineOf = (idx) => src.slice(0, idx).split('\n').length;
  const add = (idx, kind, handler, calls, note) =>
    findings.push({ file, line: lineOf(idx), kind, handler, calls: [...new Set(calls)].join(', '), note });

  const named = [
    ...src.matchAll(/const (\w+)\s*=\s*async\s*\([^)]*\)\s*=>/g),
    ...src.matchAll(/async function (\w+)\s*\([^)]*\)/g),
  ];

  /**
   * 共用錯誤包裝器：同一個檔案裡自己就有 try/catch 的 async 函式（SettingsPage 的 run() 是這型）。
   * 寫入被交給它執行時，錯誤已經有人接了——把這種情況也報出來，每次體檢都會重報同一筆，
   * 久了就沒人看報告。所以改成看「這個 await 是不是落在傳給包裝器的參數裡」。
   */
  const safeWrappers = new Set(
    named.filter((m) => { const b = sliceBody(src, m.index + m[0].length); return b.includes('try {') && b.includes('catch'); })
      .map((m) => m[1]),
  );
  /** 傳給包裝器的參數區間（含巢狀括號），用來判斷某個位置是否已被接住。 */
  const guardedSpans = (body) => [...body.matchAll(/(\w+)\(/g)].flatMap((call) => {
    if (!safeWrappers.has(call[1])) return [];
    let depth = 0;
    for (let i = call.index + call[0].length - 1; i < body.length; i += 1) {
      if (body[i] === '(') depth += 1;
      else if (body[i] === ')') { depth -= 1; if (depth === 0) return [[call.index, i]]; }
    }
    return [[call.index, body.length]];
  });
  const unguarded = (body) => {
    const spans = guardedSpans(body);
    return [...body.matchAll(/await\s+(\w+)\(/g)]
      .filter((x) => writers.has(x[1]) && !spans.some(([from, to]) => x.index > from && x.index < to))
      .map((x) => x[1]);
  };

  for (const m of named) {
    const body = sliceBody(src, m.index + m[0].length);
    if (body.includes('try {')) continue;
    const awaited = unguarded(body);
    if (awaited.length) add(m.index, 'await 無 try/catch', `${m[1]}()`, awaited);
  }

  for (const m of src.matchAll(/(?:onClick|onChange|onBlur|onSubmit|onKeyDown)=\{\s*async\s*\([^)]*\)\s*=>/g)) {
    const body = sliceBody(src, m.index + m[0].length);
    if (body.includes('try {')) continue;
    const awaited = unguarded(body);
    if (awaited.length) add(m.index, 'JSX 匿名處理函式無 try/catch', '(inline)', awaited);
  }

  for (const m of src.matchAll(/useEffect\(/g)) {
    const body = sliceBody(src, m.index + m[0].length - 1);
    const awaited = [...body.matchAll(/await\s+(\w+)\(/g)].map((x) => x[1]).filter((n) => writers.has(n));
    const voided = [...body.matchAll(/void (\w+)\(/g)].map((x) => x[1]).filter((n) => writers.has(n));
    const all = [...awaited, ...voided];
    if (all.length && !body.includes('try {') && !body.includes('.catch(')) add(m.index, 'useEffect 內非同步寫入無接手', 'useEffect', all);
  }

  // void f(...) 直接丟掉 promise
  for (const m of src.matchAll(/void (\w+)\(/g)) {
    if (!writers.has(m[1])) continue;
    const stmt = src.slice(m.index, m.index + 400).split(';')[0];
    if (/\.catch\(/.test(stmt)) continue;
    const enclosing = src.slice(Math.max(0, m.index - 700), m.index);
    if (/try \{[^}]*$/.test(enclosing)) continue;
    add(m.index, 'void 呼叫未接 .catch', `${m[1]}()`, [m[1]]);
  }

  // f(...).then(...) 沒接 .catch：從 .then( 往回走括號配對找呼叫者
  for (const m of src.matchAll(/\.then\(/g)) {
    let i = m.index - 1;
    while (i >= 0 && /\s/.test(src[i])) i -= 1;
    if (src[i] !== ')') continue;
    let depth = 0;
    for (; i >= 0; i -= 1) {
      if (src[i] === ')') depth += 1;
      else if (src[i] === '(') { depth -= 1; if (depth === 0) break; }
    }
    const name = /(\w+)$/.exec(src.slice(Math.max(0, i - 60), i))?.[1];
    if (!name || !writers.has(name)) continue;
    const stmt = src.slice(m.index, m.index + 400).split(';')[0];
    if (!/\.catch\(/.test(stmt)) add(m.index, '.then 無 .catch', `${name}()`, [name]);
  }
}

console.log(`掃描檔案：${files.length} 個（src 全域）`);
console.log(`判定為會寫入的函式：${writers.size} 支`);
console.log(`靜默失敗點：${findings.length} 處\n`);
const seen = new Set();
for (const f of findings.sort((a, b) => a.file.localeCompare(b.file) || a.line - b.line)) {
  const key = `${f.file}:${f.line}:${f.kind}`;
  if (seen.has(key)) continue;
  seen.add(key);
  console.log(`${f.file}:${f.line}\n    ${f.kind} — ${f.handler} → ${f.calls}${f.note ? `\n    註：${f.note}` : ''}`);
}
