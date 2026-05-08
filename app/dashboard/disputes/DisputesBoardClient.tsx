'use client';

import { useEffect, useMemo, useState } from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { supabase } from '@/lib/supabase';
import {
  fetchUserDrafts,
  formatShortDate,
  logResponse,
  overdueState,
  relativeTime,
  RESPONSE_OUTCOMES,
  type DraftWithLetter,
  type ResponseOutcome,
  type OverdueState,
} from '@/lib/letterDrafts';

type Bucket = 'drafts' | 'mail' | 'response';

export default function DisputesBoardClient() {
  const router = useRouter();
  const [authChecked, setAuthChecked] = useState(false);
  const [drafts, setDrafts] = useState<DraftWithLetter[]>([]);
  const [missingTable, setMissingTable] = useState(false);
  const [missingResponseCols, setMissingResponseCols] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [logTarget, setLogTarget] = useState<DraftWithLetter | null>(null);
  const [toast, setToast] = useState<string | null>(null);

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
      const result = await fetchUserDrafts(u.id);
      if (cancelled) return;
      if (result.missingTable) setMissingTable(true);
      if (result.missingResponseCols) setMissingResponseCols(true);
      if (!result.missingTable && result.error) setError(result.error);
      setDrafts(result.drafts);
      setAuthChecked(true);
    })();
    return () => {
      cancelled = true;
    };
  }, [router]);

  useEffect(() => {
    if (!toast) return;
    const id = setTimeout(() => setToast(null), 6000);
    return () => clearTimeout(id);
  }, [toast]);

  const buckets = useMemo(() => bucketize(drafts), [drafts]);
  const total =
    buckets.drafts.length + buckets.mail.length + buckets.response.length;

  const onLogged = (updated: DraftWithLetter, outcome: ResponseOutcome) => {
    // Optimistic merge — replace the row in place; the memo re-buckets.
    setDrafts(prev => prev.map(d => (d.id === updated.id ? updated : d)));
    setLogTarget(null);
    const escalation =
      outcome === 'verified' || outcome === 'no_response'
        ? ' Consider escalating with Letter 2 (MOV) or Letter 46 (Round 3).'
        : '';
    setToast(`Response logged.${escalation}`);
  };

  return (
    <div className="min-h-screen bg-gray-50">
      <Nav active="disputes" />

      <main className="max-w-[1400px] mx-auto px-4 sm:px-8 py-8 sm:py-10">
        <header className="mb-6 sm:mb-8 p-6 sm:p-7 bg-gradient-to-br from-emerald-50 to-white border border-emerald-200">
          <p className="text-xs uppercase tracking-wider text-emerald-700 font-medium mb-2">
            Dispute board · {total} {total === 1 ? 'letter' : 'letters'}
          </p>
          <h1 className="text-2xl sm:text-3xl font-light text-gray-900 leading-snug">
            Every dispute. Every stage. One view.
          </h1>
          <p className="mt-2 text-sm sm:text-base text-gray-700 font-light">
            Drafts on the left. Letters mailed and waiting in the middle.
            Responses logged on the right.
          </p>
        </header>

        {toast && (
          <div className="mb-4 p-3 border border-emerald-300 bg-emerald-50 text-sm text-emerald-900">
            {toast}
          </div>
        )}

        {!authChecked ? (
          <p className="text-sm text-gray-600 font-light">Loading…</p>
        ) : missingTable ? (
          <SetupBanner kind="drafts" />
        ) : error ? (
          <div className="bg-red-50 border border-red-200 p-6">
            <p className="text-sm text-red-900 font-medium">
              Couldn&apos;t load the board: {error}
            </p>
          </div>
        ) : total === 0 ? (
          <AllEmptyState />
        ) : (
          <>
            {missingResponseCols && (
              <div className="mb-4 p-3 border border-amber-300 bg-amber-50 text-xs text-amber-900">
                Response-tracking columns aren&apos;t in Supabase yet. Apply{' '}
                <code className="font-mono">
                  supabase/migrations/20260508180000_response_tracking.sql
                </code>{' '}
                to enable Log Response.
              </div>
            )}
            <div className="grid grid-cols-1 lg:grid-cols-3 gap-4 sm:gap-5">
              <Column
                title="Drafts & ready"
                accent="gray"
                count={buckets.drafts.length}
                empty={
                  <EmptyCell
                    text="No drafts yet. Browse the Letter Library to start customizing."
                    cta={{ label: 'Open library', href: '/dashboard/letters' }}
                  />
                }
              >
                {buckets.drafts.map(d => (
                  <DraftsCard key={d.id} d={d} />
                ))}
              </Column>
              <Column
                title="In the mail"
                accent="amber"
                count={buckets.mail.length}
                empty={<EmptyCell text="No letters in flight." />}
              >
                {buckets.mail.map(d => (
                  <MailCard
                    key={d.id}
                    d={d}
                    onLogResponse={() => setLogTarget(d)}
                    disableLog={missingResponseCols}
                  />
                ))}
              </Column>
              <Column
                title="Response received"
                accent="emerald"
                count={buckets.response.length}
                empty={<EmptyCell text="No responses logged yet." />}
              >
                {buckets.response.map(d => (
                  <ResponseCard key={d.id} d={d} />
                ))}
              </Column>
            </div>
          </>
        )}
      </main>

      {logTarget && (
        <LogResponseModal
          draft={logTarget}
          onCancel={() => setLogTarget(null)}
          onLogged={onLogged}
          missingCols={missingResponseCols}
        />
      )}
    </div>
  );
}

