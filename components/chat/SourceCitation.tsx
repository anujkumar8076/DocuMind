'use client';

import React, { useState } from 'react';
import { SourceCitation as SourceCitationType } from '@/types';
import { FileText, ChevronDown, ChevronUp, Copy, Check, Hash } from 'lucide-react';
import { Badge } from '@/components/ui/badge';

interface SourceCitationProps {
  sources: SourceCitationType[];
}

export function SourceCitation({ sources }: SourceCitationProps) {
  const [expandedIndex, setExpandedIndex] = useState<number | null>(null);
  const [copiedId, setCopiedId] = useState<string | null>(null);

  if (!sources || sources.length === 0) return null;

  const handleCopy = (id: string, text: string) => {
    navigator.clipboard.writeText(text);
    setCopiedId(id);
    setTimeout(() => setCopiedId(null), 2000);
  };

  return (
    <div className="mt-4 pt-3 border-t border-white/10">
      <div className="flex items-center gap-2 mb-2">
        <span className="text-xs font-semibold uppercase tracking-wider text-zinc-400">
          Source Citations ({sources.length})
        </span>
      </div>

      <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
        {sources.map((source, idx) => {
          const isExpanded = expandedIndex === idx;
          const scorePercent = Math.round(source.score * 100);

          let scoreBadgeVariant: 'success' | 'warning' | 'default' = 'default';
          if (scorePercent >= 80) scoreBadgeVariant = 'success';
          else if (scorePercent >= 60) scoreBadgeVariant = 'warning';

          return (
            <div
              key={source.id || idx}
              className="glass-card rounded-lg p-3 border border-white/5 hover:border-violet-500/30 transition-all text-xs"
            >
              <div className="flex items-start justify-between gap-2">
                <div className="flex items-center gap-1.5 font-medium text-zinc-200 truncate">
                  <div className="h-5 w-5 rounded bg-violet-500/20 text-violet-300 flex items-center justify-center font-mono text-[10px] font-bold shrink-0">
                    {idx + 1}
                  </div>
                  <FileText className="h-3.5 w-3.5 text-zinc-400 shrink-0" />
                  <span className="truncate">{source.documentName}</span>
                </div>

                <div className="flex items-center gap-1 shrink-0">
                  {source.pageNumber && (
                    <span className="text-[10px] text-zinc-400 font-mono">
                      p.{source.pageNumber}
                    </span>
                  )}
                  <Badge variant={scoreBadgeVariant} className="text-[10px] px-1.5 py-0">
                    {scorePercent}% match
                  </Badge>
                </div>
              </div>

              {/* Chunk Content Excerpt */}
              <div className="mt-2 text-zinc-400 font-mono text-[11px] leading-relaxed">
                {isExpanded ? source.content : `${source.content.slice(0, 140)}...`}
              </div>

              <div className="mt-2.5 flex items-center justify-between pt-2 border-t border-white/5 text-[10px] text-zinc-400">
                <button
                  onClick={() => setExpandedIndex(isExpanded ? null : idx)}
                  className="flex items-center gap-1 text-violet-400 hover:text-violet-300 transition-colors"
                >
                  {isExpanded ? (
                    <>
                      <ChevronUp className="h-3 w-3" /> Less
                    </>
                  ) : (
                    <>
                      <ChevronDown className="h-3 w-3" /> Full Chunk ({source.content.length} chars)
                    </>
                  )}
                </button>

                <button
                  onClick={() => handleCopy(source.id, source.content)}
                  className="flex items-center gap-1 hover:text-zinc-200 transition-colors"
                >
                  {copiedId === source.id ? (
                    <>
                      <Check className="h-3 w-3 text-emerald-400" /> Copied
                    </>
                  ) : (
                    <>
                      <Copy className="h-3 w-3" /> Copy Excerpt
                    </>
                  )}
                </button>
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}
