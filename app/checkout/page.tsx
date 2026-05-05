'use client';
import { Suspense } from 'react';
import Link from 'next/link';
import { useSearchParams } from 'next/navigation';

export default function CheckoutPage() {
  return (
    <div className="min-h-screen bg-white">
      <nav className="border-b border-gray-200 bg-white">
        <div className="max-w-7xl mx-auto px-8 py-5 flex justify-between items-center">
          <Link href="/" className="text-2xl font-light tracking-tight text-gray-800">
            Credit<span className="font-semibold">Reclaim</span>
          </Link>
          <Link href="/login" className="text-sm text-gray-600 hover:text-gray-800 font-medium">Sign In</Link>
        </div>
      </nav>

      <Suspense fallback={<CheckoutLoading />}>
        <CheckoutContent />
      </Suspense>
    </div>
  );
}

function CheckoutLoading() {
  return (
    <div className="max-w-7xl mx-auto px-8 py-24">
      <div className="max-w-2xl mx-auto text-gray-600 font-light">Loading...</div>
    </div>
  );
}

function CheckoutContent() {
  const searchParams = useSearchParams();
  const tier = searchParams.get('tier') || 'diy';

  const tierData = {
    diy: {
      name: 'DIY',
      price: 149,
      description: 'You manage. You learn. You win.',
      features: [
        '5 training modules (required)',
        'Every winning dispute strategy — validation, challenges, 30-day forced response, plus FCRA/FDCPA escalation',
        'Customizable templates',
        'Dashboard & tracking',
        'Document vault',
        'Email reminders every 3 days'
      ]
    },
    managed: {
      name: 'Managed',
      price: 249,
      description: 'We handle it. You relax.',
      features: [
        'Everything in DIY',
        'Certified mail sending',
        'We handle all disputes',
        'Daily status updates',
        'Response management',
        'White-glove service'
      ]
    }
  };

  const selected = tierData[tier as keyof typeof tierData] || tierData.diy;

  return (
    <div className="max-w-7xl mx-auto px-8 py-24">
      <div className="max-w-2xl mx-auto">
        <Link href="/tier-selection" className="text-sm text-gray-600 hover:text-gray-800 mb-12 inline-flex items-center gap-2">
          ← Back
        </Link>

        <div className="mb-12">
          <h1 className="text-4xl font-light text-gray-800 mb-4">Complete Your Purchase</h1>
          <p className="text-gray-600 font-light">You're getting the {selected.name} plan. Secure payment below.</p>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-3 gap-8">
          <div className="md:col-span-2">
            <div className="border border-gray-200 p-10 mb-8">
              <h2 className="text-lg font-semibold text-gray-800 mb-6">Order Summary</h2>

              <div className="mb-8">
                <div className="flex justify-between items-start mb-4 pb-4 border-b border-gray-200">
                  <div>
                    <p className="text-gray-800 font-medium">{selected.name} Plan</p>
                    <p className="text-sm text-gray-600 font-light">Monthly subscription</p>
                  </div>
                  <p className="text-lg font-light text-gray-800">${selected.price}</p>
                </div>
              </div>

              <div className="mb-8 pb-8 border-b border-gray-200">
                <h3 className="text-sm font-semibold text-gray-800 mb-4">What's Included:</h3>
                <ul className="space-y-2 text-sm text-gray-700 font-light">
                  {selected.features.map((feature, i) => (
                    <li key={i} className="flex items-start gap-3">
                      <span className="text-gray-400 mt-1">✓</span>
                      <span>{feature}</span>
                    </li>
                  ))}
                </ul>
              </div>

              <div className="flex justify-between items-center">
                <p className="text-gray-600 font-light">Total due today</p>
                <p className="text-2xl font-light text-gray-800">${selected.price}</p>
              </div>
            </div>

            <div className="border border-gray-200 p-10">
              <h2 className="text-lg font-semibold text-gray-800 mb-6">Payment Details</h2>
              <p className="text-gray-600 font-light text-sm mb-6">Stripe payment integration coming in Phase 2. For now, this is a placeholder.</p>
              <button disabled className="w-full px-6 py-3 bg-gray-400 text-white text-sm font-medium cursor-not-allowed opacity-50">
                Complete Payment (Coming Soon)
              </button>
            </div>
          </div>

          <div className="md:col-span-1">
            <div className="border border-gray-200 p-8 bg-gray-50 sticky top-8">
              <h3 className="text-lg font-semibold text-gray-800 mb-4">{selected.name}</h3>
              <p className="text-gray-600 font-light text-sm mb-6">{selected.description}</p>

              <div className="mb-6">
                <p className="text-gray-600 font-light text-xs mb-2">Monthly Price</p>
                <p className="text-3xl font-light text-gray-800">${selected.price}</p>
              </div>

              <div className="p-4 bg-white border border-gray-200 rounded">
                <p className="text-xs text-gray-600 font-light">Cancel anytime. No hidden fees.</p>
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