// ── Buckets ────────────────────────────────────────────────────────
function bucketize(rows: DraftWithLetter[]) {
  const drafts: DraftWithLetter[] = [];
  const mail: DraftWithLetter[] = [];
  const response: DraftWithLetter[] = [];
  for (const d of rows) {
    if (d.response_received_at) {
      response.push(d);
      continue;
    }
    if (d.status === 'sent') {
      mail.push(d);
      continue;
    }
    if (d.status === 'draft' || d.status === 'finalized') {
      drafts.push(d);
    }
  }
  drafts.sort(
    (a, b) => new Date(b.updated_at).getTime() - new Date(a.updated_at).getTime(),
  );
  // Oldest mailed first — most likely overdue surface at the top.
  mail.sort((a, b) => {
    const ta = a.mailed_at ? new Date(a.mailed_at).getTime() : 0;
    const tb = b.mailed_at ? new Date(b.mailed_at).getTime() : 0;
    return ta - tb;
  });
  response.sort(
    (a, b) =>
      new Date(b.response_received_at as string).getTime() -
      new Date(a.response_received_at as string).getTime(),
  );
  return { drafts, mail, response };
}

// ── Layout ─────────────────────────────────────────────────────────

function Column({
  title,
  count,
  accent,
  empty,
  children,
}: {
  title: string;
  count: number;
  accent: 'gray' | 'amber' | 'emerald';
  empty: React.ReactNode;
  children: React.ReactNode;
}) {
  const headerCls =
    accent === 'amber'
      ? 'border-amber-200 bg-amber-50/60'
      : accent === 'emerald'
        ? 'border-emerald-200 bg-emerald-50/60'
        : 'border-gray-200 bg-gray-100';
  return (
    <section className="flex flex-col">
      <div className={`px-4 py-3 border ${headerCls}`}>
        <div className="flex items-center justify-between">
          <h2 className="text-xs uppercase tracking-wider text-gray-700 font-semibold">
            {title}
          </h2>
          <span className="text-xs text-gray-600 font-light">{count}</span>
        </div>
      </div>
      <div className="flex flex-col gap-3 mt-3">
        {count === 0 ? empty : children}
      </div>
    </section>
  );
}

