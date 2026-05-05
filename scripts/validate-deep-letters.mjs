#!/usr/bin/env node
// Validates the deep-letter library at scripts/letters-source.json against
// the trifecta-benchmark depth + content checks. Run: node scripts/validate-deep-letters.mjs
//
// Bucketing rule:
//   • 0 issues  → PASS
//   • 1 issue   → WARN
//   • 2+ issues → FAIL
// Length shortfalls count as one issue per field.

import { readFile } from 'node:fs/promises';
import { resolve, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);
const SRC = resolve(__dirname, 'letters-source.json');

// ── Thresholds ─────────────────────────────────────────────────────────
const MIN = {
  when_to_use: 600,     // exemplar: ~900-1200
  why_it_works: 1500,   // exemplar: ~2200-3900
  how_to_use: 2000,     // exemplar: ~2800-4500
  template_body: 4000,  // exemplar: ~6000-7000
};

const REQUIRED_FIELDS = [
  'number', 'stage', 'category', 'title',
  'when_to_use', 'why_it_works', 'how_to_use', 'template_body',
];

const STATUTORY_SUBSECTION = /§\s*1681[a-z]\b|§\s*1692[a-z]\b/;
const USC_CITATION = /15\s*U\.?S\.?C\.?\s*§/;

// ── Per-letter checks ──────────────────────────────────────────────────
function checkLetter(l) {
  const issues = [];

  // 1. Required fields present and non-empty
  for (const f of REQUIRED_FIELDS) {
    const v = l[f];
    const empty = v === undefined || v === null
      || (typeof v === 'string' && v.trim() === '');
    if (empty) issues.push(`missing/empty field: ${f}`);
  }

  // 2. Min char counts (only if the field exists as a string)
  for (const [f, min] of Object.entries(MIN)) {
    const len = (typeof l[f] === 'string' ? l[f] : '').length;
    if (len < min) issues.push(`${f} too short (${len} < ${min})`);
  }

  // 3. Template body has a specific FCRA/FDCPA subsection citation
  const tpl = typeof l.template_body === 'string' ? l.template_body : '';
  if (!STATUTORY_SUBSECTION.test(tpl)) {
    issues.push('template_body missing § 1681x / § 1692x subsection citation');
  }

  // 4. Template body references CERTIFIED MAIL
  if (!/CERTIFIED MAIL/.test(tpl)) {
    issues.push('template_body missing "CERTIFIED MAIL" reference');
  }

  // 5. how_to_use has both MAILING: and TIMING: labels
  const how = typeof l.how_to_use === 'string' ? l.how_to_use : '';
  const missingLabels = [];
  if (!/MAILING:/.test(how)) missingLabels.push('MAILING:');
  if (!/TIMING:/.test(how)) missingLabels.push('TIMING:');
  if (missingLabels.length) {
    issues.push(`how_to_use missing label(s): ${missingLabels.join(', ')}`);
  }

  // 6. why_it_works cites at least one 15 U.S.C. § statute
  const why = typeof l.why_it_works === 'string' ? l.why_it_works : '';
  if (!USC_CITATION.test(why)) {
    issues.push('why_it_works missing 15 U.S.C. § citation');
  }

  let bucket;
  if (issues.length === 0) bucket = 'PASS';
  else if (issues.length === 1) bucket = 'WARN';
  else bucket = 'FAIL';

  return { number: l.number, title: l.title, issues, bucket };
}

// ── Reporting helpers ──────────────────────────────────────────────────
function fmtNumList(rs) {
  return rs.map(r => r.number).sort((a, b) => a - b).join(', ');
}

function avgLen(letters, field) {
  if (!letters.length) return 0;
  const sum = letters.reduce((s, l) => s + (typeof l[field] === 'string' ? l[field].length : 0), 0);
  return Math.round(sum / letters.length);
}

function pickRandom(arr, n) {
  const copy = [...arr];
  const out = [];
  while (out.length < n && copy.length) {
    const i = Math.floor(Math.random() * copy.length);
    out.push(copy.splice(i, 1)[0]);
  }
  return out;
}

// ── Main ───────────────────────────────────────────────────────────────
const raw = await readFile(SRC, 'utf8');
const letters = JSON.parse(raw);
if (!Array.isArray(letters)) {
  console.error(`Expected an array at ${SRC}, got ${typeof letters}`);
  process.exit(2);
}

const results = letters.map(checkLetter);
const pass = results.filter(r => r.bucket === 'PASS');
const warn = results.filter(r => r.bucket === 'WARN');
const fail = results.filter(r => r.bucket === 'FAIL');

// PASS
console.log('━'.repeat(72));
console.log(`PASS (${pass.length})`);
console.log('━'.repeat(72));
console.log(pass.length ? fmtNumList(pass) : '(none)');

// WARN
console.log('');
console.log('━'.repeat(72));
console.log(`WARN (${warn.length}) — one issue each`);
console.log('━'.repeat(72));
if (!warn.length) console.log('(none)');
for (const r of warn.sort((a, b) => a.number - b.number)) {
  console.log(`  #${String(r.number).padStart(3)}  ${r.title}`);
  console.log(`         └─ ${r.issues[0]}`);
}

// FAIL
console.log('');
console.log('━'.repeat(72));
console.log(`FAIL (${fail.length}) — two or more issues`);
console.log('━'.repeat(72));
if (!fail.length) console.log('(none)');
for (const r of fail.sort((a, b) => a.number - b.number)) {
  console.log(`  #${String(r.number).padStart(3)}  ${r.title}  [${r.issues.length} issues]`);
  for (const i of r.issues) console.log(`         • ${i}`);
}

// ── Summary stats ──────────────────────────────────────────────────────
console.log('');
console.log('━'.repeat(72));
console.log('SUMMARY');
console.log('━'.repeat(72));
console.log(`Total letters:  ${letters.length}`);
console.log(`  PASS:         ${pass.length}`);
console.log(`  WARN:         ${warn.length}`);
console.log(`  FAIL:         ${fail.length}`);
console.log('');
console.log('Average char counts:');
for (const f of ['when_to_use', 'why_it_works', 'how_to_use', 'template_body']) {
  const avg = avgLen(letters, f);
  const min = MIN[f];
  const flag = avg < min ? `  ⚠ below min (${min})` : '';
  console.log(`  ${f.padEnd(14)} ${String(avg).padStart(6)}${flag}`);
}

console.log('');
console.log('Shortest 5 by template_body:');
const shortest = [...letters]
  .map(l => ({ number: l.number, title: l.title, len: (l.template_body || '').length }))
  .sort((a, b) => a.len - b.len)
  .slice(0, 5);
for (const s of shortest) {
  console.log(`  #${String(s.number).padStart(3)}  ${String(s.len).padStart(5)} chars  ${s.title}`);
}

// ── Random spot-check sample ───────────────────────────────────────────
console.log('');
console.log('━'.repeat(72));
console.log('RANDOM SAMPLE — manually review these 5');
console.log('━'.repeat(72));
const sample = pickRandom(letters, Math.min(5, letters.length))
  .map(l => l.number)
  .sort((a, b) => a - b);
console.log(`  Letters: ${sample.join(', ')}`);

// Exit non-zero if anything failed, so this is CI-friendly.
process.exit(fail.length ? 1 : 0);
