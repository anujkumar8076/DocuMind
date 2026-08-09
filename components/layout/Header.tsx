'use client';

import React from 'react';
import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { Sparkles, FileText, UploadCloud, MessageSquare, ShieldCheck, Zap } from 'lucide-react';
import { Button } from '@/components/ui/button';

export function Header() {
  const pathname = usePathname();

  return (
    <header className="sticky top-0 z-40 w-full border-b border-white/10 glass-panel">
      <div className="flex h-16 items-center justify-between px-6">
        <div className="flex items-center gap-6">
          <Link href="/" className="flex items-center gap-2 group">
            <div className="h-9 w-9 rounded-xl bg-gradient-to-tr from-violet-600 to-indigo-500 flex items-center justify-center shadow-lg shadow-violet-500/25 group-hover:scale-105 transition-transform">
              <Sparkles className="h-5 w-5 text-white" />
            </div>
            <div className="flex flex-col">
              <span className="font-bold text-lg bg-gradient-to-r from-white via-zinc-200 to-zinc-400 bg-clip-text text-transparent">
                DocuMind
              </span>
              <span className="text-[10px] text-violet-400 font-mono -mt-1 font-semibold tracking-wider">
                PRODUCTION RAG
              </span>
            </div>
          </Link>

          <nav className="hidden md:flex items-center gap-1">
            <Link href="/dashboard">
              <Button
                variant={pathname === '/dashboard' ? 'secondary' : 'ghost'}
                size="sm"
                className="gap-2 text-zinc-300 hover:text-white"
              >
                <FileText className="h-4 w-4" />
                Library
              </Button>
            </Link>
            <Link href="/upload">
              <Button
                variant={pathname === '/upload' ? 'secondary' : 'ghost'}
                size="sm"
                className="gap-2 text-zinc-300 hover:text-white"
              >
                <UploadCloud className="h-4 w-4" />
                Upload
              </Button>
            </Link>
            <Link href="/chat">
              <Button
                variant={pathname?.startsWith('/chat') ? 'secondary' : 'ghost'}
                size="sm"
                className="gap-2 text-zinc-300 hover:text-white"
              >
                <MessageSquare className="h-4 w-4" />
                Ask AI
              </Button>
            </Link>
          </nav>
        </div>

        <div className="flex items-center gap-3">
          <div className="hidden sm:flex items-center gap-2 px-3 py-1 rounded-full bg-emerald-500/10 border border-emerald-500/20 text-emerald-400 text-xs font-mono">
            <ShieldCheck className="h-3.5 w-3.5" />
            <span>Hallucination Guard Active</span>
          </div>

          <div className="flex items-center gap-2 px-3 py-1 rounded-full bg-amber-500/10 border border-amber-500/20 text-amber-300 text-xs font-medium">
            <Zap className="h-3.5 w-3.5" />
            <span>Groq LPU 500 T/s + Supabase</span>
          </div>

          <Link href="/login">
            <Button size="sm" variant="outline" className="text-xs">
              Demo Account
            </Button>
          </Link>
        </div>
      </div>
    </header>
  );
}
