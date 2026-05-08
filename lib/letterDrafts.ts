import { supabase } from '@/lib/supabase';

export type LetterDraft = {
  id: string;
  user_id: string;
  letter_number: number;
  customized_body: string;
  status: 'draft' | 'finalized' | 'sent';
  mailed_at: string | null;
  mailed_to: string | null;
  tracking_number: string | null;
  created_at: string;
  updated_at: string;
};

export type DraftWithLetter = LetterDraft & {
  letter_title: string | null;
  letter_stage: string | null;
  letter_category: string | null;
};

// Fields the bracket replacer reads off whatever subset exists on
// user_credits today. Schema doesn't carry these yet — picking them up
// from a single source as columns get added avoids touching this in
// every consumer.
export type IdentityFields = {
  full_name?: string | null;
  address?: string | null;
  city_state_zip?: string | null;
  phone?: string | null;
  email?: string | null;
  dob?: string | null;
  last_4_ssn?: string | null;
};

const BRACKET_MAP: Array<{ patterns: string[]; pick: (i: IdentityFields) => string | null | undefined }> = [
  { patterns: ['Your Full Legal Name'], pick: i => i.full_name },
  { patterns: ['Your Name'], pick: i => i.full_name },
  { patterns: ['Your Address'], pick: i => i.address },
  { patterns: ['Your City, State Zip', 'Your City State Zip'], pick: i => i.city_state_zip },
  { patterns: ['Your Phone Number', 'Your Phone'], pick: i => i.phone },
  { patterns: ['Your Email Address', 'Your Email'], pick: i => i.email },
  { patterns: ['Your Date of Birth', 'Your DOB'], pick: i => formatDob(i.dob) },
  { patterns: ['Last 4 of SSN', 'Last 4 SSN'], pick: i => i.last_4_ssn },
  { patterns: ["Today's Date", 'Date'], pick: () => formatTodayLong() },
];

// Replaces identity brackets case-insensitively. Brackets without a
// resolved value stay as-is so users see what they still need to fill in.
// Account-specific brackets (Account Number, Creditor Name, etc.) are
// never touched — they vary per dispute and we don't have them stored.
export function applyBracketReplacer(
  template: string,
  identity: IdentityFields,
): string {
  let result = template;
  for (const { patterns, pick } of BRACKET_MAP) {
    const value = pick(identity);
    if (value == null || value === '') continue;
    for (const p of patterns) {
      const re = new RegExp(`\\[${escapeRegex(p)}\\]`, 'gi');
      result = result.replace(re, value);
    }
  }
  return result;
}

function escapeRegex(s: string): string {
  return s.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
}

function formatTodayLong(): string {
  return new Date().toLocaleDateString('en-US', {
    month: 'long',
    day: 'numeric',
    year: 'numeric',
  });
}

// "1986-04-12" or "1986-04-12T..." → "04/12/1986". Anything we can't parse
// is returned as-is so the user can still see something useful.
function formatDob(value: string | null | undefined): string | null | undefined {
  if (value == null || value === '') return value;
  const m = value.match(/^(\d{4})-(\d{2})-(\d{2})/);
  if (!m) return value;
  return `${m[2]}/${m[3]}/${m[1]}`;
}

// Pulls IdentityFields off whatever the user_credits row carries today.
// As columns get added to user_credits, they automatically start working.
export function identityFromCredits(
  credits: Record<string, unknown> | null,
  fallbackEmail: string | null,
): IdentityFields {
  const v = (k: string): string | null => {
    const raw = credits?.[k];
    return typeof raw === 'string' && raw.trim() !== '' ? raw : null;
  };
  return {
    full_name: v('full_name'),
    address: v('address'),
    city_state_zip: v('city_state_zip'),
    phone: v('phone'),
    email: v('email') ?? fallbackEmail,
    dob: v('dob') ?? v('date_of_birth'),
    last_4_ssn: v('last_4_ssn') ?? v('ssn_last_4'),
  };
}

