'use client';

import { useEffect, useMemo } from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import {
  useDashboardData,
  type Dispute,
  type DisputeResponse,
  type Recommendation,
} from '@/lib/hooks/useDashboardData';

const ACTIVE_STATUSES = new Set(['draft', 'sent', 'in_review', 'responded']);

export default function DashboardPage() {
  const router = useRouter();
  const {
    user,
    credits,
    disputes,
    responses,
    recommendations,
    loading,
    error,
    refetch,
  } = useDashboardData();

  // Redirect to login if no session and not still loading.
  useEffect(() => {
    if (!loading && !user) {
      router.push('/login');
    }
  }, [loading, user, router]);

  const tier = (credits?.tier ?? 'diy').toLowerCase();
  const isManaged = tier === 'managed';

  const activeDisputes = useMemo(
    () => disputes.filter(d => ACTIVE_STATUSES.has(d.status)),
    [disputes],
  );
  const draftDisputes = useMemo(
    () => disputes.filter(d => d.status === 'draft'),
    [disputes],
  );
  const wonDisputes = useMemo(
    () => disputes.filter(d => d.status === 'removed'),
    [disputes],
  );
  const recentResponses = useMemo(() => responses.slice(0, 5), [responses]);

  const currentScore = credits?.current_score ?? 0;
  const initialScore = credits?.initial_score ?? null;
  const scoreDelta =
    initialScore != null && credits?.current_score != null
      ? credits.current_score - initialScore
      : null;
  const removedCount = credits?.removed_count ?? wonDisputes.length;

  return (
    <div className="min-h-screen bg-gray-50">
      <DashboardNav email={user?.email ?? ''} tier={tier} />

      <main className="max-w-7xl mx-auto px-4 sm:px-8 py-8 sm:py-12">
        {error && (
          <div className="mb-8 p-4 border border-red-300 bg-red-50">
            <p className="text-sm text-red-900 font-medium">{error}</p>
            <button
              onClick={refetch}
              className="mt-2 text-sm text-red-900 underline font-medium"
            >
              Retry
            </button>
          </div>
        )}

        {loading && !credits && disputes.length === 0 ? (
          <div className="py-24 text-center text-gray-600 font-light">
            Loading your dashboard…
          </div>
        ) : (
          <>
            {/* Top: counters */}
            <section className="grid grid-cols-1 sm:grid-cols-3 gap-4 sm:gap-6 mb-10">
              <ScoreCard
                currentScore={currentScore}
                delta={scoreDelta}
              />
              <CounterCard
                label="Items removed"
                value={removedCount}
                hint="Negative items off your report"
              />
              <CounterCard
                label="Disputes won"
                value={wonDisputes.length}
                hint={`${activeDisputes.length} still in flight`}
              />
            </section>

            {/* Middle: active disputes + recommended letters + recent responses */}
            <section className="grid grid-cols-1 lg:grid-cols-3 gap-6 mb-10">
              <div className="lg:col-span-2">
                <ActiveDisputesPanel
                  disputes={activeDisputes}
                  isManaged={isManaged}
                  onChange={refetch}
                />
              </div>
              <div className="lg:col-span-1 flex flex-col gap-6">
                <RecommendedLettersPanel
                  draftDisputes={draftDisputes}
                  isManaged={isManaged}
                />
                <RecentResponsesPanel responses={recentResponses} />
              </div>
            </section>

            {/* Bottom: recommendations */}
            <section>
              <RecommendationsPanel recommendations={recommendations} />
            </section>

            {isManaged && (
              <section className="mt-10">
                <ManagedActivityLog disputes={disputes} responses={responses} />
              </section>
            )}
          </>
        )}
      </main>
    </div>
  );
}

// ── Components ─────────────────────────────────────────────────────

function DashboardNav({ email, tier }: { email: string; tier: string }) {
  return (
    <nav className="border-b border-gray-200 bg-white sticky top-0 z-40">
      <div className="max-w-7xl mx-auto px-4 sm:px-8 py-4 sm:py-5 flex justify-between items-center">
        <div className="flex items-center gap-6">
          <Link
            href="/"
            className="text-xl sm:text-2xl font-light tracking-tight text-gray-800"
          >
            Credit<span className="font-semibold">Reclaim</span>
          </Link>
          <span className="hidden sm:inline-block text-xs uppercase tracking-wider text-gray-500 px-2 py-1 border border-gray-200">
            {tier === 'managed' ? 'Managed' : 'DIY'}
          </span>
        </div>
        <div className="flex items-center gap-4 sm:gap-6">
          {email && (
            <span className="hidden sm:inline text-sm text-gray-600 font-light">
              {email}
            </span>
          )}
          <Link
            href="/dashboard"
            className="text-sm text-gray-600 hover:text-gray-800 font-medium"
          >
            Dashboard
          </Link>
        </div>
      </div>
    </nav>
  );
}

