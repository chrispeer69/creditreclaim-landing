'use client';

import { useMemo, useState } from 'react';
import Link from 'next/link';
import { summarize, type LetterSummary } from '@/lib/letters';

export default function LetterLibrary({
  letters,
  stages,
  categories,
}: {
  letters: LetterSummary[];
  stages: string[];
  categories: string[];
}) {
  const [stage, setStage] = useState<string>('all');
  const [category, setCategory] = useState<string>('all');
  const [query, setQuery] = useState<string>('');

  const filtered = useMemo(() => {
    const q = query.trim().toLowerCase();
    return letters.filter(l => {
      if (stage !== 'all' && l.stage !== stage) return false;
      if (category !== 'all' && l.category !== category) return false;
      if (q && !l.title.toLowerCase().includes(q)) return false;
      return true;
    });
  }, [letters, stage, category, query]);

  return (
    <div>
      <div className="bg-white border border-gray-200 p-4 sm:p-5 mb-6">
        <div className="grid grid-cols-1 lg:grid-cols-12 gap-3 lg:gap-4">
          <div className="lg:col-span-5">
            <label
              htmlFor="letter-search"
              className="block text-xs uppercase tracking-wider text-gray-500 mb-2"
            >
              Search title
            </label>
            <input
              id="letter-search"
              type="text"
              value={query}
              onChange={e => setQuery(e.target.value)}
              placeholder="e.g. validation, hardship, identity theft"
              className="w-full px-3 py-2 text-sm border border-gray-300 bg-white text-gray-900 placeholder:text-gray-400 focus:outline-none focus:border-emerald-500"
            />
          </div>
          <div className="lg:col-span-4">
            <label
              htmlFor="letter-stage"
              className="block text-xs uppercase tracking-wider text-gray-500 mb-2"
            >
              Stage
            </label>
            <select
              id="letter-stage"
              value={stage}
              onChange={e => setStage(e.target.value)}
              className="w-full px-3 py-2 text-sm border border-gray-300 bg-white text-gray-900 focus:outline-none focus:border-emerald-500"
            >
              <option value="all">All stages</option>
              {stages.map(s => (
                <option key={s} value={s}>
                  {s}
                </option>
              ))}
            </select>
          </div>
          <div className="lg:col-span-3">
            <label
              htmlFor="letter-category"
              className="block text-xs uppercase tracking-wider text-gray-500 mb-2"
            >
              Category
            </label>
            <select
              id="letter-category"
              value={category}
              onChange={e => setCategory(e.target.value)}
              className="w-full px-3 py-2 text-sm border border-gray-300 bg-white text-gray-900 focus:outline-none focus:border-emerald-500"
            >
              <option value="all">All categories</option>
              {categories.map(c => (
                <option key={c} value={c}>
                  {c}
                </option>
              ))}
            </select>
          </div>
        </div>
        <div className="mt-3 flex items-center justify-between gap-3">
          <p className="text-xs text-gray-600 font-light">
            Showing <span className="font-medium text-gray-900">{filtered.length}</span>{' '}
            of <span className="font-medium text-gray-900">{letters.length}</span>{' '}
            letters
          </p>
          {(stage !== 'all' || category !== 'all' || query) && (
            <button
              type="button"
              onClick={() => {
                setStage('all');
                setCategory('all');
                setQuery('');
              }}
              className="text-xs text-emerald-700 hover:text-emerald-900 font-medium underline"
            >
              Reset filters
            </button>
          )}
        </div>
      </div>

      {filtered.length === 0 ? (
        <div className="bg-white border border-gray-200 px-6 py-12 text-center text-sm text-gray-600 font-light">
          No letters match those filters. Try widening the stage or clearing
          the search box.
        </div>
      ) : (
        <ul className="bg-white border border-gray-200 divide-y divide-gray-200">
          {filtered.map(l => (
            <li key={l.id}>
              <Link
                href={`/dashboard/letters/${l.id}`}
                className="block px-4 sm:px-6 py-4 sm:py-5 hover:bg-gray-50 transition"
              >
                <div className="flex items-start gap-4">
                  <div className="shrink-0 w-12 sm:w-14 text-right pt-0.5">
                    <span className="text-xs uppercase tracking-wider text-gray-500">
                      No.
                    </span>
                    <div className="text-xl sm:text-2xl font-light text-gray-900">
                      {l.number}
                    </div>
                  </div>
                  <div className="min-w-0 flex-1">
                    <div className="flex flex-wrap items-center gap-2 mb-1">
                      <h3 className="text-sm sm:text-base font-semibold text-gray-900">
                        {l.title}
                      </h3>
                    </div>
                    <div className="flex flex-wrap items-center gap-2 mb-2">
                      <StageChip stage={l.stage} />
                      <CategoryChip category={l.category} />
                    </div>
                    <p className="text-xs sm:text-sm text-gray-700 font-light leading-relaxed">
                      {summarize(l.when_to_use)}
                    </p>
                  </div>
                  <div className="shrink-0 self-center text-gray-400 text-sm">
                    →
                  </div>
                </div>
              </Link>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}

function StageChip({ stage }: { stage: string }) {
  const s = stage.toLowerCase();
  const cls = s.includes('stage 1')
    ? 'bg-emerald-50 text-emerald-800 border-emerald-200'
    : s.includes('stage 2')
      ? 'bg-amber-50 text-amber-800 border-amber-200'
      : 'bg-red-50 text-red-800 border-red-200';
  return (
    <span
      className={`inline-block text-[11px] font-medium uppercase tracking-wider px-2 py-1 border ${cls}`}
    >
      {shortStage(stage)}
    </span>
  );
}

function CategoryChip({ category }: { category: string }) {
  return (
    <span className="inline-block text-[11px] font-medium uppercase tracking-wider px-2 py-1 border bg-gray-50 text-gray-700 border-gray-200">
      {category}
    </span>
  );
}

function shortStage(stage: string): string {
  // "Stage 1: Initial Disputes - Direct to Bureaus" → "Stage 1"
  const m = stage.match(/^(Stage\s+\d+)/i);
  return m ? m[1] : stage;
}
