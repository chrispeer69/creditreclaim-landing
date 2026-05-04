#!/usr/bin/env node
// Extracts dispute letters from CREDITRECLAIM_COMPLETE_DISPUTE_LETTERS_GUIDE.docx
// into structured JSON at scripts/letters-source.json.
//
// Heuristics derived from the actual document (paragraph survey 2026-05-04):
//   • Letter header: "STAGE N - Letter M: Title" (paragraph on its own).
//   • Field labels (each on its own paragraph, ALL CAPS):
//       WHEN TO USE THIS LETTER
//       WHY THIS LETTER WORKS
//       HOW TO USE THIS LETTER
//       LETTER TEMPLATE
//   • Field bodies are single paragraphs containing embedded \n (from <w:br/>) for bullets.
//   • Doc title claims "100+" letters but the content stops at Letter 40 — extract what's there.
//   • Letters appear out of numeric order (Letter 26 sits between 10 and 11). Stage is
//     parsed from the letter header itself, so order doesn't matter for correctness.

import { writeFile } from 'node:fs/promises';
import { execSync } from 'node:child_process';
import { mkdtempSync, rmSync, readFileSync } from 'node:fs';
import { join, resolve, dirname } from 'node:path';
import { tmpdir } from 'node:os';
import { fileURLToPath } from 'node:url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);
const REPO_ROOT = resolve(__dirname, '..');
const DOCX = resolve(REPO_ROOT, 'docs/CREDITRECLAIM_COMPLETE_DISPUTE_LETTERS_GUIDE.docx');
const OUT = resolve(REPO_ROOT, 'scripts/letters-source.json');

// ── Paragraph extraction ───────────────────────────────────────────────
function extractParagraphs(docxPath) {
  const tmp = mkdtempSync(join(tmpdir(), 'cr-letters-'));
  try {
    execSync(`unzip -q "${docxPath}" -d "${tmp}"`, { stdio: 'pipe' });
    const xml = readFileSync(join(tmp, 'word/document.xml'), 'utf8');
    const paras = [];
    const pRe = /<w:p\b[^>]*>([\s\S]*?)<\/w:p>/g;
    let m;
    while ((m = pRe.exec(xml)) !== null) {
      let text = '';
      const tRe = /<w:t(?:\s[^>]*)?>([\s\S]*?)<\/w:t>|<w:tab\/>|<w:br\/>/g;
      let tm;
      while ((tm = tRe.exec(m[1])) !== null) {
        if (tm[0] === '<w:tab/>') text += '\t';
        else if (tm[0] === '<w:br/>') text += '\n';
        else text += decodeEntities(tm[1]);
      }
      paras.push(text);
    }
    return paras;
  } finally {
    rmSync(tmp, { recursive: true, force: true });
  }
}

function decodeEntities(s) {
  return s
    .replace(/&amp;/g, '&')
    .replace(/&lt;/g, '<')
    .replace(/&gt;/g, '>')
    .replace(/&quot;/g, '"')
    .replace(/&apos;/g, "'");
}

// ── Parsing ────────────────────────────────────────────────────────────
const LETTER_HEAD = /^(STAGE\s+\d+|LEGAL)\s*[-–—]\s*Letter\s+(\d+)\s*:\s*(.+)$/i;

const FIELD_LABELS = {
  'WHEN TO USE THIS LETTER': 'when_to_use',
  'WHY THIS LETTER WORKS': 'why_it_works',
  'HOW TO USE THIS LETTER': 'how_to_use',
  'LETTER TEMPLATE': 'template_body',
};

// Map a Stage N → human-readable stage label, derived from the document.
const STAGE_LABELS = {
  1: 'Stage 1: Initial Disputes - Direct to Bureaus',
  2: 'Stage 2: Escalation & Collector Disputes',
  3: 'Stage 3: Legal — Attorney-Level Demands',
};

