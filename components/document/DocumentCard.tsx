'use client';

import React, { useState } from 'react';
import Link from 'next/link';
import { FileText, Trash2, MessageSquare, Layers, Clock, AlertTriangle, CheckCircle2, Loader2 } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { formatBytes, formatDate } from '@/lib/utils';
import { DocumentStatus } from '@prisma/client';

export interface DocumentCardProps {
  id: string;
  name: string;
  originalFilename: string;
  status: DocumentStatus;
  pageCount: number;
  chunkCount: number;
  tokenCount: number;
  fileSize: number;
  createdAt: string | Date;
  onDelete?: (id: string) => Promise<void>;
}

export function DocumentCard({
  id,
  name,
  originalFilename,
  status,
  pageCount,
  chunkCount,
  tokenCount,
  fileSize,
  createdAt,
  onDelete,
}: DocumentCardProps) {
  const [isDeleting, setIsDeleting] = useState(false);

  const handleDelete = async (e: React.MouseEvent) => {
    e.preventDefault();
    e.stopPropagation();
    if (confirm(`Are you sure you want to delete "${name}" and all its vector embeddings?`)) {
      setIsDeleting(true);
      try {
        if (onDelete) await onDelete(id);
      } finally {
        setIsDeleting(false);
      }
    }
  };

  const getStatusBadge = () => {
    switch (status) {
      case DocumentStatus.READY:
        return (
          <Badge variant="success" className="gap-1 text-[10px]">
            <CheckCircle2 className="h-3 w-3" /> Indexed & Ready
          </Badge>
        );
      case DocumentStatus.PROCESSING:
        return (
          <Badge variant="warning" className="gap-1 text-[10px] animate-pulse">
            <Loader2 className="h-3 w-3 animate-spin" /> Chunking & Embedding
          </Badge>
        );
      case DocumentStatus.ERROR:
        return (
          <Badge variant="destructive" className="gap-1 text-[10px]">
            <AlertTriangle className="h-3 w-3" /> Ingestion Error
          </Badge>
        );
      default:
        return (
          <Badge variant="default" className="text-[10px]">
            Pending
          </Badge>
        );
    }
  };

  return (
    <div className="group glass-card rounded-xl p-5 border border-white/10 hover:border-violet-500/40 transition-all duration-200 hover:shadow-xl hover:shadow-violet-950/20 flex flex-col justify-between">
      <div>
        <div className="flex items-start justify-between gap-3">
          <div className="h-10 w-10 rounded-lg bg-violet-600/10 border border-violet-500/20 flex items-center justify-center text-violet-400 shrink-0 group-hover:scale-105 transition-transform">
            <FileText className="h-5 w-5" />
          </div>

          <div className="flex items-center gap-2">
            {getStatusBadge()}
            <button
              onClick={handleDelete}
              disabled={isDeleting}
              className="p-1.5 rounded-md text-zinc-500 hover:text-rose-400 hover:bg-rose-500/10 transition-colors"
              title="Delete Document"
            >
              <Trash2 className="h-4 w-4" />
            </button>
          </div>
        </div>

        <div className="mt-3">
          <h3 className="font-semibold text-white text-base truncate group-hover:text-violet-300 transition-colors">
            {name}
          </h3>
          <p className="text-xs text-zinc-400 truncate mt-0.5">{originalFilename}</p>
        </div>

        {/* Metadata Grid */}
        <div className="mt-4 grid grid-cols-3 gap-2 py-3 border-y border-white/5 text-xs text-zinc-300">
          <div>
            <span className="text-[10px] text-zinc-400 block font-mono">PAGES</span>
            <span className="font-medium">{pageCount || 1}</span>
          </div>
          <div>
            <span className="text-[10px] text-zinc-400 block font-mono">CHUNKS</span>
            <span className="font-medium flex items-center gap-1">
              <Layers className="h-3 w-3 text-violet-400" />
              {chunkCount}
            </span>
          </div>
          <div>
            <span className="text-[10px] text-zinc-400 block font-mono">TOKENS</span>
            <span className="font-medium">~{tokenCount.toLocaleString()}</span>
          </div>
        </div>
      </div>

      <div className="mt-4 flex items-center justify-between pt-2 text-xs">
        <span className="text-zinc-400 flex items-center gap-1 text-[11px]">
          <Clock className="h-3 w-3" /> {formatDate(createdAt)}
        </span>

        {status === DocumentStatus.READY ? (
          <Link href={`/chat/${id}`}>
            <Button size="sm" className="gap-1.5 text-xs h-8">
              <MessageSquare className="h-3.5 w-3.5" />
              Ask Document
            </Button>
          </Link>
        ) : (
          <Button size="sm" variant="outline" disabled className="text-xs h-8">
            {status === DocumentStatus.PROCESSING ? 'Processing...' : 'Unavailable'}
          </Button>
        )}
      </div>
    </div>
  );
}
