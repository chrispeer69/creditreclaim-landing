#!/usr/bin/env node
// Bulk-upserts scripts/letters-source.json into public.letters by `number`.
// Idempotent: re-running updates existing rows (the trigger keeps
// updated_at fresh) and inserts any new ones.
//
// Requires NEXT_PUBLIC_SUPABASE_URL and SUPABASE_SERVICE_ROLE_KEY in
// the environment (typically loaded from .env.local).

import { readFile } from 'node:fs/promises';
import { resolve, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';
import { createClient } from '@supabase/supabase-js';

const __dirname = dirname(fileURLToPath(import.meta.url));
const REPO_ROOT = resolve(__dirname, '..');
const SOURCE = resolve(REPO_ROOT, 'scripts/letters-source.json');

await loadDotEnv(resolve(REPO_ROOT, '.env.local'));

const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
const serviceKey = process.env.SUPABASE_SERVICE_ROLE_KEY;

if (!url || !serviceKey) {
  console.error(
    'Missing env. Set NEXT_PUBLIC_SUPABASE_URL and SUPABASE_SERVICE_ROLE_KEY in .env.local before running.',
  );
  process.exit(1);
}

const supabase = createClient(url, serviceKey, {
  auth: { persistSession: false, autoRefreshToken: false },
});

const raw = await readFile(SOURCE, 'utf8');
const letters = JSON.parse(raw);

if (!Array.isArray(letters) || letters.length === 0) {
  console.error('letters-source.json is empty or not an array.');
  process.exit(1);
}

const REQUIRED = [
  'number',
  'stage',
  'category',
  'title',
  'when_to_use',
  'why_it_works',
  'how_to_use',
  'template_body',
];
for (const l of letters) {
  for (const k of REQUIRED) {
    if (l[k] == null || l[k] === '') {
      console.error(`Letter ${l.number ?? '?'} missing required field "${k}".`);
      process.exit(1);
    }
  }
}

const rows = letters.map(l => ({
  number: l.number,
  stage: l.stage,
  category: l.category,
  title: l.title,
  when_to_use: l.when_to_use,
  why_it_works: l.why_it_works,
  how_to_use: l.how_to_use,
  template_body: l.template_body,
}));

// Upsert on `number` (UNIQUE). Chunked + retried because Supabase / its
// edge layer occasionally drops a TLS connection mid-write on larger
// batches (seen as ECONNRESET).
const BATCH = 10;
const MAX_ATTEMPTS = 5;

for (let i = 0; i < rows.length; i += BATCH) {
  const chunk = rows.slice(i, i + BATCH);
  let attempt = 0;
  while (true) {
    attempt++;
    const { error: upsertError } = await supabase
      .from('letters')
      .upsert(chunk, { onConflict: 'number' });

    if (!upsertError) break;

    const transient =
      /fetch failed|ECONNRESET|ETIMEDOUT|EAI_AGAIN|socket hang up/i.test(
        (upsertError.message || '') + ' ' + (upsertError.details || ''),
      );
    if (transient && attempt < MAX_ATTEMPTS) {
      const delayMs = 500 * attempt;
      console.warn(
        `  rows ${chunk[0].number}-${chunk.at(-1).number}: transient (${upsertError.message}); retry ${attempt}/${MAX_ATTEMPTS - 1} in ${delayMs}ms`,
      );
      await new Promise(r => setTimeout(r, delayMs));
      continue;
    }

    console.error(
      `Upsert failed on batch ${i / BATCH + 1} (rows ${chunk[0].number}-${chunk.at(-1).number}):`,
    );
    console.error(upsertError);
    process.exit(1);
  }
  process.stdout.write(
    `  upserted rows ${chunk[0].number}-${chunk.at(-1).number}\n`,
  );
}

const { count, error: countError } = await supabase
  .from('letters')
  .select('*', { count: 'exact', head: true });

if (countError) {
  console.error('Count failed:', countError.message);
  process.exit(1);
}

console.log(`Seeded ${rows.length} letters. Table now contains ${count} rows.`);

// ─────────────────────────────────────────────────────────────────────
// Tiny .env.local loader so this script runs without a dotenv dep.
async function loadDotEnv(path) {
  let text;
  try {
    text = await readFile(path, 'utf8');
  } catch {
    return;
  }
  for (const line of text.split(/\r?\n/)) {
    const m = line.match(/^\s*([A-Z0-9_]+)\s*=\s*(.*?)\s*$/);
    if (!m) continue;
    const [, k, v] = m;
    if (process.env[k] === undefined) {
      process.env[k] = v.replace(/^["'](.*)["']$/, '$1');
    }
  }
}
