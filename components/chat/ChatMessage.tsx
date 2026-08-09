'use client';

import React, { useState } from 'react';
import { User, Sparkles, Copy, Check, Cpu } from 'lucide-react';
import { SourceCitation } from './SourceCitation';
import { HallucinationBadge } from './HallucinationBadge';
import { StreamingText } from './StreamingText';
import { GroundednessResult, SourceCitation as SourceCitationType } from '@/types';

export interface ChatMessageProps {
  id?: string;
  role: 'user' | 'assistant';
  content: string;
  sources?: SourceCitationType[];
  hallucinationData?: GroundednessResult;
  isStreaming?: boolean;
  tokensUsed?: number;
}

export function ChatMessage({
  role,
  content,
  sources,
  hallucinationData,
  isStreaming,
  tokensUsed,
}: ChatMessageProps) {
  const isUser = role === 'user';
  const [copied, setCopied] = useState(false);

  const handleCopy = () => {
    navigator.clipboard.writeText(content);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  return (
    <div
      className={`group relative flex gap-4 p-5 rounded-2xl transition-colors ${
        isUser
          ? 'bg-violet-950/20 border border-violet-500/10 ml-8'
          : 'glass-card border border-white/10 mr-8'
      }`}
    >
      {/* Avatar Icon */}
      <div
        className={`h-8 w-8 rounded-xl flex items-center justify-center shrink-0 ${
          isUser
            ? 'bg-zinc-800 text-zinc-200 border border-zinc-700'
            : 'bg-gradient-to-tr from-violet-600 to-indigo-600 text-white shadow-md shadow-violet-500/20'
        }`}
      >
        {isUser ? <User className="h-4 w-4" /> : <Sparkles className="h-4 w-4" />}
      </div>

      {/* Message Body */}
      <div className="flex-1 min-w-0 space-y-2">
        <div className="flex items-center justify-between">
          <span className="text-xs font-semibold text-zinc-300">
            {isUser ? 'You' : 'DocuMind RAG Agent'}
          </span>

          <div className="flex items-center gap-2 opacity-0 group-hover:opacity-100 transition-opacity">
            <button
              onClick={handleCopy}
              className="p-1 rounded hover:bg-white/10 text-zinc-400 hover:text-zinc-200 transition-colors"
              title="Copy message"
            >
              {copied ? <Check className="h-3.5 w-3.5 text-emerald-400" /> : <Copy className="h-3.5 w-3.5" />}
            </button>
          </div>
        </div>

        {/* Content */}
        <StreamingText content={content} isStreaming={isStreaming} />

        {/* Hallucination Badge & Sentence Annotations */}
        {!isUser && !isStreaming && hallucinationData && (
          <HallucinationBadge data={hallucinationData} />
        )}

        {/* Source Citations */}
        {!isUser && !isStreaming && sources && sources.length > 0 && (
          <SourceCitation sources={sources} />
        )}

        {/* Token and model metrics footer */}
        {!isUser && !isStreaming && (
          <div className="flex items-center gap-3 pt-2 text-[10px] text-zinc-400 font-mono">
            <span className="flex items-center gap-1">
              <Cpu className="h-3 w-3" /> GPT-4o + text-embedding-3-small
            </span>
            {tokensUsed ? <span>• ~{tokensUsed} tokens</span> : null}
          </div>
        )}
      </div>
    </div>
  );
}
