import { useEffect, useState } from 'react';
import Head from 'next/head';
import { useRouter } from 'next/router';
import { authenticate, getSession, setSession } from '../lib/auth';
import BrandLogo from '../components/BrandLogo';

export default function LoginPage() {
  const router = useRouter();
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError] = useState('');
  const [isLoading, setIsLoading] = useState(false);
  const [showPassword, setShowPassword] = useState(false);

  useEffect(() => {
    const session = getSession();
    if (session) {
      router.replace('/');
    }
  }, [router]);

  const handleLogin = async (e) => {
    e.preventDefault();
    setError('');

    if (!email.trim() || !password) {
      setError('Please enter email and password');
      return;
    }

    setIsLoading(true);
    await new Promise((r) => setTimeout(r, 500));

    const user = authenticate(email, password);

    if (!user) {
      setError('Invalid email or password');
      setIsLoading(false);
      return;
    }

    setSession(user);

    const { saveSetting } = await import('../lib/db');
    await saveSetting('agentName', user.name);
    await saveSetting('agentEmail', user.email);
    await saveSetting('agentEmployeeId', user.id);

    router.push('/');
  };

  return (
    <>
      <Head>
        <title>Sign In | HEIPL-E2P</title>
      </Head>
      <div className="flex min-h-screen items-center justify-center bg-gray-50 px-4">
        <div className="w-full max-w-sm">
          <div className="mb-8 text-center">
            <div className="mx-auto mb-4 flex h-24 w-24 items-center justify-center rounded-2xl bg-white shadow-lg">
              <BrandLogo size={80} className="h-20 w-20" />
            </div>
            <h1 className="text-2xl font-bold text-navy-600">HEIPL-E2P</h1>
            <p className="mt-1 text-sm text-gray-500">Energy Efficient Program</p>
          </div>

          <div className="rounded-2xl bg-white p-6 shadow-xl">
            <h2 className="mb-4 text-center text-lg font-semibold text-gray-800">
              Sign In
            </h2>

            <form onSubmit={handleLogin} className="space-y-4">
              <div>
                <label className="mb-1 block text-sm font-medium text-gray-700">
                  Email
                </label>
                <input
                  type="email"
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  placeholder="agent@heipl.com"
                  className="w-full rounded-xl border border-gray-300 px-4 py-3 text-base focus:outline-none focus:ring-2 focus:ring-primary-600"
                  autoComplete="email"
                  autoCapitalize="none"
                />
              </div>

              <div>
                <label className="mb-1 block text-sm font-medium text-gray-700">
                  Password
                </label>
                <div className="relative">
                  <input
                    type={showPassword ? 'text' : 'password'}
                    value={password}
                    onChange={(e) => setPassword(e.target.value)}
                    placeholder="Enter password"
                    className="w-full rounded-xl border border-gray-300 px-4 py-3 pr-12 text-base focus:outline-none focus:ring-2 focus:ring-primary-600"
                    autoComplete="current-password"
                  />
                  <button
                    type="button"
                    onClick={() => setShowPassword(!showPassword)}
                    className="absolute right-3 top-1/2 -translate-y-1/2 text-sm text-gray-400"
                  >
                    {showPassword ? '🙈' : '👁️'}
                  </button>
                </div>
              </div>

              {error && (
                <div className="rounded-lg border border-red-200 bg-red-50 p-3 text-center text-sm text-red-700">
                  {error}
                </div>
              )}

              <button
                type="submit"
                disabled={isLoading}
                className="w-full rounded-xl bg-primary-600 py-3 text-base font-semibold text-white active:bg-primary-700 disabled:opacity-50"
              >
                {isLoading ? 'Signing in...' : 'Sign In'}
              </button>
            </form>

            <p className="mt-4 text-center text-xs text-gray-400">
              Contact your admin if you forgot your credentials
            </p>
          </div>
        </div>
      </div>
    </>
  );
}
