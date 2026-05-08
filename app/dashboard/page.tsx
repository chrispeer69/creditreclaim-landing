'use client';

import { useEffect, useMemo } from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import {
  useDashboardData,
  type Dispute,
  type DisputeResponse,
  type LetterSuggestion,
  type Recommendation,
} from '@/lib/hooks/useDashboardData';

// FCRA §611 gives bureaus 30 days from receipt of dispute to respond.
const FCRA_RESPONSE_DAYS = 30;
// Most negative items must drop off after 7 years under FCRA §605.
const CLEAN_SLATE_YEARS = 7;

const ACTIVE_STATUSES = new Set(['draft', 'sent', 'in_review', 'responded']);
const IN_FLIGHT_STATUSES = new Set(['sent', 'in_review', 'responded']);

type Tone = 'green' | 'amber' | 'neutral';

export default function DashboardPage() {
  const router = useRouter();
  const {
    user,
    credits,
    disputes,
    responses,
    recommendations,
    suggestedLetters,
    lettersInFlight,
    loading,
    error,
    refetch,
  } = useDashboardData();

  useEffect(() => {
    if (!loading && !user) router.push('/login');
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
  const inFlightDisputes = useMemo(
    () => disputes.filter(d => IN_FLIGHT_STATUSES.has(d.status)),
    [disputes],
  );
  const wonDisputes = useMemo(
    () => disputes.filter(d => d.status === 'removed'),
    [disputes],
  );
  const removedThisMonth = useMemo(
    () => wonDisputes.filter(d => isThisMonth(d.removed_date)).length,
    [wonDisputes],
  );
  const recentResponses = useMemo(() => responses.slice(0, 4), [responses]);

  const currentScore = credits?.current_score ?? 0;
  const initialScore = credits?.initial_score ?? null;
  const scoreDelta =
    initialScore != null && credits?.current_score != null
      ? credits.current_score - initialScore
      : null;
  const removedCount = credits?.removed_count ?? wonDisputes.length;

  const oldestDisputeMs = useMemo(() => {
    const times = disputes
      .map(d => d.created_at)
      .filter((s): s is string => !!s)
      .map(s => new Date(s).getTime())
      .filter(t => !Number.isNaN(t));
    return times.length === 0 ? null : Math.min(...times);
  }, [disputes]);

  const cleanSlateMonths = useMemo(() => {
    if (oldestDisputeMs == null) return null;
    const targetMs =
      oldestDisputeMs + CLEAN_SLATE_YEARS * 365.25 * 24 * 60 * 60 * 1000;
    const remaining = targetMs - Date.now();
    if (remaining <= 0) return 0;
    return Math.round(remaining / (1000 * 60 * 60 * 24 * 30.4375));
  }, [oldestDisputeMs]);

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
            <StoryHook
              currentScore={currentScore}
              initialScore={initialScore}
              delta={scoreDelta}
              removedCount={removedCount}
              activeCount={activeDisputes.length}
              isManaged={isManaged}
            />

            <section className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4 sm:gap-6 mb-10">
              <ScoreCard
                currentScore={currentScore}
                initialScore={initialScore}
                delta={scoreDelta}
              />
              <CelebrationTile
                label="Removed this month"
                value={removedThisMonth}
                hint={
                  removedThisMonth > 0
                    ? 'Wins logged this month'
                    : 'Land your first one this month'
                }
                tone="green"
              />
              <CelebrationTile
                label="Disputes won"
                value={removedCount}
                hint="Total negative items off"
                tone="green"
              />
              <CleanSlateTile
                months={cleanSlateMonths}
                hasData={oldestDisputeMs != null}
              />
            </section>

            {initialScore != null && currentScore > 0 && (
              <ScoreTrajectory initial={initialScore} current={currentScore} />
            )}

            <LettersInFlightTile counts={lettersInFlight} />

            <section className="grid grid-cols-1 lg:grid-cols-3 gap-6 mb-10">
              <div className="lg:col-span-2 flex flex-col gap-6">
                <BattlesPanel
                  disputes={[...inFlightDisputes, ...draftDisputes]}
                  isManaged={isManaged}
                />
                <ThirtyDayRuleCallout />
              </div>
              <div className="lg:col-span-1 flex flex-col gap-6">
                <LettersTodayPanel
                  letters={suggestedLetters}
                  isManaged={isManaged}
                />
                <ResponsesCelebrationPanel responses={recentResponses} />
              </div>
            </section>

            <section className="mb-10">
              <KnowledgeHub
                recommendations={recommendations}
                cleanSlateMonths={cleanSlateMonths}
              />
            </section>

            {isManaged && (
              <section>
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
          <Link
            href="/dashboard/letters"
            className="text-sm text-gray-600 hover:text-gray-800 font-medium"
          >
            Letter library
          </Link>
          <Link
            href="/dashboard/my-letters"
            className="text-sm text-gray-600 hover:text-gray-800 font-medium"
          >
            My letters
          </Link>
        </div>
      </div>
    </nav>
  );
}

function StoryHook({
  currentScore,
  initialScore,
  delta,
  removedCount,
  activeCount,
  isManaged,
}: {
  currentScore: number;
  initialScore: number | null;
  delta: number | null;
  removedCount: number;
  activeCount: number;
  isManaged: boolean;
}) {
  const hasJourney =
    initialScore != null && delta != null && currentScore > 0;
  const headline = !hasJourney
    ? "Welcome. Let's start your story."
    : delta! > 0
      ? `You started at ${initialScore}. You're at ${currentScore}. Up ${delta} points and counting.`
      : delta! < 0
        ? `You started at ${initialScore}. You're at ${currentScore}. We'll get this turned around.`
        : `You started at ${initialScore}. Your file is in motion.`;

  const sub =
    removedCount === 0 && activeCount === 0
      ? 'Add your first negative item to start clearing your file.'
      : removedCount === 0
        ? `${activeCount} ${pluralize('dispute', activeCount)} in flight. First wins are days away.`
        : activeCount === 0
          ? `${removedCount} ${pluralize('item', removedCount)} already off your file. Time to file the next round.`
          : `${removedCount} ${pluralize('item', removedCount)} off your file. ${activeCount} more in flight. Keep going.`;

  return (
    <div className="mb-10 p-6 sm:p-8 bg-gradient-to-br from-emerald-50 to-white border border-emerald-200">
      <p className="text-xs uppercase tracking-wider text-emerald-700 font-medium mb-2">
        {isManaged ? 'Your team is on it' : 'Your story so far'}
      </p>
      <h1 className="text-2xl sm:text-3xl font-light text-gray-900 leading-snug">
        {headline}
      </h1>
      <p className="mt-3 text-sm sm:text-base text-gray-700 font-light">
        {sub}
      </p>
    </div>
  );
}

function ScoreCard({
  currentScore,
  initialScore,
  delta,
}: {
  currentScore: number;
  initialScore: number | null;
  delta: number | null;
}) {
  const accent =
    delta == null
      ? 'text-gray-500'
      : delta > 0
        ? 'text-emerald-700'
        : delta < 0
          ? 'text-red-700'
          : 'text-gray-500';
  const deltaText =
    delta == null
      ? 'Tracking…'
      : delta === 0
        ? 'No change yet'
        : `${delta > 0 ? '+' : ''}${delta} pts`;

  return (
    <div className="bg-white border border-gray-200 p-6">
      <div className="text-xs uppercase tracking-wider text-gray-500 mb-3">
        Credit score
      </div>
      <div className="text-5xl sm:text-6xl font-light text-gray-900">
        {currentScore || '—'}
      </div>
      <div className={`mt-3 text-sm font-medium ${accent}`}>{deltaText}</div>
      {initialScore != null && (
        <div className="mt-1 text-xs text-gray-500 font-light">
          Started at {initialScore}
        </div>
      )}
    </div>
  );
}

function CelebrationTile({
  label,
  value,
  hint,
  tone,
}: {
  label: string;
  value: number;
  hint?: string;
  tone: Tone;
}) {
  const palette =
    tone === 'green'
      ? 'bg-emerald-50 border-emerald-200 text-emerald-900'
      : tone === 'amber'
        ? 'bg-amber-50 border-amber-200 text-amber-900'
        : 'bg-white border-gray-200 text-gray-900';
  return (
    <div className={`p-6 border ${palette}`}>
      <div className="text-xs uppercase tracking-wider opacity-70 mb-3">
        {label}
      </div>
      <div className="text-5xl sm:text-6xl font-light">{value}</div>
      {hint && <div className="mt-3 text-sm font-light opacity-80">{hint}</div>}
    </div>
  );
}

function CleanSlateTile({
  months,
  hasData,
}: {
  months: number | null;
  hasData: boolean;
}) {
  const display = !hasData
    ? '—'
    : months === 0
      ? 'Today'
      : monthsToYearMonth(months ?? 0);
  return (
    <div className="p-6 border bg-amber-50 border-amber-200 text-amber-900">
      <div className="text-xs uppercase tracking-wider opacity-70 mb-3">
        Oldest item ages out
      </div>
      <div className="text-3xl sm:text-4xl font-light">{display}</div>
      <div className="mt-3 text-sm font-light opacity-80">
        7-year clean-slate countdown
      </div>
    </div>
  );
}

function ScoreTrajectory({
  initial,
  current,
}: {
  initial: number;
  current: number;
}) {
  // Map FICO range 300–850 onto a 0–100% bar.
  const min = 300;
  const max = 850;
  const initialPct = clamp(((initial - min) / (max - min)) * 100, 0, 100);
  const currentPct = clamp(((current - min) / (max - min)) * 100, 0, 100);
  const left = Math.min(initialPct, currentPct);
  const width = Math.abs(currentPct - initialPct);
  const up = current >= initial;

  return (
    <section className="mb-10 bg-white border border-gray-200 p-6">
      <div className="flex items-center justify-between mb-4 gap-4">
        <div>
          <div className="text-xs uppercase tracking-wider text-gray-500">
            Score trajectory
          </div>
          <p className="text-sm text-gray-700 font-light mt-1">
            From {initial} to {current}.
          </p>
        </div>
        <span
          className={`shrink-0 text-xs font-medium px-2 py-1 border ${
            up
              ? 'bg-emerald-50 text-emerald-800 border-emerald-200'
              : 'bg-red-50 text-red-800 border-red-200'
          }`}
        >
          {up ? '↑' : '↓'} {Math.abs(current - initial)} pts
        </span>
      </div>
      <div className="relative h-3 bg-gray-100 border border-gray-200">
        <div
          className={`absolute h-full ${up ? 'bg-emerald-500' : 'bg-red-400'}`}
          style={{ left: `${left}%`, width: `${width}%` }}
        />
        <div
          className="absolute h-full w-0.5 bg-gray-700"
          style={{ left: `${initialPct}%` }}
          aria-label={`Starting score ${initial}`}
        />
        <div
          className="absolute h-full w-0.5 bg-gray-900"
          style={{ left: `${currentPct}%` }}
          aria-label={`Current score ${current}`}
        />
      </div>
      <div className="flex justify-between mt-2 text-xs text-gray-500 font-light">
        <span>300</span>
        <span>850</span>
      </div>
    </section>
  );
}

function LettersInFlightTile({
  counts,
}: {
  counts: { awaitingResponse: number; overdue: number; readyToMail: number };
}) {
  const total = counts.awaitingResponse + counts.overdue + counts.readyToMail;
  if (total === 0) {
    return (
      <section className="mb-10 bg-white border border-gray-200 p-5 sm:p-6 flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3">
        <div>
          <p className="text-xs uppercase tracking-wider text-gray-500 font-medium mb-1">
            Letters in flight
          </p>
          <p className="text-sm text-gray-700 font-light">
            No active disputes. Browse the Letter Library to start.
          </p>
        </div>
        <Link
          href="/dashboard/letters"
          className="shrink-0 text-xs px-3 py-2 bg-gray-900 text-white font-semibold hover:bg-gray-800 transition"
        >
          Open library →
        </Link>
      </section>
    );
  }
  return (
    <section
      className={`mb-10 border p-5 sm:p-6 ${
        counts.overdue > 0
          ? 'bg-red-50 border-red-200'
          : 'bg-white border-gray-200'
      }`}
    >
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
        <div>
          <p className="text-xs uppercase tracking-wider text-gray-500 font-medium mb-3">
            Letters in flight
          </p>
          <div className="flex flex-wrap gap-x-8 gap-y-3">
            <CountStat
              value={counts.awaitingResponse}
              label="awaiting response"
              tone="neutral"
            />
            <CountStat value={counts.overdue} label="overdue" tone="red" />
            <CountStat
              value={counts.readyToMail}
              label="ready to mail"
              tone="blue"
            />
          </div>
        </div>
        <Link
          href="/dashboard/my-letters"
          className="shrink-0 text-xs px-3 py-2 bg-gray-900 text-white font-semibold hover:bg-gray-800 transition self-start sm:self-auto"
        >
          View all →
        </Link>
      </div>
      {counts.overdue > 0 && (
        <p className="mt-4 text-xs text-red-700 font-medium">
          FCRA § 1681i(a)(1)(A) gives bureaus 30 days. Overdue letters can be
          escalated.
        </p>
      )}
    </section>
  );
}

function CountStat({
  value,
  label,
  tone,
}: {
  value: number;
  label: string;
  tone: 'neutral' | 'red' | 'blue';
}) {
  const cls =
    value === 0
      ? 'text-gray-400'
      : tone === 'red'
        ? 'text-red-700'
        : tone === 'blue'
          ? 'text-blue-700'
          : 'text-gray-900';
  return (
    <div>
      <div className={`text-3xl sm:text-4xl font-light ${cls}`}>{value}</div>
      <div className="mt-1 text-xs text-gray-600 font-light">{label}</div>
    </div>
  );
}

function BattlesPanel({
  disputes,
  isManaged,
}: {
  disputes: Dispute[];
  isManaged: boolean;
}) {
  return (
    <div className="bg-white border border-gray-200">
      <div className="flex items-start justify-between gap-4 px-6 py-4 border-b border-gray-200">
        <div>
          <h2 className="text-lg font-semibold text-gray-900">
            Active battles
          </h2>
          <p className="text-xs text-gray-600 font-light mt-1">
            Disputes in flight. Bureaus must respond within 30 days under FCRA §611.
          </p>
        </div>
        <div className="shrink-0 flex items-center gap-3">
          <span className="text-xs text-gray-500">{disputes.length} open</span>
          {!isManaged && (
            <Link
              href="/dashboard/dispute/new"
              className="text-xs px-3 py-2 bg-emerald-700 text-white font-medium hover:bg-emerald-800 transition"
            >
              Start a battle
            </Link>
          )}
        </div>
      </div>
      {disputes.length === 0 ? (
        <div className="px-6 py-12 text-center text-sm text-gray-600 font-light">
          {isManaged
            ? "We'll start the first round shortly."
            : 'No battles active. Draft a letter from the panel on the right.'}
        </div>
      ) : (
        <ul className="divide-y divide-gray-200">
          {disputes.slice(0, 8).map(d => (
            <BattleRow key={d.id} d={d} isManaged={isManaged} />
          ))}
        </ul>
      )}
    </div>
  );
}

function BattleRow({ d, isManaged }: { d: Dispute; isManaged: boolean }) {
  const days = forcedResponseDays(d);
  const move = nextMove(d.status, isManaged);
  return (
    <li className="px-6 py-4 hover:bg-gray-50 transition">
      <Link
        href={`/dashboard/dispute/${d.id}`}
        className="grid grid-cols-12 items-center gap-3"
      >
        <div className="col-span-12 sm:col-span-5 min-w-0">
          <p className="text-sm font-medium text-gray-900 truncate">
            {d.creditor_name || 'Unknown creditor'}
          </p>
          <p className="text-xs text-gray-600 font-light mt-1">
            {d.dispute_type || 'General dispute'}
            {d.account_number &&
              ` · acct ending ${last4(d.account_number)}`}
          </p>
        </div>
        <div className="col-span-7 sm:col-span-3">
          <CountdownChip days={days} status={d.status} />
        </div>
        <div className="col-span-5 sm:col-span-2 text-xs text-gray-700">
          {move}
        </div>
        <div className="col-span-12 sm:col-span-2 sm:text-right">
          <StatusBadge status={d.status} />
        </div>
      </Link>
    </li>
  );
}

function CountdownChip({
  days,
  status,
}: {
  days: number | null;
  status: string;
}) {
  if (status === 'draft') {
    return (
      <span className="text-xs text-gray-500 font-light">Not yet sent</span>
    );
  }
  if (days == null) {
    return (
      <span className="text-xs text-gray-500 font-light">
        Awaiting send date
      </span>
    );
  }
  if (days <= 0) {
    return (
      <span className="inline-block text-xs font-medium px-2 py-1 bg-emerald-50 text-emerald-800 border border-emerald-200">
        Bureau overdue · forced removal lever
      </span>
    );
  }
  if (days <= 7) {
    return (
      <span className="inline-block text-xs font-medium px-2 py-1 bg-amber-50 text-amber-800 border border-amber-200">
        {days} {pluralize('day', days)} until forced response
      </span>
    );
  }
  return (
    <span className="inline-block text-xs font-medium px-2 py-1 bg-gray-50 text-gray-700 border border-gray-200">
      {days} days until forced response
    </span>
  );
}

function ThirtyDayRuleCallout() {
  return (
    <div className="bg-amber-50 border border-amber-200 p-5 sm:p-6">
      <span className="inline-block text-xs uppercase tracking-wider text-amber-800 font-medium px-2 py-1 border border-amber-300">
        Why 30 days matters
      </span>
      <p className="mt-3 text-sm text-gray-800 font-light leading-relaxed">
        Under <span className="font-medium">FCRA §611</span>, credit bureaus
        have <span className="font-medium">30 days</span> from receipt of your
        dispute to investigate. Miss that window? They{' '}
        <span className="font-medium">must remove the item</span> — verified or
        not. Every day you wait shortens their leash.
      </p>
      {/* TODO: wire to the FCRA training module route once it exists */}
      <button
        type="button"
        disabled
        className="mt-4 text-xs font-medium text-amber-900 underline disabled:no-underline disabled:text-amber-700/60 cursor-not-allowed"
        title="Module coming soon"
      >
        Read the full rule →
      </button>
    </div>
  );
}

function LettersTodayPanel({
  letters,
  isManaged,
}: {
  letters: LetterSuggestion[];
  isManaged: boolean;
}) {
  return (
    <div className="bg-white border border-gray-200">
      <div className="px-6 py-4 border-b border-gray-200 flex items-start justify-between gap-3">
        <div>
          <h2 className="text-lg font-semibold text-gray-900">Send today</h2>
          <p className="text-xs text-gray-600 font-light mt-1">
            {isManaged
              ? 'Letters queued for our team.'
              : 'Three letters that match your situation right now.'}
          </p>
        </div>
        <Link
          href="/dashboard/letters"
          className="shrink-0 text-xs text-emerald-700 hover:text-emerald-900 font-medium underline"
        >
          Library →
        </Link>
      </div>
      {letters.length === 0 ? (
        <div className="px-6 py-8 text-sm text-gray-600 font-light text-center">
          Letter library is loading. Try{' '}
          <Link
            href="/dashboard/letters"
            className="text-emerald-700 hover:text-emerald-900 underline font-medium"
          >
            browsing the full library
          </Link>{' '}
          while we line these up.
        </div>
      ) : (
        <ul className="divide-y divide-gray-200">
          {letters.map(l => (
            <li key={l.id} className="px-6 py-4">
              <div className="flex items-start gap-3 mb-2">
                <span className="shrink-0 text-xs font-medium uppercase tracking-wider text-gray-500 pt-0.5">
                  No. {l.number}
                </span>
                <p className="text-sm font-medium text-gray-900">{l.title}</p>
              </div>
              <p className="text-xs text-gray-700 font-light mb-3 line-clamp-3">
                <span className="font-medium text-gray-900">Why now:</span>{' '}
                {firstSentence(l.when_to_use)}
              </p>
              {isManaged ? (
                <p className="text-xs text-gray-500 font-light">
                  Queued for our team
                </p>
              ) : (
                <Link
                  href={`/dashboard/letters/${l.id}`}
                  className="inline-block text-xs px-3 py-2 bg-emerald-700 text-white font-medium hover:bg-emerald-800 transition"
                >
                  Open template
                </Link>
              )}
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}

function firstSentence(text: string): string {
  const cleaned = text
    .replace(/^•\s*/gm, '')
    .replace(/\s+/g, ' ')
    .trim();
  const m = cleaned.match(/^(.{20,180}?[.!?])\s/);
  if (m) return m[1];
  return cleaned.length > 180 ? cleaned.slice(0, 179).trimEnd() + '…' : cleaned;
}

function ResponsesCelebrationPanel({
  responses,
}: {
  responses: DisputeResponse[];
}) {
  return (
    <div className="bg-white border border-gray-200">
      <div className="px-6 py-4 border-b border-gray-200">
        <h2 className="text-lg font-semibold text-gray-900">
          Bureau responses
        </h2>
        <p className="text-xs text-gray-600 font-light mt-1">
          What it means in real terms.
        </p>
      </div>
      {responses.length === 0 ? (
        <div className="px-6 py-8 text-sm text-gray-600 font-light text-center">
          Nothing back yet. The 30-day clock is on your side.
        </div>
      ) : (
        <ul className="divide-y divide-gray-200">
          {responses.map(r => {
            const verdict = classifyResponse(r.content);
            return (
              <li key={r.id} className="px-6 py-4">
                <div className="flex items-center justify-between mb-2 gap-3">
                  <p className="text-sm font-medium text-gray-900 truncate">
                    {r.bureau_name || 'Bureau'}
                  </p>
                  <p className="shrink-0 text-xs text-gray-500 font-light">
                    {formatDate(r.received_date)}
                  </p>
                </div>
                <ResponseVerdictBadge verdict={verdict} />
                {r.content && (
                  <p className="text-xs text-gray-600 font-light line-clamp-2 mt-2">
                    {r.content}
                  </p>
                )}
              </li>
            );
          })}
        </ul>
      )}
    </div>
  );
}

function ResponseVerdictBadge({
  verdict,
}: {
  verdict: 'win' | 'pending' | 'neutral';
}) {
  if (verdict === 'win') {
    return (
      <span className="inline-block text-xs font-medium px-2 py-1 bg-emerald-50 text-emerald-800 border border-emerald-200">
        Removal likely · log the win
      </span>
    );
  }
  if (verdict === 'pending') {
    return (
      <span className="inline-block text-xs font-medium px-2 py-1 bg-amber-50 text-amber-800 border border-amber-200">
        Bureau pushed back · escalate
      </span>
    );
  }
  return (
    <span className="inline-block text-xs font-medium px-2 py-1 bg-gray-50 text-gray-700 border border-gray-200">
      Review needed
    </span>
  );
}

type EducationTile = {
  key: string;
  title: string;
  body: string;
  cta: string;
  tone: Tone;
};

function KnowledgeHub({
  recommendations,
  cleanSlateMonths,
}: {
  recommendations: Recommendation[];
  cleanSlateMonths: number | null;
}) {
  const ageOutTitle =
    cleanSlateMonths != null
      ? `Oldest item ages out in ${monthsToYearMonth(cleanSlateMonths)}`
      : 'Age-out countdown';

  const staticTiles: EducationTile[] = [
    {
      key: 'sol',
      title: 'Collections inside SOL?',
      body:
        "Statute of limitations protects you from being sued — but not from reporting. The right move depends on which side of the line you're on.",
      cta: 'Read SOL tactics',
      tone: 'amber',
    },
    {
      key: 'hardship',
      title: 'Hardship letter primer',
      body:
        'Job loss, medical, divorce — creditors will work with you when you ask the right way. Template + timing inside.',
      cta: 'Open module',
      tone: 'neutral',
    },
    {
      key: 'ageout',
      title: ageOutTitle,
      body:
        'Most negative items must drop off after 7 years under FCRA §605. Track the clock — sometimes patience beats a dispute.',
      cta: 'See age-out rules',
      tone: 'green',
    },
  ];

  const visibleRecs = recommendations.slice(0, 3);

  return (
    <div className="bg-white border border-gray-200">
      <div className="px-6 py-4 border-b border-gray-200">
        <h2 className="text-lg font-semibold text-gray-900">Knowledge hub</h2>
        <p className="text-xs text-gray-600 font-light mt-1">
          Education tied to the work you&apos;re doing this week.
        </p>
      </div>
      {visibleRecs.length > 0 && (
        <div className="px-4 sm:px-6 pt-4">
          <p className="text-xs uppercase tracking-wider text-gray-500 mb-3">
            For you
          </p>
          <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
            {visibleRecs.map(r => (
              <StaticTile key={r.id} tile={recToTile(r)} />
            ))}
          </div>
        </div>
      )}
      <div className="p-4 sm:p-6">
        {visibleRecs.length > 0 && (
          <p className="text-xs uppercase tracking-wider text-gray-500 mb-3">
            Education
          </p>
        )}
        <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
          {staticTiles.map(t => (
            <StaticTile key={t.key} tile={t} />
          ))}
        </div>
      </div>
    </div>
  );
}

function StaticTile({ tile }: { tile: EducationTile }) {
  const palette =
    tile.tone === 'green'
      ? 'bg-emerald-50 border-emerald-200'
      : tile.tone === 'amber'
        ? 'bg-amber-50 border-amber-200'
        : 'bg-gray-50 border-gray-200';
  return (
    <div className={`p-5 border ${palette}`}>
      <h3 className="text-sm font-semibold text-gray-900">{tile.title}</h3>
      {tile.body && (
        <p className="mt-2 text-xs text-gray-700 font-light leading-relaxed">
          {tile.body}
        </p>
      )}
      {/* TODO: wire each tile CTA to its training-module route once those land */}
      <button
        type="button"
        disabled
        className="mt-3 text-xs font-medium text-gray-700 underline disabled:no-underline disabled:text-gray-400 cursor-not-allowed"
        title="Module coming soon"
      >
        {tile.cta} →
      </button>
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
  type Event = {
    ts: string;
    label: string;
    detail: string;
    tone: 'win' | 'pending' | 'neutral';
  };

  const events: Event[] = [];
  for (const d of disputes) {
    if (d.letter_sent_date) {
      events.push({
        ts: d.letter_sent_date,
        label: 'Letter sent on your behalf',
        detail: `${d.creditor_name || 'Creditor'} · ${d.dispute_type || 'dispute'}`,
        tone: 'pending',
      });
    }
    if (d.removed_date) {
      events.push({
        ts: d.removed_date,
        label: 'Item removed — win logged',
        detail: `${d.creditor_name || 'Creditor'} off your file`,
        tone: 'win',
      });
    }
  }
  for (const r of responses) {
    if (r.received_date) {
      events.push({
        ts: r.received_date,
        label: 'Bureau responded',
        detail: `${r.bureau_name || 'Bureau'} · we logged it for you`,
        tone: 'neutral',
      });
    }
  }
  events.sort((a, b) => (a.ts < b.ts ? 1 : -1));

  // Next follow-up = 30 days after the most recent unresolved sent letter.
  const lastSentMs = disputes
    .filter(d => d.letter_sent_date && d.status === 'sent')
    .map(d => new Date(d.letter_sent_date as string).getTime())
    .filter(t => !Number.isNaN(t))
    .sort((a, b) => b - a)[0];
  const followUpDate =
    lastSentMs != null
      ? new Date(lastSentMs + FCRA_RESPONSE_DAYS * 24 * 60 * 60 * 1000)
      : null;

  return (
    <div className="bg-white border border-gray-200">
      <div className="px-6 py-4 border-b border-gray-200">
        <h2 className="text-lg font-semibold text-gray-900">
          What we did this week
        </h2>
        <p className="text-xs text-gray-600 font-light mt-1">
          You hired us. We&apos;re showing the work.
          {followUpDate && (
            <>
              {' '}
              Next: bureau has 30 days to respond. We&apos;ll follow up on{' '}
              <span className="font-medium text-gray-900">
                {formatDate(followUpDate.toISOString())}
              </span>
              .
            </>
          )}
        </p>
      </div>
      {events.length === 0 ? (
        <div className="px-6 py-12 text-center text-sm text-gray-600 font-light">
          We&apos;re getting set up. First letters go out within 48 hours of
          intake.
        </div>
      ) : (
        <ul className="divide-y divide-gray-200">
          {events.slice(0, 20).map((e, i) => {
            const dot =
              e.tone === 'win'
                ? 'bg-emerald-500'
                : e.tone === 'pending'
                  ? 'bg-amber-500'
                  : 'bg-gray-400';
            return (
              <li
                key={i}
                className="px-6 py-4 flex items-center gap-3"
              >
                <span className={`shrink-0 w-2 h-2 rounded-full ${dot}`} />
                <div className="flex-1 flex items-center justify-between gap-3">
                  <div className="min-w-0">
                    <p className="text-sm font-medium text-gray-900">
                      {e.label}
                    </p>
                    <p className="text-xs text-gray-600 font-light mt-1 truncate">
                      {e.detail}
                    </p>
                  </div>
                  <p className="shrink-0 text-xs text-gray-500 font-light">
                    {formatDate(e.ts)}
                  </p>
                </div>
              </li>
            );
          })}
        </ul>
      )}
    </div>
  );
}

function StatusBadge({ status }: { status: string }) {
  const map: Record<string, { label: string; cls: string }> = {
    draft: { label: 'Draft', cls: 'border-gray-300 text-gray-700 bg-gray-50' },
    sent: {
      label: 'Sent',
      cls: 'border-amber-300 text-amber-800 bg-amber-50',
    },
    in_review: {
      label: 'In review',
      cls: 'border-amber-300 text-amber-800 bg-amber-50',
    },
    responded: {
      label: 'Responded',
      cls: 'border-amber-300 text-amber-800 bg-amber-50',
    },
    removed: {
      label: 'Removed',
      cls: 'border-emerald-300 text-emerald-800 bg-emerald-50',
    },
    rejected: {
      label: 'Rejected',
      cls: 'border-red-300 text-red-800 bg-red-50',
    },
  };
  const m =
    map[status] ?? {
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

// ── Helpers ───────────────────────────────────────────────────────

function recToTile(r: Recommendation): EducationTile {
  const tone: Tone =
    r.priority != null && r.priority <= 1 ? 'amber' : 'neutral';
  return {
    key: r.id,
    title: r.title || r.type || 'Recommendation',
    body: r.description || '',
    cta: 'Take action',
    tone,
  };
}

function nextMove(status: string, isManaged: boolean): string {
  if (isManaged) return 'We handle';
  switch (status) {
    case 'draft':
      return 'Send letter';
    case 'sent':
    case 'in_review':
      return 'Wait & track';
    case 'responded':
      return 'Review response';
    default:
      return '—';
  }
}

function forcedResponseDays(d: Dispute): number | null {
  if (!d.letter_sent_date) return null;
  const sent = new Date(d.letter_sent_date).getTime();
  if (Number.isNaN(sent)) return null;
  const elapsedDays = Math.floor((Date.now() - sent) / (1000 * 60 * 60 * 24));
  return FCRA_RESPONSE_DAYS - elapsedDays;
}

// Heuristic: read bureau response text and pick a verdict the user can act on.
// "win" = removal language, "pending" = verified/needs-escalation language, else neutral.
function classifyResponse(content: string | null): 'win' | 'pending' | 'neutral' {
  if (!content) return 'neutral';
  const c = content.toLowerCase();
  if (/(deleted|removed|cannot verify|inaccur|in your favor)/.test(c)) {
    return 'win';
  }
  if (/(verified|accurate|reinvestig|stands as reported|insufficient|need more|incomplete)/.test(c)) {
    return 'pending';
  }
  return 'neutral';
}

function isThisMonth(value: string | null): boolean {
  if (!value) return false;
  const d = new Date(value);
  if (Number.isNaN(d.getTime())) return false;
  const now = new Date();
  return (
    d.getFullYear() === now.getFullYear() && d.getMonth() === now.getMonth()
  );
}

function pluralize(word: string, n: number): string {
  return n === 1 ? word : `${word}s`;
}

function monthsToYearMonth(months: number): string {
  if (months <= 0) return 'Today';
  const y = Math.floor(months / 12);
  const m = months % 12;
  if (y === 0) return `${m} mo`;
  if (m === 0) return `${y} ${pluralize('yr', y)}`;
  return `${y}y ${m}mo`;
}

function clamp(n: number, min: number, max: number): number {
  return Math.min(max, Math.max(min, n));
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
