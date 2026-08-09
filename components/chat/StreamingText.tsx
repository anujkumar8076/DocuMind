'use client';

import React from 'react';

interface StreamingTextProps {
  content: string;
  isStreaming?: boolean;
}

export function StreamingText({ content, isStreaming }: StreamingTextProps) {
  // Format source citations inline like [SOURCE 1] into highlighted badges
  const renderFormattedText = (text: string) => {
    const parts = text.split(/(\[SOURCE \d+\])/g);

    return parts.map((part, index) => {
      const match = part.match(/\[SOURCE (\d+)\]/);
      if (match) {
        return (
          <span
            key={index}
            className="inline-flex items-center px-1.5 py-0.2 mx-1 text-[11px] font-mono font-bold rounded bg-violet-500/20 text-violet-300 border border-violet-500/40 select-none shadow-sm align-baseline"
          >
            S{match[1]}
          </span>
        );
      }
      return <span key={index}>{part}</span>;
    });
  };

  return (
    <div className="prose prose-invert prose-sm max-w-none leading-relaxed text-zinc-100 whitespace-pre-wrap font-sans">
      {renderFormattedText(content)}
      {isStreaming && (
        <span className="inline-block w-2 h-4 ml-1 bg-violet-400 animate-pulse rounded-sm align-middle" />
      )}
    </div>
  );
}
