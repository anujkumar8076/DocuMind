'use client';

import React, { useState, useRef } from 'react';
import { useRouter } from 'next/navigation';
import {
  UploadCloud,
  FileText,
  CheckCircle2,
  AlertCircle,
  Loader2,
  ArrowRight,
  FileCode,
  Sparkles,
  AlignLeft,
} from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Progress } from '@/components/ui/progress';
import { formatBytes } from '@/lib/utils';

type UploadMode = 'file' | 'text';
type UploadStep = 'IDLE' | 'UPLOADING' | 'COMPLETED' | 'ERROR';

export function UploadDropzone() {
  const router = useRouter();
  const fileInputRef = useRef<HTMLInputElement>(null);

  const [mode, setMode] = useState<UploadMode>('file');
  const [file, setFile] = useState<File | null>(null);
  const [rawText, setRawText] = useState('');
  const [docTitle, setDocTitle] = useState('');

  const [isDragActive, setIsDragActive] = useState(false);
  const [step, setStep] = useState<UploadStep>('IDLE');
  const [uploadPercent, setUploadPercent] = useState<number>(0);
  const [processingStatus, setProcessingStatus] = useState<string>('');
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const [createdDocumentId, setCreatedDocumentId] = useState<string | null>(null);

  // Drag and drop handlers
  const handleDragOver = (e: React.DragEvent) => {
    e.preventDefault();
    e.stopPropagation();
    setIsDragActive(true);
  };

  const handleDragLeave = (e: React.DragEvent) => {
    e.preventDefault();
    e.stopPropagation();
    setIsDragActive(false);
  };

  const handleDrop = (e: React.DragEvent) => {
    e.preventDefault();
    e.stopPropagation();
    setIsDragActive(false);

    if (e.dataTransfer.files && e.dataTransfer.files.length > 0) {
      const droppedFile = e.dataTransfer.files[0];
      if (droppedFile) {
        if (droppedFile.size > 50 * 1024 * 1024) {
          setErrorMessage('File size exceeds 50MB limit.');
          return;
        }
        setFile(droppedFile);
        setErrorMessage(null);
      }
    }
  };

  const handleFileInputChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    if (e.target.files && e.target.files.length > 0) {
      const selected = e.target.files[0];
      if (selected) {
        if (selected.size > 50 * 1024 * 1024) {
          setErrorMessage('File size exceeds 50MB limit.');
          return;
        }
        setFile(selected);
        setErrorMessage(null);
      }
    }
  };

  // Upload handler
  const handleUploadAndProcess = async () => {
    let uploadFile = file;

    if (mode === 'text') {
      if (!rawText.trim()) {
        setErrorMessage('Please paste or enter some text.');
        return;
      }
      const title = docTitle.trim() || 'Pasted Document';
      const blob = new Blob([rawText], { type: 'text/plain' });
      uploadFile = new File([blob], `${title}.txt`, { type: 'text/plain' });
    }

    if (!uploadFile) {
      setErrorMessage('Please select a file to upload.');
      return;
    }

    try {
      setStep('UPLOADING');
      setUploadPercent(20);
      setProcessingStatus('Uploading and parsing document...');
      setErrorMessage(null);

      const formData = new FormData();
      formData.append('file', uploadFile);

      // Progress animation
      const timer = setInterval(() => {
        setUploadPercent((prev) => {
          if (prev >= 85) {
            clearInterval(timer);
            return 85;
          }
          return prev + 20;
        });
      }, 400);

      const res = await fetch('/api/upload', {
        method: 'POST',
        body: formData,
      });

      clearInterval(timer);

      if (!res.ok) {
        const errData = await res.json().catch(() => ({ error: 'Upload failed' }));
        throw new Error(errData.error || `Upload failed (HTTP ${res.status})`);
      }

      const data = await res.json();
      setUploadPercent(100);
      setStep('COMPLETED');
      setCreatedDocumentId(data.document.id);
      setProcessingStatus(
        `Successfully indexed ${data.chunkCount || 0} chunks (~${data.tokenCount || 0} tokens).`
      );
    } catch (error: unknown) {
      console.error('Upload error:', error);
      setStep('ERROR');
      const msg = error instanceof Error ? error.message : 'An error occurred during upload.';
      setErrorMessage(msg);
    }
  };

  return (
    <div className="max-w-2xl mx-auto space-y-6">
      <div className="text-center space-y-2">
        <h2 className="text-3xl font-bold text-white tracking-tight">Upload Document</h2>
        <p className="text-sm text-zinc-400">
          Upload PDF papers, research reports, or paste text to index for RAG Q&A.
        </p>
      </div>

      {/* Mode Switch Tabs */}
      <div className="flex rounded-xl bg-slate-900/80 p-1 border border-white/10 max-w-sm mx-auto">
        <button
          type="button"
          onClick={() => setMode('file')}
          className={`flex-1 flex items-center justify-center gap-2 py-2 text-xs font-semibold rounded-lg transition-all ${
            mode === 'file'
              ? 'bg-violet-600 text-white shadow-md'
              : 'text-zinc-400 hover:text-white'
          }`}
        >
          <FileText className="h-3.5 w-3.5" />
          Upload PDF / File
        </button>
        <button
          type="button"
          onClick={() => setMode('text')}
          className={`flex-1 flex items-center justify-center gap-2 py-2 text-xs font-semibold rounded-lg transition-all ${
            mode === 'text'
              ? 'bg-violet-600 text-white shadow-md'
              : 'text-zinc-400 hover:text-white'
          }`}
        >
          <AlignLeft className="h-3.5 w-3.5" />
          Paste Raw Text
        </button>
      </div>

      <div className="glass-panel rounded-2xl p-8 border border-white/10 space-y-6 shadow-2xl">
        {mode === 'file' ? (
          /* File Drag & Drop Area */
          <div
            onDragOver={handleDragOver}
            onDragLeave={handleDragLeave}
            onDrop={handleDrop}
            onClick={() => fileInputRef.current?.click()}
            className={`border-2 border-dashed rounded-xl p-10 text-center transition-all cursor-pointer ${
              isDragActive
                ? 'border-violet-500 bg-violet-500/15 scale-[1.01]'
                : file
                ? 'border-emerald-500/40 bg-emerald-500/5'
                : 'border-white/15 hover:border-violet-500/40 hover:bg-white/5'
            }`}
          >
            <input
              ref={fileInputRef}
              type="file"
              accept=".pdf,.txt,.md,.json,application/pdf,text/plain"
              onChange={handleFileInputChange}
              className="hidden"
            />

            <div className="flex flex-col items-center justify-center space-y-3 pointer-events-none">
              <div
                className={`h-16 w-16 rounded-2xl flex items-center justify-center transition-transform ${
                  file
                    ? 'bg-emerald-500/20 text-emerald-400'
                    : 'bg-violet-500/10 text-violet-400'
                }`}
              >
                {file ? <FileText className="h-8 w-8" /> : <UploadCloud className="h-8 w-8" />}
              </div>

              {file ? (
                <div className="space-y-1">
                  <p className="text-sm font-semibold text-white">{file.name}</p>
                  <p className="text-xs text-zinc-400 font-mono">{formatBytes(file.size)}</p>
                  <span className="inline-block text-xs text-emerald-400 font-medium bg-emerald-500/10 px-2.5 py-0.5 rounded-full border border-emerald-500/20">
                    ✓ File Selected — Ready to Index
                  </span>
                </div>
              ) : (
                <div className="space-y-1">
                  <p className="text-sm font-medium text-zinc-200">
                    {isDragActive ? 'Drop file here...' : 'Click to browse or drag & drop a PDF / Document'}
                  </p>
                  <p className="text-xs text-zinc-500">Supports PDF, TXT, MD (up to 50MB)</p>
                </div>
              )}
            </div>
          </div>
        ) : (
          /* Raw Text Input Mode */
          <div className="space-y-4">
            <div>
              <label className="block text-xs font-semibold text-zinc-300 mb-1">
                Document Title
              </label>
              <input
                type="text"
                placeholder="e.g. AI System Documentation"
                value={docTitle}
                onChange={(e) => setDocTitle(e.target.value)}
                className="w-full px-4 py-2.5 rounded-lg bg-slate-900/80 border border-white/10 text-white text-sm focus:outline-none focus:ring-2 focus:ring-violet-500"
              />
            </div>

            <div>
              <label className="block text-xs font-semibold text-zinc-300 mb-1">
                Raw Content / Notes
              </label>
              <textarea
                rows={6}
                placeholder="Paste any article, text, or research notes here..."
                value={rawText}
                onChange={(e) => setRawText(e.target.value)}
                className="w-full px-4 py-3 rounded-lg bg-slate-900/80 border border-white/10 text-white text-sm focus:outline-none focus:ring-2 focus:ring-violet-500 resize-none font-mono text-xs"
              />
            </div>
          </div>
        )}

        {/* Progress Display */}
        {step === 'UPLOADING' && (
          <div className="space-y-3 p-4 rounded-xl glass-card border border-violet-500/30 animate-in fade-in">
            <div className="flex justify-between text-xs text-zinc-300">
              <span className="flex items-center gap-1.5 font-medium text-violet-300">
                <Loader2 className="h-3.5 w-3.5 animate-spin text-violet-400" />
                {processingStatus}
              </span>
              <span className="font-mono">{uploadPercent}%</span>
            </div>
            <Progress value={uploadPercent} />
          </div>
        )}

        {/* Completed State */}
        {step === 'COMPLETED' && (
          <div className="p-4 rounded-xl glass-card border border-emerald-500/30 space-y-3 animate-in fade-in">
            <div className="flex items-center gap-2 text-sm font-semibold text-emerald-300">
              <CheckCircle2 className="h-5 w-5 text-emerald-400" />
              <span>Indexing Complete & Ready for Q&A!</span>
            </div>
            <p className="text-xs text-zinc-400">{processingStatus}</p>
            <Button
              onClick={() => router.push(`/chat/${createdDocumentId}`)}
              className="w-full gap-2 mt-2 h-11 text-sm font-semibold shadow-lg shadow-violet-500/25"
            >
              Open Interactive Chat
              <ArrowRight className="h-4 w-4" />
            </Button>
          </div>
        )}

        {/* Error State */}
        {step === 'ERROR' && (
          <div className="p-4 rounded-xl glass-card border border-rose-500/30 space-y-2 text-xs text-rose-300">
            <div className="flex items-center gap-2 font-semibold">
              <AlertCircle className="h-4 w-4 text-rose-400" />
              <span>Ingestion Error</span>
            </div>
            <p>{errorMessage}</p>
          </div>
        )}

        {/* Action Button */}
        {step === 'IDLE' && (
          <Button
            onClick={handleUploadAndProcess}
            disabled={mode === 'file' ? !file : !rawText.trim()}
            className="w-full h-11 text-sm font-semibold shadow-lg shadow-violet-500/25 cursor-pointer"
          >
            Start Vector Indexing
          </Button>
        )}
      </div>
    </div>
  );
}
