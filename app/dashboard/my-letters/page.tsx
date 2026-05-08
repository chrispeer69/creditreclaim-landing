'use client';

import { useEffect, useState } from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { supabase } from '@/lib/supabase';
import {
  fetchUserDrafts,
  relativeTime,
  type DraftWithLetter,
} from '@/lib/letterDrafts';

export default function MyLettersPage() {
  const router = useRouter();
  const [authChecked, setAuthChecked] = useState(false);
  const [drafts, setDrafts] = useState<DraftWithLetter[]>([]);
  const [missingTable, setMissingTable] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [letterIdByNumber, setLetterIdByNumber] = useState<Map<number, string>>(
    new Map(),
  );

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
      else if (result.error) setError(result.error);
      else setDrafts(result.drafts);

      // Map letter_number → letter id so the resume link uses the same
      // /dashboard/letters/{id}/customize URL pattern as everything else.
      if (result.drafts.length > 0) {
        const numbers = Array.from(new Set(result.drafts.map(d => d.letter_number)));
        const { data } = await supabase
          .from('letters')
          .select('id, number')
          .in('number', numbers);
        const map = new Map<number, string>();
        for (const r of (data as Array<{ id: string; number: number }> | null) ?? []) {
          map.set(r.number, r.id);
        }
        if (!cancelled) setLetterIdByNumber(map);
      }

      setAuthChecked(true);
    })();
    return () => {
      cancelled = true;
    };
  }, [router]);

  return (
    <div className="min-h-screen bg-gray-50">
      <nav className="border-b border-gray-200 bg-white sticky top-0 z-40">
        <div className="max-w-7xl mx-auto px-4 sm:px-8 py-4 sm:py-5 flex justify-between items-center">
          <div className="flex items-center gap-6">
            <Link
              href="/dashboard"
              className="text-xl sm:text-2xl font-light tracking-tight text-gray-800"
            >
              Credit<span className="font-semibold">Reclaim</span>
            </Link>
            <span className="hidden sm:inline-block text-xs uppercase tracking-wider text-gray-500 px-2 py-1 border border-gray-200">
              My letters
            </span>
          </div>
          <div className="flex items-center gap-4 sm:gap-6">
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
              className="text-sm font-semibold text-gray-900"
            >
              My letters
            </Link>
          </div>
        </div>
      </nav>

      <main className="max-w-5xl mx-auto px-4 sm:px-8 py-8 sm:py-12">
        <header className="mb-8 sm:mb-10 p-6 sm:p-8 bg-gradient-to-br from-emerald-50 to-white border border-emerald-200">
          <p className="text-xs uppercase tracking-wider text-emerald-700 font-medium mb-2">
            Your drafts · {drafts.length}
          </p>
          <h1 className="text-2xl sm:text-3xl font-light text-gray-900 leading-snug">
            The letters you&apos;ve been working on.
          </h1>
          <p className="mt-3 text-sm sm:text-base text-gray-700 font-light">
            Pick up where you left off. Drafts auto-save while you edit.
          </p>
        </header>

        {!authChecked ? (
          <p className="text-sm text-gray-600 font-light">Loading…</p>
        ) : missingTable ? (
          <div className="bg-amber-50 border border-amber-200 p-6 sm:p-8">
            <p className="text-xs uppercase tracking-wider text-amber-800 font-medium mb-2">
              Drafts table not yet applied
            </p>
            <p className="text-sm text-gray-800 font-light">
              Apply{' '}
              <code className="font-mono text-xs">
                supabase/migrations/20260508120000_letter_drafts.sql
              </code>{' '}
              in the Supabase SQL Editor, then refresh.
            </p>
          </div>
        ) : error ? (
          <div className="bg-red-50 border border-red-200 p-6">
            <p className="text-sm text-red-900 font-medium">
              Couldn&apos;t load your drafts: {error}
            </p>
          </div>
        ) : drafts.length === 0 ? (
          <EmptyState />
        ) : (
          <ul className="bg-white border border-gray-200 divide-y divide-gray-200">
            {drafts.map(d => {
              const letterId = letterIdByNumber.get(d.letter_number);
              const href = letterId
                ? `/dashboard/letters/${letterId}/customize`
                : '/dashboard/letters';
              return (
                <li key={d.id}>
                  <Link
                    href={href}
                    className="block px-4 sm:px-6 py-4 sm:py-5 hover:bg-gray-50 transition"
                  >
                    <div className="flex items-start gap-4">
                      <div className="shrink-0 w-12 sm:w-14 text-right pt-0.5">
                        <span className="text-xs uppercase tracking-wider text-gray-500">
                          No.
                        </span>
                        <div className="text-xl sm:text-2xl font-light text-gray-900">
                          {d.letter_number}
                        </div>
                      </div>
                      <div className="min-w-0 flex-1">
                        <h3 className="text-sm sm:text-base font-semibold text-gray-900">
                          {d.letter_title ?? `Letter ${d.letter_number}`}
                        </h3>
                        <p className="text-xs text-gray-600 font-light mt-1">
                          {[shortStage(d.letter_stage), d.letter_category]
                            .filter(Boolean)
                            .join(' · ')}
                        </p>
                        <p className="text-xs text-gray-700 font-light mt-2">
                          Last edited {relativeTime(d.updated_at)} ·{' '}
                          <StatusBadge status={d.status} />
                        </p>
                      </div>
                      <div className="shrink-0 self-center text-emerald-700 text-sm font-medium">
                        Resume →
                      </div>
                    </div>
                  </Link>
                </li>
              );
            })}
          </ul>
        )}
      </main>
    </div>
  );
}

function StatusBadge({ status }: { status: string }) {
  const map: Record<string, { label: string; cls: string }> = {
    draft: {
      label: 'Draft',
      cls: 'bg-gray-100 text-gray-800 border-gray-200',
    },
    finalized: {
      label: 'Ready to mail',
      cls: 'bg-blue-50 text-blue-800 border-blue-200',
    },
    sent: {
      label: 'Sent',
      cls: 'bg-emerald-50 text-emerald-800 border-emerald-200',
    },
  };
  const m = map[status] ?? {
    label: status,
    cls: 'bg-gray-100 text-gray-800 border-gray-200',
  };
  return (
    <span
      className={`inline-block text-[11px] font-medium uppercase tracking-wider px-2 py-0.5 border ${m.cls}`}
    >
      {m.label}
    </span>
  );
}

function EmptyState() {
  return (
    <div className="bg-white border border-gray-200 px-6 py-12 text-center">
      <p className="text-base text-gray-800 font-light mb-3">
        You haven&apos;t customized any letters yet.
      </p>
      <p className="text-sm text-gray-600 font-light mb-6">
        Browse the Letter Library to get started.
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

function shortStage(stage: string | null): string {
  if (!stage) return '';
  const m = stage.match(/^(Stage\s+\d+)/i);
  return m ? m[1] : stage;
}
