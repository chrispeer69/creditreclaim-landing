'use client';
import { useState } from 'react';
import { useRouter } from 'next/navigation';
import Link from 'next/link';

export default function SignupPage() {
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const router = useRouter();

  const handleSignup = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    setError('');
    try {
      const res = await fetch('/api/auth/signup', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ email, password }),
      });
      if (!res.ok) {
        const { error: apiError } = await res.json();
        throw new Error(apiError);
      }
      router.push('/tier-selection');
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Signup failed');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="min-h-screen bg-white">
      {/* Nav */}
      <nav className="border-b border-gray-200 bg-white">
        <div className="max-w-7xl mx-auto px-8 py-5 flex justify-between items-center">
          <Link href="/" className="text-2xl font-light tracking-tight text-gray-900">
            Credit<span className="font-semibold">Reclaim</span>
          </Link>
          <Link href="/login" className="text-sm text-gray-600 hover:text-gray-900 font-medium">Sign In</Link>
        </div>
      </nav>

      {/* Content */}
      <div className="flex items-center justify-center min-h-[calc(100vh-70px)]">
        <div className="w-full max-w-md px-8">
          <Link href="/" className="text-sm text-gray-600 hover:text-gray-900 mb-12 inline-flex items-center gap-2">
            ← Back
          </Link>

          <div className="mb-12">
            <h1 className="text-4xl font-light text-gray-900 mb-3">Create Account</h1>
            <p className="text-gray-600 font-light">Start your credit repair journey.</p>
          </div>

          <form onSubmit={handleSignup} className="space-y-6">
            <div>
              <label className="block text-sm font-medium text-gray-900 mb-3">Email Address</label>
              <input
                type="email"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                className="w-full px-4 py-3 border border-gray-200 bg-white text-gray-900 text-base focus:outline-none focus:border-gray-900 transition"
                placeholder="you@example.com"
                required
              />
            </div>

            <div>
              <label className="block text-sm font-medium text-gray-900 mb-3">Password</label>
              <input
                type="password"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                className="w-full px-4 py-3 border border-gray-200 bg-white text-gray-900 text-base focus:outline-none focus:border-gray-900 transition"
                placeholder="••••••••"
                required
              />
              <p className="text-xs text-gray-600 font-light mt-2">At least 8 characters</p>
            </div>

            {error && (
              <div className="p-4 border border-red-300 bg-red-50">
                <p className="text-sm text-red-900 font-medium">{error}</p>
              </div>
            )}

            <button
              type="submit"
              disabled={loading}
              className="w-full py-3 bg-gray-900 text-white text-sm font-medium hover:bg-gray-800 transition disabled:opacity-50 mt-8"
            >
              {loading ? 'Creating Account...' : 'Create Account'}
            </button>
          </form>

          <div className="mt-10 pt-10 border-t border-gray-200">
            <p className="text-sm text-gray-600 font-light text-center">
              Already have an account? <Link href="/login" className="text-gray-900 font-medium hover:underline">Sign in</Link>
            </p>
          </div>

          <p className="text-center text-gray-600 font-light text-xs mt-10">
            By signing up, you agree to our <a href="#" className="text-gray-900 hover:underline">Terms</a> and <a href="#" className="text-gray-900 hover:underline">Privacy Policy</a>
          </p>
        </div>
      </div>
    </div>
  );
}
