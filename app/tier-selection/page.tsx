'use client';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { useState } from 'react';

export default function TierSelectionPage() {
  const router = useRouter();
  const [loading, setLoading] = useState('');

  const handleSelect = (tier: string) => {
    setLoading(tier);
    setTimeout(() => {
      router.push(`/checkout?tier=${tier}`);
    }, 300);
  };

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

      <div className="max-w-7xl mx-auto px-8 py-24">
        <div className="max-w-3xl mx-auto mb-20">
          <h1 className="text-4xl font-light text-gray-800 mb-4">Choose Your Path</h1>
          <p className="text-lg text-gray-600 font-light">Both get results. Pick what fits your style and schedule.</p>
        </div>

        <div className="grid grid-cols-2 gap-8 max-w-3xl mx-auto mb-20">
          <div className="border border-gray-200 p-10 hover:border-gray-300 transition cursor-pointer" onClick={() => handleSelect('diy')}>
            <h3 className="text-lg font-semibold text-gray-800 mb-2">DIY</h3>
            <p className="text-gray-600 font-light mb-8">You manage. You learn. You win.</p>
            <div className="mb-8">
              <div className="text-3xl font-light text-gray-800">$149<span className="text-sm font-light text-gray-600 ml-2">/month</span></div>
            </div>
            <ul className="space-y-3 mb-10 text-sm text-gray-700 font-light">
              <li>✓ 5 training modules (required)</li>
              <li>✓ Every dispute strategy that wins. Built around the three core plays — debt validation, dispute challenges, and the 30-day forced response — plus a complete suite for edge cases like identity theft, SOL defense, pay-for-delete, and FCRA/FDCPA legal escalation.</li>
              <li>✓ Customizable templates</li>
              <li>✓ Dashboard & tracking</li>
              <li>✓ Document vault</li>
              <li>✓ Email reminders</li>
            </ul>
            <button onClick={() => handleSelect('diy')} disabled={loading === 'diy'} className="w-full px-6 py-3 border border-gray-300 text-gray-800 text-sm font-medium hover:bg-gray-50 transition disabled:opacity-50">
              {loading === 'diy' ? 'Processing...' : 'Choose DIY'}
            </button>
          </div>

          <div className="border border-gray-800 p-10 bg-gray-800 text-white hover:border-gray-700 transition cursor-pointer relative" onClick={() => handleSelect('managed')}>
            <div className="absolute -top-4 left-6 bg-gray-600 text-white px-4 py-1 text-xs font-semibold tracking-wider">RECOMMENDED</div>
            <h3 className="text-lg font-semibold mb-2 mt-4">Managed</h3>
            <p className="text-gray-300 font-light mb-8">We handle it. You relax.</p>
            <div className="mb-8">
              <div className="text-3xl font-light">$249<span className="text-sm font-light text-gray-400 ml-2">/month + mailing</span></div>
            </div>
            <ul className="space-y-3 mb-10 text-sm text-gray-200 font-light">
              <li>✓ Everything in DIY</li>
              <li>✓ Certified mail sending</li>
              <li>✓ We handle all disputes</li>
              <li>✓ Daily status updates</li>
              <li>✓ Response management</li>
              <li>✓ White-glove service</li>
            </ul>
            <button onClick={() => handleSelect('managed')} disabled={loading === 'managed'} className="w-full px-6 py-3 bg-white text-gray-800 text-sm font-medium hover:bg-gray-100 transition disabled:opacity-50">
              {loading === 'managed' ? 'Processing...' : 'Choose Managed'}
            </button>
          </div>
        </div>

        <div className="p-8 bg-gray-50 border border-gray-200 max-w-3xl mx-auto">
          <h3 className="text-lg font-semibold text-gray-800 mb-6">Not sure? Here's how to decide:</h3>
          <div className="grid grid-cols-2 gap-8">
            <div>
              <p className="font-semibold text-gray-800 mb-3">Choose DIY if:</p>
              <ul className="text-gray-600 font-light space-y-2 text-sm">
                <li>✓ You want to learn and take control</li>
                <li>✓ You have time to manage disputes</li>
                <li>✓ You want the lowest cost option</li>
              </ul>
            </div>
            <div>
              <p className="font-semibold text-gray-800 mb-3">Choose Managed if:</p>
              <ul className="text-gray-600 font-light space-y-2 text-sm">
                <li>✓ You want hands-off simplicity</li>
                <li>✓ You don't have time to manage</li>
                <li>✓ You want guaranteed follow-up</li>
              </ul>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
