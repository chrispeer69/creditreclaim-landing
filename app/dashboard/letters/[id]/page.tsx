import Link from 'next/link';
import { notFound } from 'next/navigation';
import { fetchLetterById, type Letter } from '@/lib/letters';
import PrintButton from './PrintButton';
import CustomizeCTA from './CustomizeCTA';

// Always render at request time — id is user-driven and the library
// rows live in Supabase, not in the build.
export const dynamic = 'force-dynamic';

export const metadata = {
  title: 'Letter · CreditReclaim',
};

export default async function LetterDetailPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;

  // UUIDs only — surface 404 fast on bogus ids instead of round-tripping.
  if (!isUuid(id)) notFound();

  const { letter, error } = await fetchLetterById(id);
  if (error || !letter) notFound();

  return (
    <div className="min-h-screen bg-gray-50 print:bg-white">
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
              Letter no. {letter.number}
            </span>
          </div>
          <div className="flex items-center gap-3 sm:gap-4">
            <Link
              href="/dashboard/disputes"
              className="text-sm text-gray-600 hover:text-gray-800 font-medium"
            >
              Disputes
            </Link>
            <Link
              href="/dashboard/my-letters"
              className="text-sm text-gray-600 hover:text-gray-800 font-medium"
            >
              My letters
            </Link>
            <Link
              href="/dashboard/letters"
              className="text-sm text-gray-600 hover:text-gray-800 font-medium"
            >
              ← Back to library
            </Link>
            <PrintButton />
          </div>
        </div>
      </nav>

      <main className="max-w-5xl mx-auto px-4 sm:px-8 py-8 sm:py-12 print:px-0 print:py-0 print:max-w-none">
        <header className="mb-8 print:hidden">
          <p className="text-xs uppercase tracking-wider text-emerald-700 font-medium mb-2">
            Letter no. {letter.number}
          </p>
          <h1 className="text-2xl sm:text-3xl font-light text-gray-900 leading-snug">
            {letter.title}
          </h1>
          <div className="mt-3 flex flex-wrap items-center gap-2">
            <StageChip stage={letter.stage} />
            <CategoryChip category={letter.category} />
          </div>
        </header>

        <CustomizeCTA
          letterId={letter.id}
          letterNumber={letter.number}
          masterTemplateBody={letter.template_body}
        />

        <section className="grid grid-cols-1 lg:grid-cols-3 gap-6 mb-10 print:hidden">
          <Block title="When to use" body={letter.when_to_use} tone="amber" />
          <Block title="Why it works" body={letter.why_it_works} tone="green" />
          <Block title="How to use" body={letter.how_to_use} tone="neutral" />
        </section>

        <section className="bg-white border border-gray-200 print:border-0">
          <div className="px-4 sm:px-6 py-3 border-b border-gray-200 flex items-center justify-between gap-3 print:hidden">
            <div>
              <h2 className="text-sm font-semibold text-gray-900 uppercase tracking-wider">
                Letter template
              </h2>
              <p className="text-xs text-gray-600 font-light mt-1">
                Print this page — only the template below comes out. Mail
                certified, return receipt requested.
              </p>
            </div>
            <PrintButton variant="ghost" />
          </div>
          <pre className="letter-template px-4 sm:px-8 py-6 sm:py-8 text-sm sm:text-[15px] leading-7 text-gray-900 whitespace-pre-wrap font-mono print:px-0 print:py-0 print:text-[12pt] print:leading-6">
{letter.template_body}
          </pre>
        </section>

        <p className="mt-8 text-xs text-gray-500 font-light print:hidden">
          Last updated{' '}
          {new Date(letter.updated_at).toLocaleDateString(undefined, {
            month: 'short',
            day: 'numeric',
            year: 'numeric',
          })}
        </p>
      </main>

      <style>{`
        @media print {
          @page { margin: 0.75in; }
          html, body { background: #fff !important; }
        }
      `}</style>
    </div>
  );
}

function Block({
  title,
  body,
  tone,
}: {
  title: string;
  body: string;
  tone: 'amber' | 'green' | 'neutral';
}) {
  const palette =
    tone === 'green'
      ? 'bg-emerald-50 border-emerald-200'
      : tone === 'amber'
        ? 'bg-amber-50 border-amber-200'
        : 'bg-white border-gray-200';
  return (
    <div className={`p-5 sm:p-6 border ${palette}`}>
      <h2 className="text-xs uppercase tracking-wider text-gray-700 font-medium mb-3">
        {title}
      </h2>
      <div className="text-sm text-gray-800 font-light leading-relaxed whitespace-pre-wrap">
        {body}
      </div>
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
      {stage}
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

// Cheap server-side UUID guard — keeps invalid ids out of Supabase entirely.
function isUuid(s: string): boolean {
  return /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(s);
}

export type { Letter };