function ScoreCard({
  currentScore,
  delta,
}: {
  currentScore: number;
  delta: number | null;
}) {
  const deltaText =
    delta == null
      ? 'Tracking…'
      : delta === 0
        ? 'No change yet'
        : `${delta > 0 ? '+' : ''}${delta} since you started`;
  const deltaColor =
    delta == null
      ? 'text-gray-500'
      : delta > 0
        ? 'text-green-700'
        : delta < 0
          ? 'text-red-700'
          : 'text-gray-500';
  return (
    <div className="bg-white border border-gray-200 p-6">
      <div className="text-xs uppercase tracking-wider text-gray-500 mb-3">
        Credit score
      </div>
      <div className="text-4xl sm:text-5xl font-light text-gray-800">
        {currentScore || '—'}
      </div>
      <div className={`mt-3 text-sm font-light ${deltaColor}`}>{deltaText}</div>
    </div>
  );
}

function CounterCard({
  label,
  value,
  hint,
}: {
  label: string;
  value: number;
  hint?: string;
}) {
  return (
    <div className="bg-white border border-gray-200 p-6">
      <div className="text-xs uppercase tracking-wider text-gray-500 mb-3">
        {label}
      </div>
      <div className="text-4xl sm:text-5xl font-light text-gray-800">{value}</div>
      {hint && (
        <div className="mt-3 text-sm text-gray-600 font-light">{hint}</div>
      )}
    </div>
  );
}