function EmptyCell({
  text,
  cta,
}: {
  text: string;
  cta?: { label: string; href: string };
}) {
  return (
    <div className="bg-white border border-dashed border-gray-300 px-4 py-8 text-center">
      <p className="text-xs text-gray-600 font-light">{text}</p>
      {cta && (
        <Link
          href={cta.href}
          className="mt-3 inline-block text-xs px-3 py-1.5 bg-gray-900 text-white font-semibold hover:bg-gray-800 transition"
        >
          {cta.label} →
        </Link>
      )}
    </div>
  );
}

function AllEmptyState() {
  return (
    <div className="bg-white border border-gray-200 px-6 py-16 text-center">
      <p className="text-base text-gray-800 font-light mb-2">
        Your dispute board is empty.
      </p>
      <p className="text-sm text-gray-600 font-light mb-6">
        Start with the Letter Library to customize and mail your first letter.
      </p>
      <Link
        href="/dashboard/letters"
        className="inline-block text-sm px-5 py-3 bg-gray-900 text-white font-semibold hover:bg-gray-800 transition"
      >
        Open the library →
      </Link>
    </div>
  );
}

function SetupBanner({ kind }: { kind: 'drafts' }) {
  if (kind === 'drafts') {
    return (
      <div className="bg-amber-50 border border-amber-200 p-6 sm:p-8">
        <p className="text-xs uppercase tracking-wider text-amber-800 font-medium mb-2">
          Drafts table not yet applied
        </p>
        <p className="text-sm text-gray-800 font-light">
          Apply{' '}
          <code className="font-mono text-xs">
            supabase/migrations/20260508120000_letter_drafts.sql
          </code>{' '}
          and{' '}
          <code className="font-mono text-xs">
            supabase/migrations/20260508180000_response_tracking.sql
          </code>{' '}
          in the Supabase SQL Editor.
        </p>
      </div>
    );
  }
  return null;
}

// ── Cards ──────────────────────────────────────────────────────────

function CardShell({
  borderTone,
  children,
}: {
  borderTone: 'neutral' | 'amber' | 'red';
  children: React.ReactNode;
}) {
  const tone =
    borderTone === 'red'
      ? 'border-l-red-500'
      : borderTone === 'amber'
        ? 'border-l-amber-500'
        : 'border-l-gray-200';
  return (
    <div
      className={`bg-white border border-gray-200 border-l-4 ${tone} p-4 hover:border-gray-300 transition`}
    >
      {children}
    </div>
  );
}

function CardHeader({ d }: { d: DraftWithLetter }) {
  return (
    <div className="mb-2">
      <p className="text-[11px] uppercase tracking-wider text-gray-500 font-medium">
        Letter no. {d.letter_number}
      </p>
      <h3 className="text-sm font-semibold text-gray-900 leading-snug">
        {d.letter_title ?? `Letter ${d.letter_number}`}
      </h3>
    </div>
  );
}

function customizeHref(d: DraftWithLetter): string {
  return d.letter_id
    ? `/dashboard/letters/${d.letter_id}/customize`
    : '/dashboard/letters';
}

function DraftsCard({ d }: { d: DraftWithLetter }) {
  const isReady = d.status === 'finalized';
  return (
    <CardShell borderTone="neutral">
      <CardHeader d={d} />
      <p className="text-xs text-gray-600 font-light mb-3">
        Last edited {relativeTime(d.updated_at)}
      </p>
      <div className="flex items-center justify-between gap-3">
        <span
          className={`inline-block text-[11px] font-medium uppercase tracking-wider px-2 py-0.5 border ${
            isReady
              ? 'bg-blue-50 text-blue-800 border-blue-200'
              : 'bg-gray-100 text-gray-800 border-gray-200'
          }`}
        >
          {isReady ? 'Ready to mail' : 'Draft'}
        </span>
        <Link
          href={customizeHref(d)}
          className="text-xs px-3 py-1.5 bg-gray-900 text-white font-semibold hover:bg-gray-800 transition"
        >
          Continue editing →
        </Link>
      </div>
    </CardShell>
  );
}

