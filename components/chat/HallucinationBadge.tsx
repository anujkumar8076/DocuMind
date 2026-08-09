'use client';

import React, { useState } from 'react';
import { GroundednessResult } from '@/types';
import { ShieldCheck, AlertTriangle, AlertCircle, ChevronDown, ChevronUp, Sparkles, CheckCircle2 } from 'lucide-react';
import { Badge } from '@/components/ui/badge';

interface HallucinationBadgeProps {
  data?: GroundednessResult;
}

export function HallucinationBadge({ data }: HallucinationBadgeProps) {
  const [isExpanded, setIsExpanded] = useState(false);

  if (!data) return null;

  const scorePercent = Math.round((data.overallScore || 0) * 100);

  let badgeColor = 'bg-emerald-500/15 text-emerald-300 border-emerald-500/30 hover:bg-emerald-500/25';
  let Icon = ShieldCheck;
  let label = 'Fully Grounded';

  if (data.riskLevel === 'MEDIUM') {
    badgeColor = 'bg-amber-500/15 text-amber-300 border-amber-500/30 hover:bg-amber-500/25';
    Icon = AlertTriangle;
    label = 'Partially Inferred';
  } else if (data.riskLevel === 'HIGH') {
    badgeColor = 'bg-rose-500/15 text-rose-300 border-rose-500/30 hover:bg-rose-500/25';
    Icon = AlertCircle;
    label = 'Unverified Claims';
  }

  return (
    <div className="mt-2.5">
      <button
        onClick={() => setIsExpanded(!isExpanded)}
        className={`inline-flex items-center gap-1.5 px-2.5 py-1 rounded-md text-xs font-medium border transition-all cursor-pointer ${badgeColor}`}
      >
        <Icon className="h-3.5 w-3.5" />
        <span>{label} ({scorePercent}% Confidence)</span>
        {isExpanded ? <ChevronUp className="h-3 w-3 ml-1" /> : <ChevronDown className="h-3 w-3 ml-1" />}
      </button>

      {/* Expanded Sentence-by-Sentence Verification Drawer */}
      {isExpanded && (
        <div className="mt-3 p-4 rounded-xl glass-card border border-white/10 space-y-3 animate-in fade-in slide-in-from-top-2 duration-200">
          <div className="flex items-center justify-between pb-2 border-b border-white/10">
            <div className="flex items-center gap-2">
              <Sparkles className="h-4 w-4 text-violet-400" />
              <span className="text-xs font-semibold text-zinc-200">
                Hallucination & Claim Verification Breakdown
              </span>
            </div>
            <span className="text-[11px] text-zinc-400 font-mono">{data.summary}</span>
          </div>

          <div className="space-y-2">
            {data.annotatedSentences?.map((item, idx) => {
              let sentenceBorder = 'border-emerald-500/30 bg-emerald-950/20';
              let tagText = 'Grounded in Source';
              let tagColor = 'text-emerald-400 bg-emerald-500/10 border-emerald-500/20';

              if (item.status === 'INFERRED') {
                sentenceBorder = 'border-amber-500/30 bg-amber-950/20';
                tagText = 'Inferred / Synthesized';
                tagColor = 'text-amber-400 bg-amber-500/10 border-amber-500/20';
              } else if (item.status === 'HALLUCINATED') {
                sentenceBorder = 'border-rose-500/30 bg-rose-950/20';
                tagText = 'Unverified Extrapolation';
                tagColor = 'text-rose-400 bg-rose-500/10 border-rose-500/20';
              }

              return (
                <div
                  key={idx}
                  className={`p-2.5 rounded-lg border text-xs leading-relaxed space-y-1.5 ${sentenceBorder}`}
                >
                  <div className="flex items-center justify-between">
                    <span className={`text-[10px] font-mono font-semibold px-2 py-0.5 rounded border ${tagColor}`}>
                      {tagText} ({Math.round(item.confidence * 100)}%)
                    </span>
                    {item.groundingChunkId && (
                      <span className="text-[10px] text-zinc-400 font-mono">
                        Chunk ref: #{item.groundingChunkId.split('#')[1] || item.groundingChunkId.slice(0, 8)}
                      </span>
                    )}
                  </div>
                  <p className="text-zinc-200">{item.sentence}</p>
                  {item.reasoning && (
                    <p className="text-[11px] text-zinc-400 italic">💡 {item.reasoning}</p>
                  )}
                </div>
              );
            })}
          </div>
        </div>
      )}
    </div>
  );
}