function ActiveDisputesPanel({
  disputes,
  isManaged,
  onChange,
}: {
  disputes: Dispute[];
  isManaged: boolean;
  onChange: () => Promise<void>;
}) {
  return (
    <div className="bg-white border border-gray-200">
      <div className="flex items-center justify-between px-6 py-4 border-b border-gray-200">
        <h2 className="text-lg font-semibold text-gray-800">Active disputes</h2>
        <span className="text-xs text-gray-500">{disputes.length} open</span>
      </div>
      {disputes.length === 0 ? (
        <div className="px-6 py-12 text-center text-sm text-gray-600 font-light">
          No active disputes yet.
          {isManaged
            ? " We'll start the first round shortly."
            : ' Draft your first letter from the recommendations panel.'}
        </div>
      ) : (
        <ul className="divide-y divide-gray-200">
          {disputes.map(d => (
            <li key={d.id} className="px-6 py-4 hover:bg-gray-50 transition">
              <Link
                href={`/dashboard/dispute/${d.id}`}
                className="flex items-start justify-between gap-4"
              >
                <div className="min-w-0">
                  <p className="text-sm font-medium text-gray-800 truncate">
                    {d.creditor_name || 'Unknown creditor'}
                  </p>
                  <p className="text-xs text-gray-600 font-light mt-1">
                    {d.dispute_type || 'General dispute'}
                    {d.account_number && ` · acct ending ${last4(d.account_number)}`}
                  </p>
                </div>
                <StatusBadge status={d.status} />
              </Link>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}

function RecommendedLettersPanel({
  draftDisputes,
  isManaged,
}: {
  draftDisputes: Dispute[];
  isManaged: boolean;
}) {
  return (
    <div className="bg-white border border-gray-200">
      <div className="px-6 py-4 border-b border-gray-200">
        <h2 className="text-lg font-semibold text-gray-800">
          Recommended letters
        </h2>
      </div>
      {draftDisputes.length === 0 ? (
        <div className="px-6 py-8 text-sm text-gray-600 font-light text-center">
          No drafts ready to send.
        </div>
      ) : (
        <ul className="divide-y divide-gray-200">
          {draftDisputes.slice(0, 5).map(d => (
            <li key={d.id} className="px-6 py-4">
              <p className="text-sm font-medium text-gray-800 truncate">
                {d.creditor_name || 'Unknown creditor'}
              </p>
              <p className="text-xs text-gray-600 font-light mt-1 mb-3">
                {d.dispute_type || 'General dispute'}
              </p>
              {isManaged ? (
                <p className="text-xs text-gray-500 font-light">
                  Queued for our team
                </p>
              ) : (
                <Link
                  href={`/dashboard/dispute/${d.id}`}
                  className="inline-block text-xs px-3 py-2 bg-gray-800 text-white font-medium hover:bg-gray-700 transition"
                >
                  Review &amp; send
                </Link>
              )}
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}

function RecentResponsesPanel({ responses }: { responses: DisputeResponse[] }) {
  return (
    <div className="bg-white border border-gray-200">
      <div className="px-6 py-4 border-b border-gray-200">
        <h2 className="text-lg font-semibold text-gray-800">Recent responses</h2>
      </div>
      {responses.length === 0 ? (
        <div className="px-6 py-8 text-sm text-gray-600 font-light text-center">
          No responses received yet.
        </div>
      ) : (
        <ul className="divide-y divide-gray-200">
          {responses.map(r => (
            <li key={r.id} className="px-6 py-4">
              <div className="flex items-center justify-between mb-1">
                <p className="text-sm font-medium text-gray-800 truncate">
                  {r.bureau_name || 'Bureau'}
                </p>
                <p className="text-xs text-gray-500 font-light">
                  {formatDate(r.received_date)}
                </p>
              </div>
              {r.content && (
                <p className="text-xs text-gray-600 font-light line-clamp-2">
                  {r.content}
                </p>
              )}
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}

function RecommendationsPanel({
  recommendations,
}: {
  recommendations: Recommendation[];
}) {
  return (
    <div className="bg-white border border-gray-200">
      <div className="px-6 py-4 border-b border-gray-200">
        <h2 className="text-lg font-semibold text-gray-800">Recommendations</h2>
        <p className="text-xs text-gray-600 font-light mt-1">
          SOL expirations, age-offs, and your next best actions.
        </p>
      </div>
      {recommendations.length === 0 ? (
        <div className="px-6 py-12 text-center text-sm text-gray-600 font-light">
          No recommendations right now. New ones appear as your file evolves.
        </div>
      ) : (
        <ul className="divide-y divide-gray-200">
          {recommendations.map(r => (
            <li key={r.id} className="px-6 py-4">
              <div className="flex items-start justify-between gap-4">
                <div className="min-w-0">
                  <p className="text-sm font-medium text-gray-800">
                    {r.title || r.type || 'Recommendation'}
                  </p>
                  {r.description && (
                    <p className="text-xs text-gray-600 font-light mt-1">
                      {r.description}
                    </p>
                  )}
                </div>
                {r.type && (
                  <span className="shrink-0 text-[10px] uppercase tracking-wider text-gray-500 px-2 py-1 border border-gray-200">
                    {r.type}
                  </span>
                )}
              </div>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}

function ManagedActivityLog({
  disputes,
  responses,
}: {
  disputes: Dispute[];
  responses: DisputeResponse[];
}) {
  // Build a unified, time-sorted feed of "what we did" — sends, responses, removals.
  type Event = { ts: string; label: string; detail: string };
  const events: Event[] = [];
  for (const d of disputes) {
    if (d.letter_sent_date) {
      events.push({
        ts: d.letter_sent_date,
        label: 'Letter sent',
        detail: `${d.creditor_name || 'Creditor'} · ${d.dispute_type || 'dispute'}`,
      });
    }
    if (d.removed_date) {
      events.push({
        ts: d.removed_date,
        label: 'Item removed',
        detail: `${d.creditor_name || 'Creditor'}`,
      });
    }
  }
  for (const r of responses) {
    if (r.received_date) {
      events.push({
        ts: r.received_date,
        label: 'Response received',
        detail: r.bureau_name || 'Bureau',
      });
    }
  }
  events.sort((a, b) => (a.ts < b.ts ? 1 : -1));

  return (
    <div className="bg-white border border-gray-200">
      <div className="px-6 py-4 border-b border-gray-200">
        <h2 className="text-lg font-semibold text-gray-800">Activity log</h2>
        <p className="text-xs text-gray-600 font-light mt-1">
          What our team has done on your behalf.
        </p>
      </div>
      {events.length === 0 ? (
        <div className="px-6 py-12 text-center text-sm text-gray-600 font-light">
          No activity yet.
        </div>
      ) : (
        <ul className="divide-y divide-gray-200">
          {events.slice(0, 20).map((e, i) => (
            <li key={i} className="px-6 py-4 flex items-center justify-between">
              <div>
                <p className="text-sm font-medium text-gray-800">{e.label}</p>
                <p className="text-xs text-gray-600 font-light mt-1">{e.detail}</p>
              </div>
              <p className="text-xs text-gray-500 font-light">{formatDate(e.ts)}</p>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}

function StatusBadge({ status }: { status: string }) {
  const map: Record<string, { label: string; cls: string }> = {
    draft: { label: 'Draft', cls: 'border-gray-300 text-gray-700 bg-gray-50' },
    sent: { label: 'Sent', cls: 'border-blue-300 text-blue-800 bg-blue-50' },
    in_review: {
      label: 'In review',
      cls: 'border-yellow-300 text-yellow-800 bg-yellow-50',
    },
    responded: {
      label: 'Responded',
      cls: 'border-purple-300 text-purple-800 bg-purple-50',
    },
    removed: {
      label: 'Removed',
      cls: 'border-green-300 text-green-800 bg-green-50',
    },
    rejected: {
      label: 'Rejected',
      cls: 'border-red-300 text-red-800 bg-red-50',
    },
  };
  const m = map[status] ?? {
    label: status,
    cls: 'border-gray-300 text-gray-700 bg-gray-50',
  };
  return (
    <span
      className={`shrink-0 text-[11px] font-medium uppercase tracking-wider px-2 py-1 border ${m.cls}`}
    >
      {m.label}
    </span>
  );
}

function last4(value: string): string {
  return value.length <= 4 ? value : value.slice(-4);
}

function formatDate(value: string | null): string {
  if (!value) return '—';
  const d = new Date(value);
  if (Number.isNaN(d.getTime())) return '—';
  return d.toLocaleDateString(undefined, {
    month: 'short',
    day: 'numeric',
    year: 'numeric',
  });
}
