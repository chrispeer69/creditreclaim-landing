'use client';

import { useEffect, useMemo, useState } from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { supabase } from '@/lib/supabase';

type DisputeType =
  | 'late_payment'
  | 'collection'
  | 'charge_off'
  | 'inquiry'
  | 'identity_theft'
  | 'mixed_file'
  | 'other';

const DISPUTE_TYPES: Array<{ value: DisputeType; label: string; why: string }> = [
  {
    value: 'late_payment',
    label: 'Late payment',
    why:
      "Forces the creditor to prove the exact date you were late — they often can't on aged items, and unverifiable late marks must come off.",
  },
  {
    value: 'collection',
    label: 'Collection',
    why:
      'Under FDCPA §1692g, a collector must validate the debt is yours and accurate. Many bought-and-sold debts have no paper trail — and unverified collections must be deleted.',
  },
  {
    value: 'charge_off',
    label: 'Charge-off',
    why:
      'The 7-year reporting clock starts at the original delinquency, not the charge-off date. Bureaus get this wrong constantly — the wrong date is grounds for removal.',
  },
  {
    value: 'inquiry',
    label: 'Hard inquiry',
    why:
      "Hard inquiries you didn't authorize must come off in 30 days. Bureaus rarely have signed permission on file — most fail this challenge.",
  },
  {
    value: 'identity_theft',
    label: 'Identity theft',
    why:
      'Fast-tracked under FCRA §605B. With an FTC identity-theft report, bureaus must block the item within 4 business days — strongest legal lever you have.',
  },
  {
    value: 'mixed_file',
    label: 'Mixed file (someone else on yours)',
    why:
      "Mixed files are the bureau's error, not yours. They must clean it up — you don't have to prove anything beyond the mismatch.",
  },
  {
    value: 'other',
    label: 'Other',
    why:
      "Anything that doesn't fit the categories above. Use the notes field to give yourself a paper trail you'll thank yourself for later.",
  },
];

