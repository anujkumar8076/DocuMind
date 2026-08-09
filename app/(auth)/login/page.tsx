'use client';

import React, { useState } from 'react';
import { signIn } from 'next-auth/react';
import { useRouter } from 'next/navigation';
import { Sparkles, Github, ArrowRight, ShieldCheck } from 'lucide-react';
import { Button } from '@/components/ui/button';

export default function LoginPage() {
  const router = useRouter();
  const [email, setEmail] = useState('alex@documind.ai');
  const [loading, setLoading] = useState(false);

  const handleDemoSignIn = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    try {
      const res = await signIn('credentials', {
        email,
        redirect: false,
      });

      if (res?.ok) {
        router.push('/dashboard');
      }
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="min-h-screen flex flex-col items-center justify-center bg-slate-950 p-6 relative overflow-hidden">
      <div className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-[500px] h-[500px] bg-violet-600/15 rounded-full blur-[130px] pointer-events-none" />

      <div className="glass-panel w-full max-w-md rounded-2xl p-8 border border-white/10 space-y-6 shadow-2xl">
        <div className="text-center space-y-2">
          <div className="inline-flex h-12 w-12 rounded-2xl bg-gradient-to-tr from-violet-600 to-indigo-600 items-center justify-center text-white shadow-lg shadow-violet-500/25 mb-2">
            <Sparkles className="h-6 w-6" />
          </div>
          <h1 className="text-2xl font-bold text-white tracking-tight">Welcome to DocuMind</h1>
          <p className="text-xs text-zinc-400">
            Sign in to access your document knowledge base and grounded RAG models.
          </p>
        </div>

        {/* Demo Fast Login */}
        <form onSubmit={handleDemoSignIn} className="space-y-4">
          <div>
            <label className="text-xs font-semibold text-zinc-300 block mb-1.5">
              Account Email
            </label>
            <input
              type="email"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              className="w-full px-4 py-2.5 rounded-lg bg-slate-900/80 border border-white/10 text-white text-sm focus:outline-none focus:ring-2 focus:ring-violet-500"
              required
            />
          </div>

          <Button
            type="submit"
            disabled={loading}
            className="w-full h-11 text-sm font-semibold shadow-lg shadow-violet-500/20 gap-2"
          >
            <span>{loading ? 'Authenticating...' : 'Sign In with Demo Account'}</span>
            <ArrowRight className="h-4 w-4" />
          </Button>
        </form>

        <div className="relative flex items-center justify-center">
          <div className="border-t border-white/10 w-full" />
          <span className="bg-slate-950 px-3 text-[11px] text-zinc-500 uppercase tracking-wider font-mono absolute">
            or OAuth
          </span>
        </div>

        {/* OAuth Buttons */}
        <div className="space-y-2">
          <Button
            variant="outline"
            onClick={() => signIn('github', { callbackUrl: '/dashboard' })}
            className="w-full h-10 gap-2 text-xs"
          >
            <Github className="h-4 w-4" />
            Continue with GitHub
          </Button>

          <Button
            variant="outline"
            onClick={() => signIn('google', { callbackUrl: '/dashboard' })}
            className="w-full h-10 gap-2 text-xs"
          >
            <svg className="h-4 w-4" viewBox="0 0 24 24">
              <path
                fill="currentColor"
                d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92c-.26 1.37-1.04 2.53-2.21 3.31v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.09z"
              />
              <path
                fill="currentColor"
                d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z"
              />
              <path
                fill="currentColor"
                d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.06H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.94l2.85-2.22.81-.63z"
              />
              <path
                fill="currentColor"
                d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.06l3.66 2.84c.87-2.6 3.3-4.52 6.16-4.52z"
              />
            </svg>
            Continue with Google
          </Button>
        </div>
      </div>
    </div>
  );
}
