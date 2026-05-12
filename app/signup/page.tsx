'use client';
import { useState } from 'react';
import { useRouter } from 'next/navigation';
import Link from 'next/link';
import { supabase } from '@/lib/supabase';

export default function SignupPage() {
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [confirmationSent, setConfirmationSent] = useState(false);
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
      const body = await res.json();
      if (!res.ok) {
        throw new Error(body.error || 'Signup failed');
      }
      // Email confirmation off → server returns a session; we persist it
      // and drop the user straight into the dashboard. Confirmation on →
      // session is null and we show the "check your email" view instead
      // of routing into a logged-out dashboard that would just bounce to
      // /login.
      const session = body.session;
      if (session?.access_token && session?.refresh_token) {
        await supabase.auth.setSession({
          access_token: session.access_token,
          refresh_token: session.refresh_token,
        });
        router.push('/dashboard');
        return;
      }
      setConfirmationSent(true);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Signup failed');
    } finally {
      setLoading(false);
    }
  };

  if (confirmationSent) {
    return (
      <div className="min-h-screen bg-white">
        <nav className="border-b border-gray-200 bg-white">
          <div className="max-w-7xl mx-auto px-8 py-5 flex justify-between items-center">
            <Link href="/" className="text-2xl font-light tracking-tight text-gray-900">
              Credit<span className="font-semibold">Reclaim</span>
            </Link>
            <Link href="/login" className="text-sm text-gray-600 hover:text-gray-900 font-medium">Sign In</Link>
          </div>
        </nav>

        <div className="flex items-center justify-center min-h-[calc(100vh-70px)]">
          <div className="w-full max-w-md px-8 text-center">
            <h1 className="text-4xl font-light text-gray-900 mb-4">Check your email</h1>
            <p className="text-gray-600 font-light mb-2">
              We sent a confirmation link to
            </p>
            <p className="text-gray-900 font-medium mb-8 break-all">{email}</p>
            <p className="text-gray-600 font-light mb-10">
              Click the link to activate your account, then sign in.
            </p>
            <Link
              href="/login"
              className="inline-block px-8 py-3 bg-gray-900 text-white text-sm font-medium hover:bg-gray-800 transition"
            >
              Go to sign in
            </Link>
            <p className="text-xs text-gray-500 font-light mt-8">
              Didn&apos;t get it? Check spam, then try again from{' '}
              <Link href="/signup" className="underline">signup</Link>.
            </p>
          </div>
        </div>
      </div>
    );
  }

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
