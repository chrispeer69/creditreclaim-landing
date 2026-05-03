'use client';
import Link from 'next/link';

export default function Home() {
  return (
    <div>
      {/* Nav */}
      <nav className="border-b border-gray-200 bg-white sticky top-0 z-40">
        <div className="max-w-7xl mx-auto px-8 py-5 flex justify-between items-center">
          <div className="text-2xl font-light tracking-tight text-gray-800">
            Credit<span className="font-semibold">Reclaim</span>
          </div>
          <Link href="/login" className="text-sm text-gray-600 hover:text-gray-800 font-medium">Sign In</Link>
        </div>
      </nav>

      {/* Hero */}
      <section className="bg-white border-b border-gray-200">
        <div className="max-w-7xl mx-auto px-8 py-24">
          <div className="max-w-3xl">
            <h1 className="text-5xl font-light tracking-tight text-gray-800 mb-6 leading-tight">
              The credit improvement platform built on education and coaching.
            </h1>
            <p className="text-xl text-gray-600 font-light mb-12 leading-relaxed">
              Learn the strategies that actually work. Then execute with precision. Whether you manage disputes yourself or let us handle it, your credit gets fixed right.
            </p>
            <div className="flex gap-4">
              <Link href="/signup" className="px-8 py-3 bg-gray-700 text-white text-sm font-medium hover:bg-gray-600 transition">
                Get Started
              </Link>
              <button className="px-8 py-3 border border-gray-300 text-gray-800 text-sm font-medium hover:bg-gray-50 transition">
                View Demo
              </button>
            </div>
          </div>
        </div>
      </section>

      {/* How It Works */}
      <section className="bg-white border-b border-gray-200">
        <div className="max-w-7xl mx-auto px-8 py-24">
          <h2 className="text-3xl font-light text-gray-800 mb-16">How it works</h2>
          <div className="grid grid-cols-3 gap-12">
            <div>
              <div className="text-4xl font-light text-gray-400 mb-6">01</div>
              <h3 className="text-lg font-semibold text-gray-800 mb-4">Learn</h3>
              <p className="text-gray-600 font-light leading-relaxed">5 training modules teach you credit repair strategies, collection laws, and winning tactics. You become the expert.</p>
            </div>
            <div>
              <div className="text-4xl font-light text-gray-400 mb-6">02</div>
              <h3 className="text-lg font-semibold text-gray-800 mb-4">Execute</h3>
              <p className="text-gray-600 font-light leading-relaxed">Access 100+ professionally written dispute letters. Customize, print, or we send certified copies. Your choice.</p>
            </div>
            <div>
              <div className="text-4xl font-light text-gray-400 mb-6">03</div>
              <h3 className="text-lg font-semibold text-gray-800 mb-4">Track & Win</h3>
              <p className="text-gray-600 font-light leading-relaxed">Real-time dispute tracking. Know exactly what's happening. Celebrate every removal.</p>
            </div>
          </div>
        </div>
      </section>

      {/* Stats */}
      <section className="bg-gray-50 border-b border-gray-200">
        <div className="max-w-7xl mx-auto px-8 py-16">
          <div className="grid grid-cols-4 gap-8">
            <div>
              <div className="text-3xl font-light text-gray-800 mb-2">100+</div>
              <div className="text-sm text-gray-600 font-light">Dispute letters</div>
            </div>
            <div>
              <div className="text-3xl font-light text-gray-800 mb-2">5</div>
              <div className="text-sm text-gray-600 font-light">Training modules</div>
            </div>
            <div>
              <div className="text-3xl font-light text-gray-800 mb-2">7 years</div>
              <div className="text-sm text-gray-600 font-light">Document retention</div>
            </div>
            <div>
              <div className="text-3xl font-light text-gray-800 mb-2">24/7</div>
              <div className="text-sm text-gray-600 font-light">Platform access</div>
            </div>
          </div>
        </div>
      </section>

      {/* Why Us */}
      <section className="bg-white border-b border-gray-200">
        <div className="max-w-7xl mx-auto px-8 py-24">
          <div className="max-w-3xl">
            <h2 className="text-3xl font-light text-gray-800 mb-6">Why we exist</h2>
            <p className="text-lg text-gray-600 font-light leading-relaxed">
              Most people do not know or understand their rights when dealing with the three major credit bureaus. We are experts. When you work with us we share years of experience with you to help you improve your credit standing.
            </p>
          </div>
        </div>
      </section>

      {/* The Reality */}
      <section className="bg-gray-50 border-b border-gray-200">
        <div className="max-w-7xl mx-auto px-8 py-24">
          <div className="max-w-3xl">
            <h2 className="text-3xl font-light text-gray-800 mb-8">The system is rigged</h2>
            <p className="text-lg text-gray-600 font-light leading-relaxed mb-6">
              The system is set up to work against you. Credit bureaus work for the banks, not the consumer. Evidence: constantly changing grading scales with over 20 different credit reports lenders use. They call it intelligence. We call it market manipulation by Fortune 500 companies working together to squeeze just a little more money from where they can.
            </p>
            <p className="text-lg text-gray-600 font-light leading-relaxed">
              Utilize our years of experience to fight against the system, for you and your family.
            </p>
          </div>
        </div>
      </section>

      {/* Slogan */}
      <section className="bg-gray-800 text-white">
        <div className="max-w-3xl mx-auto px-8 py-24 text-center">
          <p className="text-xl font-light text-gray-300 leading-relaxed mb-8">
            We work alongside you to improve your credit health. Then we stay alongside you to continue managing your credit health.
          </p>
          <p className="text-3xl font-light leading-tight">
            By ourselves the system beats us. <span className="font-semibold">Together, WE BEAT THE SYSTEM.</span>
          </p>
        </div>
      </section>

      {/* Pricing */}
      <section className="bg-white border-b border-gray-200">
        <div className="max-w-7xl mx-auto px-8 py-24">
          <h2 className="text-3xl font-light text-gray-800 mb-16">Simple pricing</h2>
          <div className="grid grid-cols-3 gap-8 max-w-5xl">
            <div className="border border-gray-200 p-10">
              <h3 className="text-lg font-semibold text-gray-800 mb-2">DIY</h3>
              <p className="text-gray-600 font-light mb-8">You manage. You learn. You win.</p>
              <div className="mb-8">
                <div className="text-3xl font-light text-gray-800">$149<span className="text-sm font-light text-gray-600 ml-2">/month</span></div>
              </div>
              <ul className="space-y-3 mb-10 text-sm text-gray-700 font-light">
                <li>✓ 5 training modules</li>
                <li>✓ 100+ dispute letters</li>
                <li>✓ Dashboard & tracking</li>
                <li>✓ Document vault</li>
              </ul>
              <Link href="/signup" className="w-full block text-center px-6 py-3 border border-gray-300 text-gray-800 text-sm font-medium hover:bg-gray-50 transition">
                Start DIY
              </Link>
            </div>

            <div className="border border-gray-200 p-10">
              <h3 className="text-lg font-semibold text-gray-800 mb-2">Coaching Session</h3>
              <p className="text-gray-600 font-light mb-8">Get personalized guidance from an expert.</p>
              <div className="mb-8">
                <div className="text-3xl font-light text-gray-800">$79<span className="text-sm font-light text-gray-600 ml-2">one-time</span></div>
              </div>
              <ul className="space-y-3 mb-10 text-sm text-gray-700 font-light">
                <li>✓ 30 minute session</li>
                <li>✓ Expert guidance</li>
                <li>✓ Credit review</li>
                <li>✓ Action plan</li>
              </ul>
              <button className="w-full px-6 py-3 border border-gray-300 text-gray-800 text-sm font-medium hover:bg-gray-50 transition disabled:opacity-50" disabled>
                Coming Soon
              </button>
            </div>

            <div className="border border-gray-800 p-10 bg-gray-800 text-white">
              <div className="mb-4">
                <span className="text-xs font-semibold tracking-wider">RECOMMENDED</span>
              </div>
              <h3 className="text-lg font-semibold mb-2">Managed</h3>
              <p className="text-gray-300 font-light mb-8">We handle it. You relax.</p>
              <div className="mb-8">
                <div className="text-3xl font-light">$249<span className="text-sm font-light text-gray-400 ml-2">/month</span></div>
              </div>
              <ul className="space-y-3 mb-10 text-sm text-gray-200 font-light">
                <li>✓ Everything in DIY</li>
                <li>✓ Certified mail sending</li>
                <li>✓ Daily status updates</li>
                <li>✓ Full dispute management</li>
              </ul>
              <Link href="/signup" className="w-full block text-center px-6 py-3 bg-white text-gray-800 text-sm font-medium hover:bg-gray-100 transition">
                Start Managed
              </Link>
            </div>
          </div>
        </div>
      </section>

      {/* CTA */}
      <section className="bg-gray-800 text-white">
        <div className="max-w-7xl mx-auto px-8 py-20 text-center">
          <h2 className="text-4xl font-light mb-8">Ready to improve your credit standing?</h2>
          <Link href="/signup" className="inline-block px-8 py-3 bg-white text-gray-800 text-sm font-semibold hover:bg-gray-100 transition">
            Get Started Free
          </Link>
        </div>
      </section>
    </div>
  );
}