function MailCard({
  d,
  onLogResponse,
  disableLog,
}: {
  d: DraftWithLetter;
  onLogResponse: () => void;
  disableLog: boolean;
}) {
  const od = overdueState(d.mailed_at);
  const tone: 'neutral' | 'amber' | 'red' =
    od?.kind === 'severely_overdue'
      ? 'red'
      : od?.kind === 'overdue'
        ? 'amber'
        : 'neutral';
  return (
    <CardShell borderTone={tone}>
      <CardHeader d={d} />
      <p className="text-xs text-gray-700 font-light">
        Mailed to {d.mailed_to ?? '—'}
        {d.mailed_at && ` · ${formatShortDate(d.mailed_at)}`}
      </p>
      {d.tracking_number && (
        <p className="text-xs text-gray-500 font-light font-mono mt-0.5 truncate">
          Tracking: {d.tracking_number}
        </p>
      )}
      <div className="mt-3">
        <MailPill state={od} />
      </div>
      {od?.kind === 'overdue' && (
        <p className="mt-2 text-xs text-amber-800 font-light leading-snug">
          FCRA § 1681i(a)(1)(A) deadline exceeded. Consider Letter 2.
        </p>
      )}
      {od?.kind === 'severely_overdue' && (
        <p className="mt-2 text-xs text-red-700 font-light leading-snug">
          Significantly overdue. Escalate to Letter 2 (MOV) or Letter 46
          (Round 3).
        </p>
      )}
      <div className="mt-3 flex flex-wrap gap-2">
        <button
          type="button"
          onClick={onLogResponse}
          disabled={disableLog}
          title={
            disableLog
              ? 'Apply the response_tracking migration to enable this.'
              : undefined
          }
          className="text-xs px-3 py-1.5 bg-gray-900 text-white font-semibold hover:bg-gray-800 disabled:opacity-50 disabled:cursor-not-allowed transition"
        >
          Log response →
        </button>
        {(od?.kind === 'overdue' || od?.kind === 'severely_overdue') && (
          <Link
            href="/dashboard/letters"
            className="text-xs px-3 py-1.5 border border-gray-300 text-gray-800 font-semibold hover:bg-gray-50 transition"
          >
            Escalate
          </Link>
        )}
      </div>
    </CardShell>
  );
}

function MailPill({ state }: { state: OverdueState | null }) {
  if (!state) {
    return (
      <span className="inline-block text-[11px] font-medium uppercase tracking-wider px-2 py-0.5 border bg-gray-100 text-gray-800 border-gray-200">
        In the mail
      </span>
    );
  }
  if (state.kind === 'in_window') {
    const dayNum = 30 - state.daysLeft;
    return (
      <span className="inline-block text-[11px] font-medium uppercase tracking-wider px-2 py-0.5 border bg-amber-50 text-amber-800 border-amber-200">
        In the mail · Day {dayNum} of 30
      </span>
    );
  }
  if (state.kind === 'overdue') {
    return (
      <span className="inline-block text-[11px] font-medium uppercase tracking-wider px-2 py-0.5 border bg-amber-100 text-amber-900 border-amber-300">
        ⚠ Overdue · {state.daysOver} {state.daysOver === 1 ? 'day' : 'days'}{' '}
        past
      </span>
    );
  }
  return (
    <span className="inline-block text-[11px] font-medium uppercase tracking-wider px-2 py-0.5 border bg-red-100 text-red-900 border-red-300">
      Severely overdue · {state.daysOver} days
    </span>
  );
}