// Category inferred from title keywords. Order matters — most specific first.
const CATEGORY_RULES = [
  [/identity theft|fraudulent account|police report/i, 'Identity Theft'],
  [/method of verification|\bMOV\b/i, 'Method of Verification'],
  [/cease (?:&|and) desist/i, 'Cease & Desist'],
  [/pay[- ]for[- ]delete/i, 'Pay-for-Delete'],
  [/goodwill/i, 'Goodwill'],
  [/settlement offer|lump sum/i, 'Settlement'],
  [/debt validation|validation demand/i, 'Debt Validation'],
  [/fcra (?:violation|lawsuit)|fcra demand/i, 'FCRA Violation'],
  [/fdcpa (?:violation|harassment)/i, 'FDCPA Violation'],
  [/pre[- ]litigation|intent to file|attorney/i, 'Pre-Litigation'],
  [/statute of limitations|\bSOL\b/i, 'SOL Defense'],
  [/late payment/i, 'Late Payment'],
  [/charge[- ]off/i, 'Charge-Off'],
  [/collection account|dispute collection|collections less than/i, 'Collection'],
  [/hard inquir|soft inquir|inquir/i, 'Inquiry'],
  [/public record/i, 'Public Record'],
  [/mixed file/i, 'Mixed File'],
  [/medical/i, 'Medical Debt'],
  [/duplicate/i, 'Duplicate Reporting'],
  [/balance|interest|fees|amount/i, 'Balance / Amount'],
  [/authorized user/i, 'Authorized User'],
  [/account.*(?:age|date|sold|type|status|limit)|payment history/i, 'Account Detail Error'],
  [/inaccurate account|basic dispute/i, 'Inaccurate Account'],
];

function inferCategory(title) {
  for (const [re, label] of CATEGORY_RULES) {
    if (re.test(title)) return label;
  }
  return 'Other';
}

function parseLetters(paras) {
  const letters = [];
  let current = null;
  let activeField = null;

  const flush = () => {
    if (!current) return;
    for (const k of ['when_to_use', 'why_it_works', 'how_to_use', 'template_body']) {
      current[k] = current[k].replace(/\n{3,}/g, '\n\n').trim();
    }
    letters.push(current);
    current = null;
    activeField = null;
  };

  for (const raw of paras) {
    const para = raw.replace(/ /g, ' '); // normalize non-breaking spaces
    const trimmed = para.trim();

    // Blank paragraph: preserve as a paragraph break inside the active field (esp. template).
    if (trimmed === '') {
      if (current && activeField) current[activeField] += '\n\n';
      continue;
    }

    // Letter header
    const lh = trimmed.match(LETTER_HEAD);
    if (lh) {
      flush();
      const stageToken = lh[1].toUpperCase();
      const number = parseInt(lh[2], 10);
      const title = lh[3].trim();
      let stageNum;
      if (stageToken === 'LEGAL') stageNum = 3;
      else stageNum = parseInt(stageToken.replace(/\D/g, ''), 10);
      current = {
        number,
        stage: STAGE_LABELS[stageNum] ?? `Stage ${stageNum}`,
        category: inferCategory(title),
        title,
        when_to_use: '',
        why_it_works: '',
        how_to_use: '',
        template_body: '',
      };
      activeField = null;
      continue;
    }

    // Field label paragraph — switches the active capture target.
    // Match on the FIRST line of the paragraph (some labels share a paragraph with content).
    const firstLine = trimmed.split('\n')[0].trim().toUpperCase();
    if (FIELD_LABELS[firstLine] !== undefined) {
      if (current) {
        activeField = FIELD_LABELS[firstLine];
        // Capture any trailing content on the same paragraph after the label line.
        const rest = trimmed.split('\n').slice(1).join('\n').trim();
        if (rest) current[activeField] = rest;
      }
      continue;
    }

    // Continuation of the active field
    if (current && activeField) {
      const cleaned = para.replace(/^\n+/, '');
      current[activeField] += (current[activeField] ? '\n' : '') + cleaned;
    }
    // Otherwise it's prose between letters (stage intros, strategy notes) — skip.
  }

  flush();
  letters.sort((a, b) => a.number - b.number);
  return letters;
}

// ── Run ────────────────────────────────────────────────────────────────
const paragraphs = extractParagraphs(DOCX);
const letters = parseLetters(paragraphs);

await writeFile(OUT, JSON.stringify(letters, null, 2) + '\n', 'utf8');

console.log(`Paragraphs scanned: ${paragraphs.length}`);
console.log(`Letters extracted:  ${letters.length}`);
const byStage = letters.reduce((acc, l) => {
  acc[l.stage] = (acc[l.stage] ?? 0) + 1;
  return acc;
}, {});
for (const [stage, n] of Object.entries(byStage)) {
  console.log(`  • ${stage}: ${n}`);
}
console.log(`Output: ${OUT}`);
