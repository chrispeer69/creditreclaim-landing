'use client';

import { useEffect, useMemo, useState } from 'react';
import Link from 'next/link';
import { useParams, useRouter } from 'next/navigation';
import { supabase } from '@/lib/supabase';
import { useDisputeDetail, type Dispute } from '@/lib/hooks/useDashboardData';

const STATUS_FLOW: Array<{ key: string; label: string }> = [
  { key: 'draft', label: 'Draft' },
  { key: 'sent', label: 'Letter sent' },
  { key: 'in_review', label: 'In review' },
  { key: 'responded', label: 'Bureau responded' },
  { key: 'removed', label: 'Removed' },
];

export default function DisputeDetailPage() {
  const params = useParams<{ id: string }>();
  const router = useRouter();
  const disputeId = typeof params?.id === 'string' ? params.id : undefined;
  const { dispute, responses, loading, error, refetch } = useDisputeDetail(disputeId);
  const [tier, setTier] = useState<string>('diy');
  const [authChecked, setAuthChecked] = useState(false);

  // Pull tier off user_credits to gate DIY/Managed UI; redirect if no session.
  useEffect(() => {
    let cancelled = false;
    (async () => {
      const { data: sessionData } = await supabase.auth.getSession();
      const u = sessionData.session?.user;
      if (!u) {
        if (!cancelled) router.push('/login');
        return;
      }
      const { data } = await supabase
        .from('user_credits')
        .select('tier')
        .eq('id', u.id)
        .maybeSingle();
      if (!cancelled) {
        setTier(((data?.tier as string | undefined) ?? 'diy').toLowerCase());
        setAuthChecked(true);
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [router]);

  const isManaged = tier === 'managed';

  const currentStepIndex = useMemo(() => {
    if (!dispute) return -1;
    return STATUS_FLOW.findIndex(s => s.key === dispute.status);
  }, [dispute]);

  return (
    <div className="min-h-screen bg-gray-50">
      <nav className="border-b border-gray-200 bg-white sticky top-0 z-40">
        <div className="max-w-5xl mx-auto px-4 sm:px-8 py-4 sm:py-5 flex justify-between items-center">
          <Link
            href="/dashboard"
            className="text-xl sm:text-2xl font-light tracking-tight text-gray-800"
          >
            Credit<span className="font-semibold">Reclaim</span>
          </Link>
          <Link
            href="/dashboard"
            className="text-sm text-gray-600 hover:text-gray-800 font-medium"
          >
            ← Back to dashboard
          </Link>
        </div>
      </nav>

      <main className="max-w-5xl mx-auto px-4 sm:px-8 py-8 sm:py-12">
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

        {loading || !authChecked ? (
          <div className="py-24 text-center text-gray-600 font-light">
            Loading dispute…
          </div>
        ) : !dispute ? (
          <div className="py-24 text-center">
            <p className="text-gray-800 font-medium mb-2">Dispute not found</p>
            <p className="text-sm text-gray-600 font-light mb-6">
              It may have been removed, or you don't have access.
            </p>
            <Link
              href="/dashboard"
              className="inline-block px-6 py-3 border border-gray-300 text-gray-800 text-sm font-medium hover:bg-gray-50 transition"
            >
              Back to dashboard
            </Link>
          </div>
        ) : (
          <>
            <Header dispute={dispute} />
            <Timeline dispute={dispute} currentIndex={currentStepIndex} />
            <Details dispute={dispute} />
            <Actions dispute={dispute} isManaged={isManaged} onChange={refetch} />
            <Responses responses={responses} />
          </>
        )}
      </main>
    </div>
  );
}

// ── Sections ───────────────────────────────────────────────────────

function Header({ dispute }: { dispute: Dispute }) {
  return (
    <header className="mb-10">
      <p className="text-xs uppercase tracking-wider text-gray-500 mb-3">
        {dispute.dispute_type || 'Dispute'}
      </p>
      <h1 className="text-3xl sm:text-4xl font-light text-gray-800 mb-2">
        {dispute.creditor_name || 'Unknown creditor'}
      </h1>
      {dispute.account_number && (
        <p className="text-sm text-gray-600 font-light">
          Account ending {last4(dispute.account_number)}
        </p>
      )}
    </header>
  );
}

function Timeline({
  dispute,
  currentIndex,
}: {
  dispute: Dispute;
  currentIndex: number;
}) {
  const isRejected = dispute.status === 'rejected';
  return (
    <section className="bg-white border border-gray-200 p-6 mb-6">
      <h2 className="text-xs uppercase tracking-wider text-gray-500 mb-5">
        Status
      </h2>
      {isRejected ? (
        <div className="p-4 border border-red-300 bg-red-50">
          <p className="text-sm font-medium text-red-900">
            Dispute rejected by bureau
          </p>
          <p className="text-xs text-red-800 font-light mt-1">
            Review the response below; you may have grounds for a follow-up letter.
          </p>
        </div>
      ) : (
        <ol className="grid grid-cols-5 gap-2">
          {STATUS_FLOW.map((step, i) => {
            const done = currentIndex >= i;
            const active = currentIndex === i;
            return (
              <li key={step.key} className="text-center">
                <div
                  className={`mx-auto w-3 h-3 rounded-full mb-2 ${
                    done
                      ? active
                        ? 'bg-gray-800 ring-4 ring-gray-200'
                        : 'bg-gray-800'
                      : 'bg-gray-300'
                  }`}
                />
                <p
                  className={`text-[11px] font-medium ${
                    done ? 'text-gray-800' : 'text-gray-500'
                  }`}
                >
                  {step.label}
                </p>
              </li>
            );
          })}
        </ol>
      )}
    </section>
  );
}

function Details({ dispute }: { dispute: Dispute }) {
  return (
    <section className="grid grid-cols-1 sm:grid-cols-2 gap-4 sm:gap-6 mb-6">
      <DetailCard
        label="Letter sent"
        value={formatDate(dispute.letter_sent_date)}
      />
      <DetailCard
        label="Response received"
        value={formatDate(dispute.response_received_date)}
      />
      <DetailCard label="Removed on" value={formatDate(dispute.removed_date)} />
      <DetailCard label="Created" value={formatDate(dispute.created_at)} />
      {dispute.notes && (
        <div className="sm:col-span-2 bg-white border border-gray-200 p-6">
          <p className="text-xs uppercase tracking-wider text-gray-500 mb-3">
            Notes
          </p>
          <p className="text-sm text-gray-800 font-light whitespace-pre-wrap">
            {dispute.notes}
          </p>
        </div>
      )}
    </section>
  );
}

function Actions({
  dispute,
  isManaged,
  onChange,
}: {
  dispute: Dispute;
  isManaged: boolean;
  onChange: () => Promise<void>;
}) {
  const [busy, setBusy] = useState(false);
  const [actionError, setActionError] = useState<string | null>(null);

  async function markSent() {
    if (isManaged) return;
    setBusy(true);
    setActionError(null);
    const { error: updateError } = await supabase
      .from('disputes')
      .update({
        status: 'sent',
        letter_sent_date: new Date().toISOString(),
      })
      .eq('id', dispute.id);
    if (updateError) {
      setActionError(updateError.message);
    } else {
      await onChange();
    }
    setBusy(false);
  }

  if (isManaged) {
    return (
      <section className="bg-white border border-gray-200 p-6 mb-6">
        <p className="text-sm text-gray-600 font-light">
          Your team is handling this dispute. You'll see updates here as they happen
          — no action needed on your end.
        </p>
      </section>
    );
  }

  if (dispute.status === 'draft') {
    return (
      <section className="bg-white border border-gray-200 p-6 mb-6">
        <h2 className="text-xs uppercase tracking-wider text-gray-500 mb-3">
          Next step
        </h2>
        <p className="text-sm text-gray-700 font-light mb-4">
          Print the letter, mail it certified, then mark it sent so we can track
          the 30-day response window.
        </p>
        {actionError && (
          <div className="mb-4 p-3 border border-red-300 bg-red-50">
            <p className="text-xs text-red-900 font-medium">{actionError}</p>
          </div>
        )}
        <button
          onClick={markSent}
          disabled={busy}
          className="px-6 py-3 bg-gray-800 text-white text-sm font-medium hover:bg-gray-700 transition disabled:opacity-50"
        >
          {busy ? 'Updating…' : 'Mark letter sent'}
        </button>
      </section>
    );
  }

  return null;
}

function Responses({ responses }: { responses: import('@/lib/hooks/useDashboardData').DisputeResponse[] }) {
  return (
    <section className="bg-white border border-gray-200">
      <div className="px-6 py-4 border-b border-gray-200">
        <h2 className="text-lg font-semibold text-gray-800">Responses</h2>
      </div>
      {responses.length === 0 ? (
        <div className="px-6 py-12 text-center text-sm text-gray-600 font-light">
          No responses received for this dispute yet.
        </div>
      ) : (
        <ul className="divide-y divide-gray-200">
          {responses.map(r => (
            <li key={r.id} className="px-6 py-5">
              <div className="flex items-center justify-between mb-2">
                <p className="text-sm font-medium text-gray-800">
                  {r.bureau_name || 'Bureau'}
                </p>
                <p className="text-xs text-gray-500 font-light">
                  {formatDate(r.received_date)}
                </p>
              </div>
              {r.content && (
                <p className="text-sm text-gray-700 font-light whitespace-pre-wrap">
                  {r.content}
                </p>
              )}
            </li>
          ))}
        </ul>
      )}
    </section>
  );
}

function DetailCard({ label, value }: { label: string; value: string }) {
  return (
    <div className="bg-white border border-gray-200 p-6">
      <p className="text-xs uppercase tracking-wider text-gray-500 mb-3">{label}</p>
      <p className="text-sm text-gray-800 font-light">{value}</p>
    </div>
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