function ResponseCard({ d }: { d: DraftWithLetter }) {
  return (
    <CardShell borderTone="neutral">
      <CardHeader d={d} />
      <p className="text-xs text-gray-700 font-light">
        Response received {formatShortDate(d.response_received_at)}
      </p>
      <div className="mt-2">
        <OutcomeLine outcome={d.response_outcome} />
      </div>
      {d.response_notes && (
        <p className="mt-2 text-xs text-gray-700 font-light italic line-clamp-3">
          &ldquo;{d.response_notes}&rdquo;
        </p>
      )}
      <div className="mt-3 flex justify-end">
        <Link
          href={customizeHref(d)}
          className="text-xs px-3 py-1.5 border border-gray-300 text-gray-800 font-semibold hover:bg-gray-50 transition"
        >
          View detail →
        </Link>
      </div>
    </CardShell>
  );
}

function OutcomeLine({ outcome }: { outcome: ResponseOutcome | null }) {
  if (outcome === 'deleted') {
    return (
      <p className="text-xs font-semibold text-emerald-800">
        ✓ Deleted — item removed
      </p>
    );
  }
  if (outcome === 'updated') {
    return (
      <p className="text-xs font-semibold text-blue-800">
        • Updated — partial win
      </p>
    );
  }
  if (outcome === 'verified') {
    return (
      <p className="text-xs font-semibold text-amber-800">
        — Verified — bureau says info stands
      </p>
    );
  }
  if (outcome === 'no_response') {
    return (
      <p className="text-xs font-semibold text-gray-600">
        — No response received in 30 days
      </p>
    );
  }
  if (outcome === 'other') {
    return <p className="text-xs font-semibold text-gray-700">• Other</p>;
  }
  return <p className="text-xs text-gray-500">Outcome not set</p>;
}

// ── Modal ──────────────────────────────────────────────────────────

function LogResponseModal({
  draft,
  onCancel,
  onLogged,
  missingCols,
}: {
  draft: DraftWithLetter;
  onCancel: () => void;
  onLogged: (updated: DraftWithLetter, outcome: ResponseOutcome) => void;
  missingCols: boolean;
}) {
  const todayIso = new Date().toISOString().slice(0, 10);
  const [date, setDate] = useState(todayIso);
  const [outcome, setOutcome] = useState<ResponseOutcome>('deleted');
  const [notes, setNotes] = useState('');
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const submit = async () => {
    if (busy) return;
    if (date > todayIso) {
      setError("The received date can't be in the future.");
      return;
    }
    setBusy(true);
    setError(null);
    const { data: sessionData } = await supabase.auth.getSession();
    const u = sessionData.session?.user;
    if (!u) {
      setBusy(false);
      setError('Not signed in.');
      return;
    }
    const r = await logResponse({
      userId: u.id,
      letterNumber: draft.letter_number,
      receivedAt: new Date(`${date}T00:00:00Z`).toISOString(),
      outcome,
      notes: notes.trim() === '' ? null : notes.trim(),
    });
    setBusy(false);
    if (r.missingCols) {
      setError(
        'Response-tracking columns are missing. Apply the response_tracking migration in Supabase first.',
      );
      return;
    }
    if (r.error || !r.draft) {
      setError(r.error ?? 'Could not log the response.');
      return;
    }
    onLogged(
      {
        ...draft,
        ...r.draft,
        // Keep the joined letter metadata.
        letter_id: draft.letter_id,
        letter_title: draft.letter_title,
        letter_stage: draft.letter_stage,
        letter_category: draft.letter_category,
      },
      outcome,
    );
  };

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 px-4"
      role="dialog"
      aria-modal="true"
      aria-labelledby="log-response-title"
    >
      <div className="bg-white border border-gray-200 w-full max-w-lg p-6 sm:p-7 max-h-[90vh] overflow-y-auto">
        <h3
          id="log-response-title"
          className="text-lg font-semibold text-gray-900"
        >
          Log a response to Letter {draft.letter_number}
        </h3>
        <p className="mt-1 text-xs text-gray-600 font-light">
          {draft.letter_title}
        </p>

        {missingCols && (
          <div className="mt-4 p-3 border border-amber-200 bg-amber-50 text-xs text-amber-900">
            Response-tracking columns aren&apos;t in Supabase yet. Apply the
            response_tracking migration first.
          </div>
        )}

        <div className="mt-5">
          <label
            htmlFor="response-date"
            className="block text-xs uppercase tracking-wider text-gray-500 mb-2"
          >
            Date response received
          </label>
          <input
            id="response-date"
            type="date"
            value={date}
            max={todayIso}
            onChange={e => setDate(e.target.value)}
            className="px-3 py-2 text-sm border border-gray-300 focus:outline-none focus:border-emerald-500"
          />
        </div>

        <fieldset className="mt-5">
          <legend className="text-xs uppercase tracking-wider text-gray-500 mb-2">
            Outcome
          </legend>
          <div className="space-y-2">
            {RESPONSE_OUTCOMES.map(o => (
              <label
                key={o.value}
                className="flex items-start gap-3 text-sm text-gray-800 cursor-pointer"
              >
                <input
                  type="radio"
                  name="outcome"
                  value={o.value}
                  checked={outcome === o.value}
                  onChange={() => setOutcome(o.value)}
                  className="mt-0.5 accent-emerald-600"
                />
                <span>
                  <span className="font-medium">{o.label}</span>
                  {o.hint && (
                    <span className="text-gray-600 font-light"> — {o.hint}</span>
                  )}
                </span>
              </label>
            ))}
          </div>
        </fieldset>

        <div className="mt-5">
          <label
            htmlFor="response-notes"
            className="block text-xs uppercase tracking-wider text-gray-500 mb-2"
          >
            Notes (optional)
          </label>
          <textarea
            id="response-notes"
            value={notes}
            onChange={e => setNotes(e.target.value)}
            rows={4}
            placeholder="What did the bureau say? Note any reference numbers or dispute IDs from their letter."
            className="w-full px-3 py-2 text-sm border border-gray-300 focus:outline-none focus:border-emerald-500 resize-y"
          />
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
            disabled={busy || missingCols}
            className="text-sm px-5 py-2 bg-gray-900 text-white font-semibold hover:bg-gray-800 disabled:opacity-50 disabled:cursor-not-allowed transition"
          >
            {busy ? 'Saving…' : 'Log response'}
          </button>
        </div>
      </div>
    </div>
  );
}

