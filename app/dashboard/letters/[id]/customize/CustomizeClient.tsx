'use client';

import { useCallback, useEffect, useRef, useState } from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { supabase } from '@/lib/supabase';
import {
  applyBracketReplacer,
  BUREAU_CHOICES,
  fetchDraft,
  fetchUserCredits,
  formatShortDate,
  identityFromCredits,
  markDraftAsMailed,
  relativeTime,
  upsertDraft,
  type BureauChoice,
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
  const [mailModalOpen, setMailModalOpen] = useState(false);
  const [mailBusy, setMailBusy] = useState(false);
  const [mailError, setMailError] = useState<string | null>(null);
  const [toast, setToast] = useState<string | null>(null);

  const isSent = draft?.status === 'sent';
  const hasFinalized = draft?.status === 'finalized' || draft?.status === 'sent';

  // Always read the latest values out of refs inside async callbacks
  // (effects, autosave, beforeunload) so we never write stale text back.
  const bodyRef = useRef(body);
  const savedBodyRef = useRef(savedBody);
  const userIdRef = useRef(userId);
  // Cached JWT for the keepalive fetch on tab close — beforeunload can't
  // await, so we keep the token current via onAuthStateChange and read
  // it synchronously at exit. Without this, the PostgREST upsert hits
  // RLS as the anon role and is rejected silently.
  const accessTokenRef = useRef<string | null>(null);
  useEffect(() => { bodyRef.current = body; }, [body]);
  useEffect(() => { savedBodyRef.current = savedBody; }, [savedBody]);
  useEffect(() => { userIdRef.current = userId; }, [userId]);

  useEffect(() => {
    let cancelled = false;
    void supabase.auth.getSession().then(({ data }) => {
      if (!cancelled) accessTokenRef.current = data.session?.access_token ?? null;
    });
    const { data: sub } = supabase.auth.onAuthStateChange((_event, session) => {
      accessTokenRef.current = session?.access_token ?? null;
    });
    return () => {
      cancelled = true;
      sub.subscription.unsubscribe();
    };
  }, []);

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

  // ── Autosave on tab/window close (best-effort keepalive fetch) ───
  useEffect(() => {
    if (!authChecked || missingTable) return;
    const onBeforeUnload = () => {
      if (bodyRef.current === savedBodyRef.current) return;
      const uid = userIdRef.current;
      const accessToken = accessTokenRef.current;
      // No JWT = no insert under RLS (auth.uid() = user_id). Skip rather
      // than fire a request that will be rejected silently.
      if (!uid || !accessToken) return;
      const url = `${process.env.NEXT_PUBLIC_SUPABASE_URL}/rest/v1/letter_drafts?on_conflict=user_id,letter_number`;
      const body = JSON.stringify({
        user_id: uid,
        letter_number: letterNumber,
        customized_body: bodyRef.current,
        status: 'draft',
      });
      // sendBeacon can't set custom headers, so we use keepalive fetch.
      // Both apikey (project) and Authorization (user JWT) are required
      // — PostgREST authenticates with the JWT, then RLS matches user_id.
      try {
        const anonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY ?? '';
        void fetch(url, {
          method: 'POST',
          mode: 'cors',
          credentials: 'omit',
          keepalive: true,
          headers: {
            apikey: anonKey,
            Authorization: `Bearer ${accessToken}`,
            'Content-Type': 'application/json',
            Prefer: 'resolution=merge-duplicates',
          },
          body,
        });
      } catch {
        // best-effort; the 30s interval autosave + onBlur covers the
        // common case, this only narrows the window for the last edit.
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

  const onSendAnother = useCallback(() => {
    router.push('/dashboard/letters');
  }, [router]);

  const onMarkAsMailedSubmit = useCallback(
    async (args: {
      mailedTo: string;
      mailedAt: string;
      trackingNumber: string | null;
    }) => {
      const uid = userIdRef.current;
      if (!uid) return;
      setMailBusy(true);
      setMailError(null);
      const { draft: updated, error } = await markDraftAsMailed({
        userId: uid,
        letterNumber,
        mailedTo: args.mailedTo,
        mailedAt: args.mailedAt,
        trackingNumber: args.trackingNumber,
      });
      setMailBusy(false);
      if (error || !updated) {
        setMailError(error ?? 'Could not mark as mailed.');
        return;
      }
      setDraft(updated);
      setMailModalOpen(false);
      setToast(
        'Letter marked as mailed. Bureau response expected within 30 days under FCRA § 1681i(a)(1)(A).',
      );
    },
    [letterNumber],
  );

  // Auto-dismiss the success toast.
  useEffect(() => {
    if (!toast) return;
    const id = setTimeout(() => setToast(null), 6000);
    return () => clearTimeout(id);
  }, [toast]);

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

        {toast && (
          <div className="mb-3 p-3 border border-emerald-300 bg-emerald-50 text-sm text-emerald-900 print:hidden">
            {toast}
          </div>
        )}

        {isSent ? (
          <div className="sticky top-[64px] z-30 -mx-4 sm:mx-0 bg-emerald-700 text-white border border-emerald-700 px-4 sm:px-5 py-3 flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3 print:hidden no-print">
            <div className="min-w-0">
              <p className="text-xs uppercase tracking-wider text-emerald-100 font-medium">
                Sent
              </p>
              <p className="text-sm font-medium">
                Mailed to {draft?.mailed_to ?? '—'} on{' '}
                {formatShortDate(draft?.mailed_at ?? null)}. Awaiting response.
              </p>
              {draft?.tracking_number && (
                <p className="text-xs text-emerald-100 font-light mt-0.5">
                  Tracking: {draft.tracking_number}
                </p>
              )}
            </div>
            <div className="flex flex-wrap gap-2">
              <button
                type="button"
                onClick={onSendAnother}
                className="text-xs px-3 py-2 bg-white text-gray-900 font-semibold hover:bg-gray-100 transition"
              >
                Send another
              </button>
              <button
                type="button"
                onClick={onBackToLibrary}
                className="text-xs px-3 py-2 font-medium text-emerald-100 hover:text-white"
              >
                ← Back to library
              </button>
            </div>
          </div>
        ) : (
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
                onClick={() => setMailModalOpen(true)}
                disabled={!hasFinalized}
                title={hasFinalized ? undefined : 'Print the letter first.'}
                className="text-xs px-3 py-2 bg-blue-500 text-white font-semibold hover:bg-blue-400 disabled:bg-gray-700 disabled:text-gray-400 disabled:cursor-not-allowed transition"
              >
                Mark as mailed
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
        )}

        <p className="mt-3 mb-2 text-xs text-gray-600 font-light print:hidden">
          {isSent ? (
            <span className="text-emerald-800">
              This letter is locked — the text below is the record of what
              you mailed. Click <span className="font-semibold">Send another</span>{' '}
              to start a different letter.
            </span>
          ) : (
            <>
              Identity brackets like{' '}
              <code className="font-mono">[Your Full Legal Name]</code> get
              pre-filled where we have data; account-specific brackets like{' '}
              <code className="font-mono">[Account Number]</code> are yours to
              fill in.
            </>
          )}
        </p>

        <div className="bg-white border border-gray-200 print:border-0">
          <textarea
            value={body}
            onChange={e => setBody(e.target.value)}
            onBlur={onBlur}
            spellCheck={true}
            readOnly={isSent}
            className={`w-full min-h-[70vh] px-4 sm:px-8 py-6 sm:py-8 text-sm sm:text-[15px] leading-7 text-gray-900 font-mono whitespace-pre-wrap focus:outline-none resize-y print:hidden ${
              isSent ? 'bg-gray-50 cursor-default' : ''
            }`}
          />
          <div
            className="print-letter-body hidden print:block whitespace-pre-wrap"
            aria-hidden="true"
          >
{body}
          </div>
        </div>

        <p className="mt-4 text-xs text-gray-500 font-light print:hidden">
          {isSent
            ? `Sent — locked record of what you mailed.`
            : draft
              ? `Draft saved — status: ${draft.status}`
              : 'No draft saved yet — your edits will save automatically every 30 seconds.'}
        </p>
      </main>

      {mailModalOpen && (
        <MarkAsMailedModal
          busy={mailBusy}
          error={mailError}
          onCancel={() => {
            setMailModalOpen(false);
            setMailError(null);
          }}
          onSubmit={onMarkAsMailedSubmit}
        />
      )}

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

function MarkAsMailedModal({
  busy,
  error,
  onCancel,
  onSubmit,
}: {
  busy: boolean;
  error: string | null;
  onCancel: () => void;
  onSubmit: (args: {
    mailedTo: string;
    mailedAt: string;
    trackingNumber: string | null;
  }) => void | Promise<void>;
}) {
  const todayIso = new Date().toISOString().slice(0, 10);
  const [bureau, setBureau] = useState<BureauChoice>('Equifax');
  const [otherText, setOtherText] = useState('');
  const [tracking, setTracking] = useState('');
  const [mailedDate, setMailedDate] = useState(todayIso);

  const recipient =
    bureau === 'Other' ? otherText.trim() : (bureau as string);
  const submitDisabled =
    busy || !recipient || !mailedDate || isFutureDate(mailedDate);

  const submit = () => {
    if (submitDisabled) return;
    void onSubmit({
      mailedTo: recipient,
      mailedAt: new Date(`${mailedDate}T00:00:00Z`).toISOString(),
      trackingNumber: tracking.trim() === '' ? null : tracking.trim(),
    });
  };

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 px-4 print:hidden"
      role="dialog"
      aria-modal="true"
      aria-labelledby="mark-as-mailed-title"
    >
      <div className="bg-white border border-gray-200 w-full max-w-lg p-6 sm:p-7">
        <h3
          id="mark-as-mailed-title"
          className="text-lg font-semibold text-gray-900"
        >
          Mark this letter as mailed
        </h3>
        <p className="mt-1 text-xs text-gray-600 font-light">
          Once marked, this draft locks as a record of what you mailed.
        </p>

        <fieldset className="mt-5">
          <legend className="text-xs uppercase tracking-wider text-gray-500 mb-2">
            Who did you mail it to?
          </legend>
          <div className="space-y-2">
            {([...BUREAU_CHOICES, 'Other'] as BureauChoice[]).map(opt => (
              <label
                key={opt}
                className="flex items-center gap-3 text-sm text-gray-800 cursor-pointer"
              >
                <input
                  type="radio"
                  name="bureau"
                  value={opt}
                  checked={bureau === opt}
                  onChange={() => setBureau(opt)}
                  className="accent-emerald-600"
                />
                <span>{opt}</span>
                {opt === 'Other' && bureau === 'Other' && (
                  <input
                    type="text"
                    autoFocus
                    value={otherText}
                    onChange={e => setOtherText(e.target.value)}
                    placeholder="e.g. Midland Funding LLC"
                    className="flex-1 ml-2 px-2 py-1 text-sm border border-gray-300 focus:outline-none focus:border-emerald-500"
                  />
                )}
              </label>
            ))}
          </div>
        </fieldset>

        <div className="mt-5">
          <label
            htmlFor="tracking"
            className="block text-xs uppercase tracking-wider text-gray-500 mb-2"
          >
            Tracking number (optional)
          </label>
          <input
            id="tracking"
            type="text"
            value={tracking}
            onChange={e => setTracking(e.target.value)}
            placeholder="9400 1000 0000 0000 0000 00"
            className="w-full px-3 py-2 text-sm border border-gray-300 focus:outline-none focus:border-emerald-500 font-mono"
          />
          <p className="mt-1 text-xs text-gray-600 font-light">
            Found on your USPS Certified Mail receipt. Add it later if you
            don&apos;t have it yet.
          </p>
        </div>

        <div className="mt-5">
          <label
            htmlFor="mailed-date"
            className="block text-xs uppercase tracking-wider text-gray-500 mb-2"
          >
            Date mailed
          </label>
          <input
            id="mailed-date"
            type="date"
            value={mailedDate}
            max={todayIso}
            onChange={e => setMailedDate(e.target.value)}
            className="px-3 py-2 text-sm border border-gray-300 focus:outline-none focus:border-emerald-500"
          />
          {isFutureDate(mailedDate) && (
            <p className="mt-1 text-xs text-red-700">
              The mailed date can&apos;t be in the future.
            </p>
          )}
        </div>

        {error && (
          <p className="mt-4 text-sm text-red-700 font-medium">{error}</p>
        )}

        <div className="mt-6 flex items-center justify-end gap-3">
          <button
            type="button"
            onClick={onCancel}
            disabled={busy}
            className="text-sm px-4 py-2 text-gray-700 hover:text-gray-900 font-medium disabled:opacity-50"
          >
            Cancel
          </button>
          <button
            type="button"
            onClick={submit}
            disabled={submitDisabled}
            className="text-sm px-5 py-2 bg-gray-900 text-white font-semibold hover:bg-gray-800 disabled:opacity-50 disabled:cursor-not-allowed transition"
          >
            {busy ? 'Saving…' : 'Mark as mailed'}
          </button>
        </div>
      </div>
    </div>
  );
}

function isFutureDate(yyyyMmDd: string): boolean {
  const today = new Date().toISOString().slice(0, 10);
  return yyyyMmDd > today;
}
