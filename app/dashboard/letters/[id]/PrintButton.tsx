'use client';

export default function PrintButton({
  variant = 'solid',
}: {
  variant?: 'solid' | 'ghost';
}) {
  const cls =
    variant === 'ghost'
      ? 'text-xs px-3 py-2 border border-gray-300 text-gray-700 font-medium hover:bg-gray-50 transition'
      : 'text-xs px-3 py-2 bg-emerald-700 text-white font-medium hover:bg-emerald-800 transition';
  return (
    <button
      type="button"
      onClick={() => window.print()}
      className={`${cls} print:hidden`}
    >
      Print letter
    </button>
  );
}
