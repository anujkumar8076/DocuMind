'use client';

import React from 'react';
import Link from 'next/link';
import { Header } from '@/components/layout/Header';
import { Button } from '@/components/ui/button';
import {
  Sparkles,
  ShieldCheck,
  FileText,
  Search,
  Database,
  Cpu,
  ArrowRight,
  CheckCircle,
  Layers,
  Zap,
} from 'lucide-react';

export default function LandingPage() {
  return (
    <div className="min-h-screen flex flex-col bg-slate-950 text-slate-100 selection:bg-violet-500/30">
      <Header />

      {/* Hero Section */}
      <main className="flex-1 flex flex-col items-center justify-center text-center px-6 py-20 relative overflow-hidden">
        <div className="absolute top-1/4 left-1/2 -translate-x-1/2 -translate-y-1/2 w-[600px] h-[600px] bg-violet-600/15 rounded-full blur-[140px] pointer-events-none -z-10" />

        <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full bg-violet-500/10 border border-violet-500/20 text-violet-300 text-xs font-semibold uppercase tracking-wider mb-6 animate-pulse-subtle">
          <Sparkles className="h-3.5 w-3.5" />
          <span>Production RAG Architecture</span>
        </div>

        <h1 className="text-4xl sm:text-6xl md:text-7xl font-extrabold tracking-tight max-w-4xl text-white leading-tight">
          Ask anything about your documents.{' '}
          <span className="bg-gradient-to-r from-violet-400 via-indigo-300 to-cyan-400 bg-clip-text text-transparent">
            Get answers with proof.
          </span>
        </h1>

        <p className="mt-6 text-lg sm:text-xl text-zinc-400 max-w-2xl leading-relaxed">
          DocuMind combines modern PDF extraction, Supabase vector search, Groq LPU streaming (Llama 3.3 70B @ 500 T/s),
          and automated hallucination verification for portfolio-grade document intelligence.
        </p>

        <div className="mt-8 flex flex-col sm:flex-row items-center gap-4">
          <Link href="/dashboard">
            <Button size="lg" className="gap-2 text-base shadow-xl shadow-violet-500/25 cursor-pointer">
              Launch Document Workspace
              <ArrowRight className="h-4 w-4" />
            </Button>
          </Link>

          <Link href="/upload">
            <Button size="lg" variant="outline" className="gap-2 text-base cursor-pointer">
              Upload Document
            </Button>
          </Link>
        </div>

        {/* Feature Grid */}
        <div className="mt-20 grid grid-cols-1 md:grid-cols-3 gap-6 max-w-5xl text-left">
          <div className="glass-card rounded-2xl p-6 border border-white/10 space-y-3">
            <div className="h-10 w-10 rounded-xl bg-violet-500/10 border border-violet-500/20 flex items-center justify-center text-violet-400">
              <ShieldCheck className="h-5 w-5" />
            </div>
            <h3 className="text-lg font-bold text-white">Hallucination Guard</h3>
            <p className="text-sm text-zinc-400 leading-relaxed">
              Every generated answer undergoes sentence-level grounding verification against
              retrieved chunks to prevent LLM confabulation.
            </p>
          </div>

          <div className="glass-card rounded-2xl p-6 border border-white/10 space-y-3">
            <div className="h-10 w-10 rounded-xl bg-indigo-500/10 border border-indigo-500/20 flex items-center justify-center text-indigo-400">
              <Database className="h-5 w-5" />
            </div>
            <h3 className="text-lg font-bold text-white">Supabase & Vector Store</h3>
            <p className="text-sm text-zinc-400 leading-relaxed">
              Consolidated PostgreSQL vector storage with hybrid dense similarity and BM25 lexical reranking for
              high-precision recall (with optional Pinecone cloud isolation).
            </p>
          </div>

          <div className="glass-card rounded-2xl p-6 border border-white/10 space-y-3">
            <div className="h-10 w-10 rounded-xl bg-cyan-500/10 border border-cyan-500/20 flex items-center justify-center text-cyan-400">
              <Zap className="h-5 w-5" />
            </div>
            <h3 className="text-lg font-bold text-white">Groq LPU 500 T/s Streaming</h3>
            <p className="text-sm text-zinc-400 leading-relaxed">
              Ultra-fast token streaming powered by Llama 3.3 70B with clickable, chunk-level attribution
              and page citations backing every statement.
            </p>
          </div>
        </div>
      </main>

      {/* Footer */}
      <footer className="border-t border-white/10 py-6 text-center text-xs text-zinc-500">
        <p>DocuMind • Built with Next.js 14, Groq LPU, Supabase Postgres, LangChain.js & unpdf</p>
      </footer>
    </div>
  );
}