export default function NewDisputePage() {
  const router = useRouter();

  const [authChecked, setAuthChecked] = useState(false);
  const [userId, setUserId] = useState<string | null>(null);

  const [creditorName, setCreditorName] = useState('');
  const [accountNumber, setAccountNumber] = useState('');
  const [disputeType, setDisputeType] = useState<DisputeType | ''>('');
  const [letterSentDate, setLetterSentDate] = useState('');
  const [notes, setNotes] = useState('');

  const [submitting, setSubmitting] = useState(false);
  const [submitError, setSubmitError] = useState<string | null>(null);
  const [success, setSuccess] = useState(false);

  useEffect(() => {
    let cancelled = false;
    (async () => {
      const { data } = await supabase.auth.getSession();
      const u = data.session?.user ?? null;
      if (cancelled) return;
      if (!u) {
        router.push('/login');
        return;
      }
      setUserId(u.id);
      setAuthChecked(true);
    })();
    return () => {
      cancelled = true;
    };
  }, [router]);

  const selectedTypeMeta = useMemo(
    () => DISPUTE_TYPES.find(t => t.value === disputeType) ?? null,
    [disputeType],
  );

  const canSubmit =
    !submitting &&
    creditorName.trim().length > 0 &&
    disputeType !== '' &&
    !!userId;

  async function handleSubmit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    if (!canSubmit || !userId) return;

    setSubmitting(true);
    setSubmitError(null);

    const status = letterSentDate ? 'sent' : 'draft';

    const { error } = await supabase.from('disputes').insert({
      user_id: userId,
      creditor_name: creditorName.trim(),
      account_number: accountNumber.trim() || null,
      dispute_type: disputeType,
      letter_sent_date: letterSentDate || null,
      notes: notes.trim() || null,
      status,
    });

    if (error) {
      setSubmitError(error.message || 'Could not file the battle. Try again.');
      setSubmitting(false);
      return;
    }

    setSuccess(true);
    // Brief celebration before kicking back to the dashboard.
    setTimeout(() => {
      router.push('/dashboard');
    }, 1400);
  }

  if (!authChecked) {
    return (
      <div className="min-h-screen bg-gray-50 flex items-center justify-center">
        <p className="text-sm text-gray-600 font-light">Checking your session…</p>
      </div>
    );
  }

  if (success) {
    return (
      <div className="min-h-screen bg-gray-50 flex items-center justify-center px-4">
        <div className="max-w-md w-full p-8 bg-emerald-50 border border-emerald-200 text-center">
          <p className="text-xs uppercase tracking-wider text-emerald-700 font-medium mb-3">
            Battle filed
          </p>
          <h1 className="text-2xl font-light text-gray-900 leading-snug">
            {letterSentDate
              ? 'Bureau has 30 days.'
              : "It's drafted. Send the letter to start the 30-day clock."}
          </h1>
          <p className="mt-3 text-sm text-gray-700 font-light">
            Taking you back to the dashboard…
          </p>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gray-50">
      <nav className="border-b border-gray-200 bg-white sticky top-0 z-40">
        <div className="max-w-7xl mx-auto px-4 sm:px-8 py-4 sm:py-5 flex justify-between items-center">
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

      <main className="max-w-3xl mx-auto px-4 sm:px-8 py-8 sm:py-12">
        <header className="mb-8 p-6 sm:p-8 bg-gradient-to-br from-emerald-50 to-white border border-emerald-200">
          <p className="text-xs uppercase tracking-wider text-emerald-700 font-medium mb-2">
            Start a new battle
          </p>
          <h1 className="text-2xl sm:text-3xl font-light text-gray-900 leading-snug">
            You&apos;re filing a dispute.
          </h1>
          <p className="mt-3 text-sm sm:text-base text-gray-700 font-light leading-relaxed">
            Once the bureau receives it, FCRA §611 gives them{' '}
            <span className="font-medium text-gray-900">30 days</span> to
            investigate. Miss that window and they{' '}
            <span className="font-medium text-gray-900">must remove</span> the
            item — verified or not. Get the details right and the law works for
            you.
          </p>
        </header>

        <form
          onSubmit={handleSubmit}
          className="bg-white border border-gray-200"
          noValidate
        >
          <div className="px-6 sm:px-8 py-6 border-b border-gray-200">
            <h2 className="text-lg font-semibold text-gray-900">Battle details</h2>
            <p className="text-xs text-gray-600 font-light mt-1">
              The bureau will see what you put here. Be precise — vague disputes
              get dismissed.
            </p>
          </div>

          <div className="px-6 sm:px-8 py-6 space-y-6">
            <Field
              id="creditor_name"
              label="Creditor name"
              required
              hint="The company reporting the item — not the original lender if it's been sold."
            >
              <input
                id="creditor_name"
                type="text"
                value={creditorName}
                onChange={e => setCreditorName(e.target.value)}
                required
                autoComplete="off"
                className="w-full px-3 py-2 border border-gray-300 bg-white text-sm text-gray-900 focus:outline-none focus:border-emerald-600"
                placeholder="e.g. Midland Credit Management"
              />
            </Field>

            <Field
              id="account_number"
              label="Account number"
              optional
              hint="Last 4 digits is fine. Never paste the full number — it lives in your dispute letter, not in our database."
            >
              <input
                id="account_number"
                type="text"
                value={accountNumber}
                onChange={e => setAccountNumber(e.target.value)}
                inputMode="numeric"
                autoComplete="off"
                className="w-full px-3 py-2 border border-gray-300 bg-white text-sm text-gray-900 focus:outline-none focus:border-emerald-600"
                placeholder="e.g. 4421"
              />
            </Field>

            <Field
              id="dispute_type"
              label="Dispute type"
              required
              hint="What kind of item are you challenging? Each type has its own legal lever."
            >
              <select
                id="dispute_type"
                value={disputeType}
                onChange={e => setDisputeType(e.target.value as DisputeType | '')}
                required
                className="w-full px-3 py-2 border border-gray-300 bg-white text-sm text-gray-900 focus:outline-none focus:border-emerald-600"
              >
                <option value="">Choose a type…</option>
                {DISPUTE_TYPES.map(t => (
                  <option key={t.value} value={t.value}>
                    {t.label}
                  </option>
                ))}
              </select>
              {selectedTypeMeta && (
                <div className="mt-3 p-4 bg-amber-50 border border-amber-200">
                  <p className="text-xs uppercase tracking-wider text-amber-800 font-medium mb-2">
                    Why this type matters
                  </p>
                  <p className="text-sm text-gray-800 font-light leading-relaxed">
                    {selectedTypeMeta.why}
                  </p>
                </div>
              )}
            </Field>

            <Field
              id="letter_sent_date"
              label="Letter sent date"
              optional
              hint="Leave blank if you haven't sent it yet — we'll save this as a draft and the 30-day clock starts the day you mail it."
            >
              <input
                id="letter_sent_date"
                type="date"
                value={letterSentDate}
                onChange={e => setLetterSentDate(e.target.value)}
                className="w-full px-3 py-2 border border-gray-300 bg-white text-sm text-gray-900 focus:outline-none focus:border-emerald-600"
              />
            </Field>

            <Field
              id="notes"
              label="Notes"
              optional
              hint="Context only you'd remember — nothing in this field is sent to the bureau or anyone else."
            >
              <textarea
                id="notes"
                value={notes}
                onChange={e => setNotes(e.target.value)}
                rows={4}
                className="w-full px-3 py-2 border border-gray-300 bg-white text-sm text-gray-900 focus:outline-none focus:border-emerald-600"
                placeholder="e.g. Account opened 2018, fell behind during job loss in 2021, paid off in 2023"
              />
            </Field>
          </div>

          {submitError && (
            <div className="mx-6 sm:mx-8 mb-6 p-4 border border-red-300 bg-red-50">
              <p className="text-xs uppercase tracking-wider text-red-800 font-medium mb-2">
                Couldn&apos;t file the battle
              </p>
              <p className="text-sm text-red-900 font-light">{submitError}</p>
            </div>
          )}

          <div className="px-6 sm:px-8 py-5 border-t border-gray-200 bg-gray-50 flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3">
            <p className="text-xs text-gray-600 font-light">
              {letterSentDate
                ? 'Status will be set to Sent — the 30-day clock is already running.'
                : "We'll save this as a Draft. Send the letter when you're ready."}
            </p>
            <div className="flex items-center gap-3">
              <Link
                href="/dashboard"
                className="text-sm text-gray-600 hover:text-gray-800 font-medium px-3 py-2"
              >
                Cancel
              </Link>
              <button
                type="submit"
                disabled={!canSubmit}
                className="text-sm px-4 py-2 bg-emerald-700 text-white font-medium hover:bg-emerald-800 transition disabled:bg-gray-300 disabled:cursor-not-allowed"
              >
                {submitting ? 'Filing…' : 'File this battle'}
              </button>
            </div>
          </div>
        </form>
      </main>
    </div>
  );
}

function Field({
  id,
  label,
  required,
  optional,
  hint,
  children,
}: {
  id: string;
  label: string;
  required?: boolean;
  optional?: boolean;
  hint?: string;
  children: React.ReactNode;
}) {
  return (
    <div>
      <label
        htmlFor={id}
        className="flex items-center gap-2 text-sm font-medium text-gray-900 mb-2"
      >
        <span>{label}</span>
        {required && (
          <span className="text-[11px] uppercase tracking-wider text-emerald-700 font-medium">
            Required
          </span>
        )}
        {optional && (
          <span className="text-[11px] uppercase tracking-wider text-gray-500 font-medium">
            Optional
          </span>
        )}
      </label>
      {children}
      {hint && (
        <p className="mt-2 text-xs text-gray-600 font-light leading-relaxed">
          {hint}
        </p>
      )}
    </div>
  );
}
