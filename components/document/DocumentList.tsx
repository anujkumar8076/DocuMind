'use client';

import React, { useState, useEffect } from 'react';
import Link from 'next/link';
import { DocumentCard } from './DocumentCard';
import { Button } from '@/components/ui/button';
import { UploadCloud, Search, RefreshCw, FileQuestion } from 'lucide-react';
import { DocumentStatus } from '@prisma/client';

export function DocumentList() {
  const [documents, setDocuments] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [searchQuery, setSearchQuery] = useState('');

  const fetchDocuments = async () => {
    setLoading(true);
    try {
      const res = await fetch('/api/documents');
      const data = await res.json();
      if (data.documents) {
        setDocuments(data.documents);
      }
    } catch (e) {
      console.error('Failed to load documents:', e);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchDocuments();
  }, []);

  const handleDelete = async (id: string) => {
    const res = await fetch(`/api/documents/${id}`, { method: 'DELETE' });
    if (res.ok) {
      setDocuments((prev) => prev.filter((d) => d.id !== id));
    }
  };

  const filteredDocs = documents.filter((doc) =>
    doc.name.toLowerCase().includes(searchQuery.toLowerCase()) ||
    doc.originalFilename.toLowerCase().includes(searchQuery.toLowerCase())
  );

  return (
    <div className="space-y-6">
      {/* Header and Controls */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold text-white tracking-tight">Document Knowledge Base</h1>
          <p className="text-sm text-zinc-400 mt-1">
            Manage your indexed PDF and text documents for vector search and RAG Q&A.
          </p>
        </div>

        <div className="flex items-center gap-3">
          <Button
            variant="outline"
            size="sm"
            onClick={fetchDocuments}
            disabled={loading}
            className="gap-1.5"
          >
            <RefreshCw className={`h-3.5 w-3.5 ${loading ? 'animate-spin' : ''}`} />
            Refresh
          </Button>

          <Link href="/upload">
            <Button size="sm" className="gap-1.5 shadow-lg shadow-violet-500/20">
              <UploadCloud className="h-4 w-4" />
              Upload Document
            </Button>
          </Link>
        </div>
      </div>

      {/* Search Filter */}
      <div className="relative max-w-md">
        <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-zinc-400" />
        <input
          type="text"
          placeholder="Filter documents by name..."
          value={searchQuery}
          onChange={(e) => setSearchQuery(e.target.value)}
          className="w-full pl-9 pr-4 py-2 text-sm rounded-lg bg-slate-900/80 border border-white/10 text-white placeholder:text-zinc-500 focus:outline-none focus:ring-2 focus:ring-violet-500"
        />
      </div>

      {/* Document Grid */}
      {loading ? (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
          {[1, 2, 3].map((n) => (
            <div key={n} className="glass-card h-48 rounded-xl animate-pulse p-6 border border-white/5" />
          ))}
        </div>
      ) : filteredDocs.length === 0 ? (
        <div className="glass-panel rounded-2xl p-12 text-center flex flex-col items-center justify-center border border-white/10 max-w-lg mx-auto mt-8">
          <div className="h-14 w-14 rounded-2xl bg-violet-600/10 border border-violet-500/20 flex items-center justify-center text-violet-400 mb-4">
            <FileQuestion className="h-7 w-7" />
          </div>
          <h3 className="text-lg font-semibold text-white">No documents found</h3>
          <p className="text-sm text-zinc-400 mt-1 max-w-sm">
            {searchQuery
              ? `No documents matching "${searchQuery}". Try clearing your search filter.`
              : 'Upload your first PDF or technical paper to start asking grounded questions.'}
          </p>
          {!searchQuery && (
            <Link href="/upload" className="mt-5">
              <Button className="gap-2">
                <UploadCloud className="h-4 w-4" />
                Upload Your First Document
              </Button>
            </Link>
          )}
        </div>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-5">
          {filteredDocs.map((doc) => (
            <DocumentCard
              key={doc.id}
              id={doc.id}
              name={doc.name}
              originalFilename={doc.originalFilename}
              status={doc.status}
              pageCount={doc.pageCount}
              chunkCount={doc.chunkCount || doc._count?.chunks || 0}
              tokenCount={doc.tokenCount}
              fileSize={doc.fileSize}
              createdAt={doc.createdAt}
              onDelete={handleDelete}
            />
          ))}
        </div>
      )}
    </div>
  );
}
