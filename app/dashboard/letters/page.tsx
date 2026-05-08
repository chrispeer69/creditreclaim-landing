import Link from 'next/link';
import { fetchAllLetterSummaries } from '@/lib/letters';
import LetterLibrary from './LetterLibrary';

export const metadata = {
  title: 'Letter Library · CreditReclaim',
};

export default async function LettersPage() {
  const letters = await fetchAllLetterSummaries();

  const stages = Array.from(new Set(letters.map(l => l.stage))).sort();
  const categories = Array.from(new Set(letters.map(l => l.category))).sort();

  return (
    <div className="min-h-screen bg-gray-50">
      <nav className="border-b border-gray-200 bg-white sticky top-0 z-40 print:hidden">
        <div className="max-w-7xl mx-auto px-4 sm:px-8 py-4 sm:py-5 flex justify-between items-center">
          <div className="flex items-center gap-6">
            <Link
              href="/dashboard"
              className="text-xl sm:text-2xl font-light tracking-tight text-gray-800"
            >
              Credit<span className="font-semibold">Reclaim</span>
            </Link>
            <span className="hidden sm:inline-block text-xs uppercase tracking-wider text-gray-500 px-2 py-1 border border-gray-200">
              Letter library
            </span>
          </div>
          <div className="flex items-center gap-4 sm:gap-6">
            <Link
              href="/dashboard"
              className="text-sm text-gray-600 hover:text-gray-800 font-medium"
            >
              ← Back to dashboard
            </Link>
          </div>
        </div>
      </nav>

      <main className="max-w-7xl mx-auto px-4 sm:px-8 py-8 sm:py-12">
        <header className="mb-8 sm:mb-10 p-6 sm:p-8 bg-gradient-to-br from-emerald-50 to-white border border-emerald-200">
          <p className="text-xs uppercase tracking-wider text-emerald-700 font-medium mb-2">
            Your arsenal · {letters.length} letters
          </p>
          <h1 className="text-2xl sm:text-3xl font-light text-gray-900 leading-snug">
            Every letter, every escalation, every move you can make.
          </h1>
          <p className="mt-3 text-sm sm:text-base text-gray-700 font-light">
            Filter by stage, narrow by category, search by title. Open any
            letter to see when to use it, why it works, and the template ready
            to mail.
          </p>
        </header>

        <LetterLibrary
          letters={letters}
          stages={stages}
          categories={categories}
        />
      </main>
    </div>
  );
}
