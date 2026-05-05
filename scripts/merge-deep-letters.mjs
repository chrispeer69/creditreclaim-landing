#!/usr/bin/env node
// Merges deeply-authored letter overrides from scripts/deep/letter_NN_deep.json
// into scripts/letters-source.json by `number`, preserving array order.
// Run: node scripts/merge-deep-letters.mjs
//
// Each deep file is one letter object with the same 8 fields as letters-source.json.
// The merge replaces the whole object (not a field-merge) — the deep file is the
// source of truth for that letter number.
//
// Exits non-zero on any validation failure (CI-safe).

import { readdir, readFile, writeFile } from 'node:fs/promises';
import { resolve, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);
const DEEP_DIR = resolve(__dirname, 'deep');
const SRC = resolve(__dirname, 'letters-source.json');

const REQUIRED_FIELDS = [
  'number', 'stage', 'category', 'title',
  'when_to_use', 'why_it_works', 'how_to_use', 'template_body',
];

const DEEP_RE = /^letter_(\d+)_deep\.json$/;

function fail(msg) {
  console.error(`✖ ${msg}`);
  process.exit(1);
}

function isNonEmptyString(v) {
  return typeof v === 'string' && v.trim() !== '';
}

function validateLetter(l, where) {
  for (const f of REQUIRED_FIELDS) {
    const v = l[f];
    if (f === 'number') {
      if (typeof v !== 'number' || !Number.isInteger(v) || v < 1) {
        return `${where}: invalid 'number' field (got ${JSON.stringify(v)})`;
      }
    } else if (!isNonEmptyString(v)) {
      return `${where}: missing/empty field '${f}'`;
    }
  }
  return null;
}

// ── Load deep overrides ────────────────────────────────────────────────
const dirEntries = await readdir(DEEP_DIR);
const deepFiles = dirEntries.filter(n => DEEP_RE.test(n)).sort();

if (deepFiles.length === 0) {
  fail(`No letter_NN_deep.json files found in ${DEEP_DIR}`);
}

const overrides = new Map(); // number → { letter, file }
for (const file of deepFiles) {
  const expectedNum = parseInt(file.match(DEEP_RE)[1], 10);
  let parsed;
  try {
    parsed = JSON.parse(await readFile(resolve(DEEP_DIR, file), 'utf8'));
  } catch (e) {
    fail(`Failed to parse ${file}: ${e.message}`);
  }
  const err = validateLetter(parsed, file);
  if (err) fail(err);
  if (parsed.number !== expectedNum) {
    fail(`${file}: filename says ${expectedNum} but JSON.number is ${parsed.number}`);
  }
  if (overrides.has(parsed.number)) {
    fail(`Duplicate override for letter ${parsed.number} (second file: ${file})`);
  }
  overrides.set(parsed.number, { letter: parsed, file });
}

// ── Load source ────────────────────────────────────────────────────────
let source;
try {
  source = JSON.parse(await readFile(SRC, 'utf8'));
} catch (e) {
  fail(`Failed to parse ${SRC}: ${e.message}`);
}
if (!Array.isArray(source)) fail(`${SRC} is not an array`);
const sourceCountBefore = source.length;

// ── Merge ──────────────────────────────────────────────────────────────
const upgrades = []; // { number, beforeLen, afterLen, file }
const merged = source.map(orig => {
  const ov = overrides.get(orig.number);
  if (!ov) return orig;
  upgrades.push({
    number: orig.number,
    beforeLen: (orig.template_body || '').length,
    afterLen: (ov.letter.template_body || '').length,
    file: ov.file,
  });
  return ov.letter;
});

// Any override that didn't find a home in the source array?
const matchedNums = new Set(upgrades.map(u => u.number));
const orphaned = [...overrides.keys()].filter(n => !matchedNums.has(n));
if (orphaned.length) {
  fail(`Override(s) had no matching letter in source: ${orphaned.join(', ')}`);
}

// ── Validate merged result ─────────────────────────────────────────────
if (merged.length !== sourceCountBefore) {
  fail(`Length changed: ${sourceCountBefore} → ${merged.length}`);
}
if (merged.length !== 105) {
  // Soft warn — script is general, but the project baseline is 105.
  console.warn(`⚠ Source has ${merged.length} letters (expected 105 per project baseline)`);
}

const seen = new Set();
for (let i = 0; i < merged.length; i++) {
  const l = merged[i];
  const err = validateLetter(l, `merged[${i}] (number=${l?.number})`);
  if (err) fail(err);
  if (seen.has(l.number)) fail(`Duplicate letter number after merge: ${l.number}`);
  seen.add(l.number);
}

// ── Write back ─────────────────────────────────────────────────────────
await writeFile(SRC, JSON.stringify(merged, null, 2) + '\n', 'utf8');

// ── Report ─────────────────────────────────────────────────────────────
console.log(`Deep override files scanned: ${deepFiles.length}`);
console.log(`Source letters:              ${merged.length}`);
console.log(`Upgrades applied:            ${upgrades.length}`);
console.log('');
console.log('Letter   template_body   delta   file');
console.log('──────   ─────────────   ─────   ────');
for (const u of upgrades.sort((a, b) => a.number - b.number)) {
  const delta = u.afterLen - u.beforeLen;
  const sign = delta >= 0 ? '+' : '';
  console.log(
    `  #${String(u.number).padStart(3)}    ` +
    `${String(u.beforeLen).padStart(5)} → ${String(u.afterLen).padStart(5)}   ` +
    `${(sign + delta).padStart(5)}   ${u.file}`
  );
}
console.log('');
console.log(`✓ Wrote ${SRC}`);