// ── Nav ────────────────────────────────────────────────────────────

function Nav({
  active,
}: {
  active: 'dashboard' | 'disputes' | 'library' | 'my-letters';
}) {
  const navItems: Array<{
    key: 'dashboard' | 'disputes' | 'library' | 'my-letters';
    href: string;
    label: string;
  }> = [
    { key: 'dashboard', href: '/dashboard', label: 'Dashboard' },
    { key: 'disputes', href: '/dashboard/disputes', label: 'Disputes' },
    { key: 'library', href: '/dashboard/letters', label: 'Letter library' },
    { key: 'my-letters', href: '/dashboard/my-letters', label: 'My letters' },
  ];
  return (
    <nav className="border-b border-gray-200 bg-white sticky top-0 z-40">
      <div className="max-w-[1400px] mx-auto px-4 sm:px-8 py-4 sm:py-5 flex justify-between items-center">
        <div className="flex items-center gap-6">
          <Link
            href="/dashboard"
            className="text-xl sm:text-2xl font-light tracking-tight text-gray-800"
          >
            Credit<span className="font-semibold">Reclaim</span>
          </Link>
          <span className="hidden sm:inline-block text-xs uppercase tracking-wider text-gray-500 px-2 py-1 border border-gray-200">
            Dispute board
          </span>
        </div>
        <div className="flex items-center gap-4 sm:gap-6">
          {navItems.map(n => (
            <Link
              key={n.key}
              href={n.href}
              className={`text-sm font-medium ${
                active === n.key
                  ? 'text-gray-900 font-semibold'
                  : 'text-gray-600 hover:text-gray-800'
              }`}
            >
              {n.label}
            </Link>
          ))}
        </div>
      </div>
    </nav>
  );
}