export async function fetchDraft(
  userId: string,
  letterNumber: number,
): Promise<{ draft: LetterDraft | null; missingTable: boolean; error: string | null }> {
  const { data, error } = await supabase
    .from('letter_drafts')
    .select('*')
    .eq('user_id', userId)
    .eq('letter_number', letterNumber)
    .maybeSingle();
  if (error) {
    const missing = /schema cache|relation .* does not exist/i.test(error.message);
    return { draft: null, missingTable: missing, error: error.message };
  }
  return { draft: (data as LetterDraft | null) ?? null, missingTable: false, error: null };
}

export async function upsertDraft(args: {
  userId: string;
  letterNumber: number;
  customized_body: string;
  status: 'draft' | 'finalized' | 'sent';
}): Promise<{ draft: LetterDraft | null; error: string | null; missingTable: boolean }> {
  const payload = {
    user_id: args.userId,
    letter_number: args.letterNumber,
    customized_body: args.customized_body,
    status: args.status,
  };
  const { data, error } = await supabase
    .from('letter_drafts')
    .upsert(payload, { onConflict: 'user_id,letter_number' })
    .select('*')
    .maybeSingle();
  if (error) {
    const missing = /schema cache|relation .* does not exist/i.test(error.message);
    return { draft: null, error: error.message, missingTable: missing };
  }
  return { draft: (data as LetterDraft | null) ?? null, error: null, missingTable: false };
}

export async function fetchUserCredits(
  userId: string,
): Promise<Record<string, unknown> | null> {
  const { data, error } = await supabase
    .from('user_credits')
    .select('*')
    .eq('id', userId)
    .maybeSingle();
  if (error) return null;
  return (data as Record<string, unknown> | null) ?? null;
}

// Returns drafts joined with their master letter metadata (title/stage/
// category come from the letters table by letter_number).
export async function fetchUserDrafts(
  userId: string,
): Promise<{ drafts: DraftWithLetter[]; missingTable: boolean; error: string | null }> {
  const { data: draftRows, error } = await supabase
    .from('letter_drafts')
    .select('*')
    .eq('user_id', userId)
    .order('updated_at', { ascending: false });
  if (error) {
    const missing = /schema cache|relation .* does not exist/i.test(error.message);
    return { drafts: [], missingTable: missing, error: error.message };
  }

  const drafts = (draftRows as LetterDraft[] | null) ?? [];
  if (drafts.length === 0) {
    return { drafts: [], missingTable: false, error: null };
  }

  const numbers = Array.from(new Set(drafts.map(d => d.letter_number)));
  const { data: letterRows } = await supabase
    .from('letters')
    .select('number, title, stage, category')
    .in('number', numbers);

  const byNumber = new Map<number, { title: string; stage: string; category: string }>();
  for (const r of (letterRows as Array<{ number: number; title: string; stage: string; category: string }> | null) ?? []) {
    byNumber.set(r.number, { title: r.title, stage: r.stage, category: r.category });
  }

  const joined: DraftWithLetter[] = drafts.map(d => {
    const m = byNumber.get(d.letter_number);
    return {
      ...d,
      letter_title: m?.title ?? null,
      letter_stage: m?.stage ?? null,
      letter_category: m?.category ?? null,
    };
  });

  return { drafts: joined, missingTable: false, error: null };
}

// Human-friendly relative time, used by CTAs and the My Letters list.
export function relativeTime(iso: string | null | undefined): string {
  if (!iso) return '—';
  const then = new Date(iso).getTime();
  if (Number.isNaN(then)) return '—';
  const diffSec = Math.round((Date.now() - then) / 1000);
  if (diffSec < 5) return 'just now';
  if (diffSec < 60) return `${diffSec} sec ago`;
  const min = Math.round(diffSec / 60);
  if (min < 60) return `${min} min ago`;
  const hr = Math.round(min / 60);
  if (hr < 24) return `${hr} ${hr === 1 ? 'hour' : 'hours'} ago`;
  const day = Math.round(hr / 24);
  if (day < 30) return `${day} ${day === 1 ? 'day' : 'days'} ago`;
  const month = Math.round(day / 30);
  if (month < 12) return `${month} mo ago`;
  return new Date(iso).toLocaleDateString(undefined, {
    month: 'short',
    day: 'numeric',
    year: 'numeric',
  });
}
