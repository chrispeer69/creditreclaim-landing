'use client';

import { useCallback, useEffect, useRef, useState } from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { supabase } from '@/lib/supabase';
import {
  applyBracketReplacer,
  fetchDraft,
  fetchUserCredits,
  identityFromCredits,
  relativeTime,
  upsertDraft,
  type IdentityFields,
  type LetterDraft,
} from '@/lib/letterDrafts';

const AUTO_SAVE_INTERVAL_MS = 30_000;

type SaveState =
  | { kind: 'idle' }
  | { kind: 'saving' }
  | { kind: 'saved'; at: string }
  | { kind: 'unsaved' }
  | { kind: 'error'; message: string };

export default function CustomizeClient(props: {
  letterId: string;
  letterNumber: number;
  letterTitle: string;
  letterStage: string;
  letterCategory: string;
  masterTemplateBody: string;
}) {
  const router = useRouter();
  const {
    letterId,
    letterNumber,
    letterTitle,
    letterStage,
    letterCategory,
    masterTemplateBody,
  } = props;

  const [authChecked, setAuthChecked] = useState(false);
  const [userId, setUserId] = useState<string | null>(null);
  const [identity, setIdentity] = useState<IdentityFields>({});
  const [missingTable, setMissingTable] = useState(false);
  const [bootError, setBootError] = useState<string | null>(null);

  const [body, setBody] = useState<string>('');
  const [savedBody, setSavedBody] = useState<string>('');
  const [draft, setDraft] = useState<LetterDraft | null>(null);
  const [saveState, setSaveState] = useState<SaveState>({ kind: 'idle' });
  const [confirmReset, setConfirmReset] = useState(false);

  // Always read the latest values out of refs inside async callbacks
  // (effects, autosave, beforeunload) so we never write stale text back.
  const bodyRef = useRef(body);
  const savedBodyRef = useRef(savedBody);
  const userIdRef = useRef(userId);
  useEffect(() => { bodyRef.current = body; }, [body]);
  useEffect(() => { savedBodyRef.current = savedBody; }, [savedBody]);
  useEffect(() => { userIdRef.current = userId; }, [userId]);

  // ── Boot: auth → user_credits → existing draft → editor seed ─────
  useEffect(() => {
    let cancelled = false;
    (async () => {
      const { data: sessionData } = await supabase.auth.getSession();
      const u = sessionData.session?.user;
      if (!u) {
        if (!cancelled) {
          setAuthChecked(true);
          router.push('/login');
        }
        return;
      }

      const credits = await fetchUserCredits(u.id);
      const ident = identityFromCredits(credits, u.email ?? null);
      const { draft: existing, missingTable: missing, error } =
        await fetchDraft(u.id, letterNumber);

      if (cancelled) return;

      setUserId(u.id);
      setIdentity(ident);
      if (missing) {
        setMissingTable(true);
        setAuthChecked(true);
        return;
      }
      if (error && !missing) setBootError(error);

      if (existing) {
        setDraft(existing);
        setBody(existing.customized_body);
        setSavedBody(existing.customized_body);
        setSaveState({ kind: 'saved', at: existing.updated_at });
      } else {
        const seeded = applyBracketReplacer(masterTemplateBody, ident);
        setBody(seeded);
        setSavedBody('');
        setSaveState({ kind: 'unsaved' });
      }
      setAuthChecked(true);
    })();
    return () => {
      cancelled = true;
    };
  }, [letterNumber, masterTemplateBody, router]);

  // ── Track unsaved-changes state ──────────────────────────────────
  useEffect(() => {
    if (!authChecked || missingTable) return;
    if (saveState.kind === 'saving') return;
    if (body !== savedBody) {
      // Don't clobber a fresh "saved" tick that hasn't yet caught up.
      if (saveState.kind !== 'unsaved') setSaveState({ kind: 'unsaved' });
    }
  }, [body, savedBody, authChecked, missingTable, saveState.kind]);

  // ── Manual save / autosave shared path ───────────────────────────
  const saveNow = useCallback(
    async (status: 'draft' | 'finalized') => {
      const uid = userIdRef.current;
      if (!uid) return { ok: false, error: 'Not signed in' };
      const text = bodyRef.current;
      setSaveState({ kind: 'saving' });
      const { draft: saved, error, missingTable: missing } = await upsertDraft({
        userId: uid,
        letterNumber,
        customized_body: text,
        status,
      });
      if (missing) {
        setMissingTable(true);
        setSaveState({ kind: 'error', message: 'Drafts table not yet applied' });
        return { ok: false, error: 'Drafts table not yet applied' };
      }
      if (error || !saved) {
        setSaveState({ kind: 'error', message: error ?? 'Save failed' });
        return { ok: false, error: error ?? 'Save failed' };
      }
      setDraft(saved);
      setSavedBody(saved.customized_body);
      setSaveState({ kind: 'saved', at: saved.updated_at });
      return { ok: true, error: null };
    },
    [letterNumber],
  );

  // ── Autosave: every 30s while dirty ──────────────────────────────
  useEffect(() => {
    if (!authChecked || missingTable) return;
    const id = setInterval(() => {
      if (bodyRef.current !== savedBodyRef.current) {
        void saveNow('draft');
      }
    }, AUTO_SAVE_INTERVAL_MS);
    return () => clearInterval(id);
  }, [authChecked, missingTable, saveNow]);

  // ── Autosave on textarea blur ────────────────────────────────────
  const onBlur = useCallback(() => {
    if (bodyRef.current !== savedBodyRef.current) {
      void saveNow('draft');
    }
  }, [saveNow]);

  // ── Autosave on tab/window close (best-effort via sendBeacon) ────
  useEffect(() => {
    if (!authChecked || missingTable) return;
    const onBeforeUnload = () => {
      if (bodyRef.current === savedBodyRef.current) return;
      const uid = userIdRef.current;
      if (!uid) return;
      const url = `${process.env.NEXT_PUBLIC_SUPABASE_URL}/rest/v1/letter_drafts?on_conflict=user_id,letter_number`;
      const body = JSON.stringify({
        user_id: uid,
        letter_number: letterNumber,
        customized_body: bodyRef.current,
        status: 'draft',
      });
      // sendBeacon doesn't support custom headers; fall back to keepalive
      // fetch which does. Either path is best-effort; the regular
      // interval/blur autosave is the primary defense.
      try {
        const session = supabase.auth;
        void session;
        const key = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY ?? '';
        void fetch(url, {
          method: 'POST',
          mode: 'cors',
          credentials: 'omit',
          keepalive: true,
          headers: {
            apikey: key,
            'Content-Type': 'application/json',
            Prefer: 'resolution=merge-duplicates',
          },
          body,
        });
      } catch {
        // best-effort; nothing else to do here
      }
    };
    window.addEventListener('beforeunload', onBeforeUnload);
    return () => window.removeEventListener('beforeunload', onBeforeUnload);
  }, [authChecked, missingTable, letterNumber]);

  // ── Toolbar actions ──────────────────────────────────────────────
  const onSaveClick = useCallback(async () => {
    await saveNow('draft');
  }, [saveNow]);

  const onPrintClick = useCallback(async () => {
    // Save as 'finalized' first; print only after the row hits the DB so
    // the My Letters list reflects the right status next time.
    const r = await saveNow('finalized');
    if (!r.ok) return;
    window.print();
  }, [saveNow]);

  const onStartOver = useCallback(async () => {
    if (!confirmReset) {
      setConfirmReset(true);
      return;
    }
    setConfirmReset(false);
    const seeded = applyBracketReplacer(masterTemplateBody, identity);
    setBody(seeded);
    bodyRef.current = seeded;
    await saveNow('draft');
  }, [confirmReset, identity, masterTemplateBody, saveNow]);

  const onBackToLibrary = useCallback(async () => {
    if (bodyRef.current !== savedBodyRef.current) {
      const ok = window.confirm('You have unsaved changes. Save before leaving?');
      if (ok) await saveNow('draft');
    }
    router.push('/dashboard/letters');
  }, [router, saveNow]);

  // ── Render ───────────────────────────────────────────────────────
  if (!authChecked) {
    return (
      <div className="min-h-screen bg-gray-50 flex items-center justify-center">
        <p className="text-sm text-gray-600 font-light">Loading editor…</p>
      </div>
    );
  }

  if (missingTable) {
    return (
      <div className="min-h-screen bg-gray-50">
        <Nav letterNumber={letterNumber} />
        <main className="max-w-3xl mx-auto px-4 sm:px-8 py-12">
          <div className="bg-amber-50 border border-amber-200 p-6 sm:p-8">
            <p className="text-xs uppercase tracking-wider text-amber-800 font-medium mb-2">
              Drafts table not yet applied
            </p>
            <p className="text-sm text-gray-800 font-light">
              The <code className="font-mono text-xs">letter_drafts</code>{' '}
              table isn&apos;t in Supabase yet. Apply
              <code className="font-mono text-xs">
                {' '}
                supabase/migrations/20260508120000_letter_drafts.sql
              </code>{' '}
              via the Supabase SQL Editor, then come back here.
            </p>
          </div>
        </main>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gray-50 print:bg-white">
      <Nav letterNumber={letterNumber} />

      <main className="max-w-5xl mx-auto px-4 sm:px-8 py-6 sm:py-8 print:px-0 print:py-0 print:max-w-none">
        <header className="mb-5 print:hidden">
          <p className="text-xs uppercase tracking-wider text-emerald-700 font-medium mb-2">
            Letter no. {letterNumber} · Customize
          </p>
          <h1 className="text-2xl sm:text-3xl font-light text-gray-900 leading-snug">
            {letterTitle}
          </h1>
          <div className="mt-2 flex flex-wrap items-center gap-2">
            <Chip>{shortStage(letterStage)}</Chip>
            <Chip>{letterCategory}</Chip>
          </div>
        </header>

        {bootError && (
          <div className="mb-4 p-3 border border-red-300 bg-red-50 text-sm text-red-900 print:hidden">
            {bootError}
          </div>
        )}

        <div className="sticky top-[64px] z-30 -mx-4 sm:mx-0 bg-gray-900 text-white border border-gray-900 px-4 sm:px-5 py-3 flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3 print:hidden no-print">
          <div className="flex flex-wrap gap-2">
            <button
              type="button"
              onClick={onSaveClick}
              disabled={saveState.kind === 'saving' || body === savedBody}
              className="text-xs px-3 py-2 bg-emerald-500 text-gray-900 font-semibold hover:bg-emerald-400 disabled:opacity-50 disabled:cursor-not-allowed transition"
            >
              Save draft
            </button>
            <button
              type="button"
              onClick={onPrintClick}
              disabled={saveState.kind === 'saving'}
              className="text-xs px-3 py-2 bg-white text-gray-900 font-semibold hover:bg-gray-100 disabled:opacity-50 transition"
            >
              Print
            </button>
            <button
              type="button"
              onClick={onStartOver}
              className={`text-xs px-3 py-2 font-medium border transition ${
                confirmReset
                  ? 'bg-red-600 border-red-600 text-white hover:bg-red-700'
                  : 'border-gray-600 text-gray-100 hover:bg-gray-800'
              }`}
            >
              {confirmReset ? 'Click again to confirm reset' : 'Start over'}
            </button>
            {confirmReset && (
              <button
                type="button"
                onClick={() => setConfirmReset(false)}
                className="text-xs px-3 py-2 font-medium text-gray-300 hover:text-white"
              >
                Cancel
              </button>
            )}
            <button
              type="button"
              onClick={onBackToLibrary}
              className="text-xs px-3 py-2 font-medium text-gray-300 hover:text-white"
            >
              ← Back to library
            </button>
          </div>
          <SaveStateLine state={saveState} />
        </div>

        <p className="mt-3 mb-2 text-xs text-gray-600 font-light print:hidden">
          Identity brackets like{' '}
          <code className="font-mono">[Your Full Legal Name]</code> get
          pre-filled where we have data; account-specific brackets like{' '}
          <code className="font-mono">[Account Number]</code> are yours to
          fill in.
        </p>

        <div className="bg-white border border-gray-200 print:border-0">
          <textarea
            value={body}
            onChange={e => setBody(e.target.value)}
            onBlur={onBlur}
            spellCheck={true}
            className="w-full min-h-[70vh] px-4 sm:px-8 py-6 sm:py-8 text-sm sm:text-[15px] leading-7 text-gray-900 font-mono whitespace-pre-wrap focus:outline-none resize-y print:hidden"
          />
          <div
            className="print-letter-body hidden print:block whitespace-pre-wrap"
            aria-hidden="true"
          >
{body}
          </div>
        </div>

        <p className="mt-4 text-xs text-gray-500 font-light print:hidden">
          {draft
            ? `Draft saved — status: ${draft.status}`
            : 'No draft saved yet — your edits will save automatically every 30 seconds.'}
        </p>
      </main>

      <style>{`
        @media print {
          @page { margin: 0.75in; }
          html, body { background: #fff !important; }
          body * { visibility: hidden; }
          .print-letter-body, .print-letter-body * { visibility: visible; }
          .print-letter-body {
            position: absolute;
            left: 0;
            top: 0;
            width: 100%;
            font-family: 'Times New Roman', Times, serif;
            font-size: 12pt;
            line-height: 1.5;
            white-space: pre-wrap;
          }
          nav, header, footer, .no-print { display: none !important; }
        }
      `}</style>
    </div>
  );
}

function Nav({ letterNumber }: { letterNumber: number }) {
  return (
    <nav className="border-b border-gray-200 bg-white sticky top-0 z-40 print:hidden">
      <div className="max-w-5xl mx-auto px-4 sm:px-8 py-4 sm:py-5 flex justify-between items-center">
        <div className="flex items-center gap-6">
          <Link
            href="/dashboard"
            className="text-xl sm:text-2xl font-light tracking-tight text-gray-800"
          >
            Credit<span className="font-semibold">Reclaim</span>
          </Link>
          <span className="hidden sm:inline-block text-xs uppercase tracking-wider text-gray-500 px-2 py-1 border border-gray-200">
            Letter no. {letterNumber} · Editing
          </span>
        </div>
        <Link
          href="/dashboard/letters"
          className="text-sm text-gray-600 hover:text-gray-800 font-medium"
        >
          ← Back to library
        </Link>
      </div>
    </nav>
  );
}

function SaveStateLine({ state }: { state: SaveState }) {
  if (state.kind === 'saving') {
    return <span className="text-xs text-gray-300 font-light">Saving…</span>;
  }
  if (state.kind === 'saved') {
    return (
      <span className="text-xs text-emerald-300 font-light">
        Saved {relativeTime(state.at)}
      </span>
    );
  }
  if (state.kind === 'unsaved') {
    return (
      <span className="text-xs text-amber-300 font-light">Unsaved changes</span>
    );
  }
  if (state.kind === 'error') {
    return (
      <span className="text-xs text-red-300 font-light">
        Save failed — keep typing, we&apos;ll retry on the next interval ({state.message})
      </span>
    );
  }
  return null;
}

function Chip({ children }: { children: React.ReactNode }) {
  return (
    <span className="inline-block text-[11px] font-medium uppercase tracking-wider px-2 py-1 border bg-gray-50 text-gray-700 border-gray-200">
      {children}
    </span>
  );
}

function shortStage(stage: string): string {
  const m = stage.match(/^(Stage\s+\d+)/i);
  return m ? m[1] : stage;
}
