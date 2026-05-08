import { supabase } from '@/lib/supabase';

export type Letter = {
  id: string;
  number: number;
  stage: string;
  category: string;
  title: string;
  when_to_use: string;
  why_it_works: string;
  how_to_use: string;
  template_body: string;
  created_at: string;
  updated_at: string;
};

// Server-component-friendly summary used by the library list. Skips the
// large free-text bodies so the page payload stays small.
export type LetterSummary = Pick<
  Letter,
  'id' | 'number' | 'stage' | 'category' | 'title' | 'when_to_use'
>;

export async function fetchAllLetterSummaries(): Promise<LetterSummary[]> {
  const { data, error } = await supabase
    .from('letters')
    .select('id, number, stage, category, title, when_to_use')
    .order('number', { ascending: true });

  if (error) throw new Error(`Failed to load letters: ${error.message}`);
  return (data as LetterSummary[]) ?? [];
}

export async function fetchLetterById(id: string): Promise<Letter | null> {
  const { data, error } = await supabase
    .from('letters')
    .select('*')
    .eq('id', id)
    .maybeSingle();

  if (error) throw new Error(`Failed to load letter: ${error.message}`);
  return (data as Letter | null) ?? null;
}

// Used by the dashboard "Send today" panel — fetches up to N letters
// from a given stage, ordered by number, summary fields only.
export async function fetchLettersForStage(
  stage: string,
  limit: number,
): Promise<LetterSummary[]> {
  const { data, error } = await supabase
    .from('letters')
    .select('id, number, stage, category, title, when_to_use')
    .eq('stage', stage)
    .order('number', { ascending: true })
    .limit(limit);

  if (error) throw new Error(`Failed to load stage letters: ${error.message}`);
  return (data as LetterSummary[]) ?? [];
}

// First-sentence-ish summary capped at 150 chars — for the library list.
export function summarize(text: string, max = 150): string {
  const cleaned = text
    .replace(/^•\s*/gm, '')
    .replace(/\s+/g, ' ')
    .trim();
  if (cleaned.length <= max) return cleaned;
  return cleaned.slice(0, max - 1).trimEnd() + '…';
}
