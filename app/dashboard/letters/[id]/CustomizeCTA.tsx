'use client';

import { useEffect, useState } from 'react';
import Link from 'next/link';
import { supabase } from '@/lib/supabase';
import { relativeTime } from '@/lib/letterDrafts';

type DraftLite = {
  id: string;
  status: string;
  updated_at: string;
};

export default function CustomizeCTA({
  letterId,
  letterNumber,
}: {
  letterId: string;
  letterNumber: number;
}) {
  const [draft, setDraft] = useState<DraftLite | null>(null);
  const [loaded, setLoaded] = useState(false);
  const [tableMissing, setTableMissing] = useState(false);

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
        .select('id, status, updated_at')
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

  return (
    <section className="mb-8 print:hidden">
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
      {tableMissing && (
        <p className="mt-2 text-xs text-amber-700 font-light">
          Drafts table not yet applied — running the customize flow will show
          a setup banner.
        </p>
      )}
    </section>
  );
}
