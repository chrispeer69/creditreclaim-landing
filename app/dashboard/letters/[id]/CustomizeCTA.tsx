'use client';

import { useEffect, useState } from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { supabase } from '@/lib/supabase';
import {
  applyBracketReplacer,
  fetchUserCredits,
  formatShortDate,
  identityFromCredits,
  relativeTime,
  resetDraftToFresh,
} from '@/lib/letterDrafts';

type DraftLite = {
  id: string;
  status: 'draft' | 'finalized' | 'sent' | string;
  updated_at: string;
  mailed_at: string | null;
  mailed_to: string | null;
};

export default function CustomizeCTA({
  letterId,
  letterNumber,
  masterTemplateBody,
}: {
  letterId: string;
  letterNumber: number;
  masterTemplateBody: string;
}) {
  const router = useRouter();
  const [draft, setDraft] = useState<DraftLite | null>(null);
  const [loaded, setLoaded] = useState(false);
  const [tableMissing, setTableMissing] = useState(false);
  const [resetBusy, setResetBusy] = useState(false);
  const [resetError, setResetError] = useState<string | null>(null);

  useEffect(() => {
    let cancelled = false;
    (async () => {
      const { data: sessionData } = await supabase.auth.getSession();
      const u = sessionData.session?.user;
      if (!u) {
        if (!cancelled) setLoaded(true);
        return;
      }
      const { data, error } = await supabase
        .from('letter_drafts')
        .select('id, status, updated_at, mailed_at, mailed_to')
        .eq('user_id', u.id)
        .eq('letter_number', letterNumber)
        .maybeSingle();

      if (cancelled) return;
      if (error) {
        if (/schema cache|relation .* does not exist/i.test(error.message)) {
          setTableMissing(true);
        }
      } else {
        setDraft((data as DraftLite | null) ?? null);
      }
      setLoaded(true);
    })();
    return () => {
      cancelled = true;
    };
  }, [letterNumber]);

  const href = `/dashboard/letters/${letterId}/customize`;
  const hasDraft = !!draft;
  const isSent = draft?.status === 'sent';

  const onStartNewDispute = async () => {
    const ok = window.confirm(
      'This will replace your sent record with a new draft. Your record of the mailed letter will be lost. Continue?',
    );
    if (!ok) return;
    setResetBusy(true);
    setResetError(null);
    try {
      const { data: sessionData } = await supabase.auth.getSession();
      const u = sessionData.session?.user;
      if (!u) {
        router.push('/login');
        return;
      }
      const credits = await fetchUserCredits(u.id);
      const ident = identityFromCredits(credits, u.email ?? null);
      const seeded = applyBracketReplacer(masterTemplateBody, ident);
      const { error } = await resetDraftToFresh({
        userId: u.id,
        letterNumber,
        customized_body: seeded,
      });
      if (error) {
        setResetError(error);
        return;
      }
      router.push(href);
    } finally {
      setResetBusy(false);
    }
  };

  return (
    <section className="mb-8 print:hidden">
      {isSent ? (
        <div className="bg-emerald-700 text-white border border-emerald-700 p-5 sm:p-6 flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
          <div className="min-w-0">
            <p className="text-xs uppercase tracking-wider text-emerald-100 font-medium mb-2">
              Already mailed
            </p>
            <h2 className="text-lg sm:text-xl font-light leading-snug">
              You mailed this letter on{' '}
              {formatShortDate(draft?.mailed_at ?? null)}
            </h2>
            <p className="mt-1 text-xs text-emerald-100 font-light">
              Sent to {draft?.mailed_to ?? '—'}. Awaiting response.
            </p>
          </div>
          <Link
            href={href}
            className="shrink-0 inline-block text-sm px-5 py-3 bg-white text-emerald-800 font-semibold hover:bg-gray-100 transition text-center"
          >
            View sent letter
          </Link>
        </div>
      ) : (
        <div className="bg-gray-900 text-white border border-gray-900 p-5 sm:p-6 flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
          <div className="min-w-0">
            <p className="text-xs uppercase tracking-wider text-emerald-300 font-medium mb-2">
              {hasDraft ? 'Your draft' : 'Make it yours'}
            </p>
            <h2 className="text-lg sm:text-xl font-light leading-snug">
              {hasDraft
                ? 'Pick up where you left off.'
                : 'Pre-fill your details, edit, save, and print.'}
            </h2>
            {hasDraft && draft?.updated_at && (
              <p className="mt-1 text-xs text-gray-300 font-light">
                Last edited {relativeTime(draft.updated_at)}
                {draft.status === 'finalized' && ' · Marked ready to mail'}
              </p>
            )}
            {!hasDraft && loaded && (
              <p className="mt-1 text-xs text-gray-300 font-light">
                We&apos;ll pre-fill your name, address, and the date — you fill
                in the account-specific details.
              </p>
            )}
          </div>
          <Link
            href={href}
            className="shrink-0 inline-block text-sm px-5 py-3 bg-emerald-500 text-gray-900 font-semibold hover:bg-emerald-400 transition text-center"
          >
            {hasDraft ? 'Continue editing your draft' : 'Customize this letter'}
          </Link>
        </div>
      )}

      {isSent && (
        <div className="mt-3 flex items-center justify-end gap-3">
          {resetError && (
            <span className="text-xs text-red-700 font-medium">
              {resetError}
            </span>
          )}
          <button
            type="button"
            onClick={onStartNewDispute}
            disabled={resetBusy}
            className="text-xs text-gray-700 hover:text-gray-900 font-medium underline disabled:opacity-50"
          >
            {resetBusy
              ? 'Resetting…'
              : 'Start a new dispute with this letter →'}
          </button>
        </div>
      )}

      {tableMissing && (
        <p className="mt-2 text-xs text-amber-700 font-light">
          Drafts table not yet applied — running the customize flow will show
          a setup banner.
        </p>
      )}
    </section>
  );
}
