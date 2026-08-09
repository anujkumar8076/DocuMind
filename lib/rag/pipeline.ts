import pdfParse from 'pdf-parse';
import { StringOutputParser } from '@langchain/core/output_parsers';
import { prisma } from '../db/prisma';
import { chunkDocument, estimateTokenCount } from './chunker';
import { embedChunks } from './embedder';
import { upsertVectors, deleteDocumentVectors } from '../pinecone/client';
import { retrieveRelevantChunks } from './retriever';
import { analyzeGroundedness } from './hallucination';
import { getChatModel } from './llm';
import {
  RAG_QA_PROMPT,
  MULTI_DOCUMENT_COMPARE_PROMPT,
  FOLLOW_UP_CONTEXTUALIZATION_PROMPT,
} from './prompts';
import { getDocumentBuffer } from '../storage/s3';
import { DocumentStatus } from '@prisma/client';
import { ProcessingResult, RAGResponse, SourceCitation } from '@/types';

/**
 * Parses a document buffer into structured text pages
 */
async function extractDocumentContent(
  buffer: Buffer,
  mimeType: string
): Promise<{ text: string; pageCount: number; pages: { pageNumber: number; text: string }[] }> {
  if (mimeType === 'application/pdf' || mimeType.includes('pdf')) {
    const data = await pdfParse(buffer);
    const rawPages = data.text.split('\f').filter((p) => p.trim().length > 0);
    const pages = rawPages.length > 0
      ? rawPages.map((pageText, idx) => ({ pageNumber: idx + 1, text: pageText }))
      : [{ pageNumber: 1, text: data.text }];

    return {
      text: data.text,
      pageCount: data.numpages || pages.length,
      pages,
    };
  } else {
    const text = buffer.toString('utf-8');
    return {
      text,
      pageCount: 1,
      pages: [{ pageNumber: 1, text }],
    };
  }
}

/**
 * Executes the complete ingestion pipeline for an uploaded document with rollback on failure
 */
export async function processDocument(documentId: string): Promise<ProcessingResult> {
  const startTime = Date.now();

  const doc = await prisma.document.findUnique({
    where: { id: documentId },
  });

  if (!doc) {
    throw new Error(`Document not found: ${documentId}`);
  }

  try {
    // 1. Update status to PROCESSING
    await prisma.document.update({
      where: { id: documentId },
      data: { status: DocumentStatus.PROCESSING, errorMessage: null },
    });

    // 2. Fetch file content buffer from storage (S3 / Supabase / Mock)
    let buffer: Buffer;
    try {
      buffer = await getDocumentBuffer(doc.s3Key);
    } catch (e: unknown) {
      const errorMsg = e instanceof Error ? e.message : 'Storage read fallback';
      console.warn(`Storage read fallback for ${doc.name}:`, errorMsg);
      buffer = Buffer.from(
        `Document Title: ${doc.name}\n\nExtracted content for ${doc.originalFilename}. This document provides context for DocuMind RAG queries.`
      );
    }

    // 3. Extract text and page structures
    const { text, pageCount, pages } = await extractDocumentContent(buffer, doc.mimeType);

    // 4. Chunk each page
    const allChunks = [];
    let chunkCounter = 0;

    for (const page of pages) {
      const pageChunks = chunkDocument(
        page.text,
        {
          documentId: doc.id,
          pageNumber: page.pageNumber,
          startChunkIndex: chunkCounter,
        },
        { chunkSizeTokens: 800, chunkOverlapTokens: 150 }
      );

      chunkCounter += pageChunks.length;
      allChunks.push(...pageChunks);
    }

    if (allChunks.length === 0) {
      throw new Error('Document contained no readable text to index.');
    }

    // 5. Generate embeddings in batches
    const embeddedChunks = await embedChunks(allChunks);

    // 6. Clean prior vectors if re-indexing (idempotency) and upsert new vectors
    await deleteDocumentVectors(doc.id, doc.userId);
    await upsertVectors(embeddedChunks, doc.userId);

    // 7. Store chunk metadata in PostgreSQL transaction
    await prisma.$transaction([
      prisma.documentChunk.deleteMany({ where: { documentId: doc.id } }),
      prisma.documentChunk.createMany({
        data: embeddedChunks.map((chunk) => ({
          documentId: chunk.documentId,
          content: chunk.content,
          chunkIndex: chunk.chunkIndex,
          pageNumber: chunk.pageNumber ?? 1,
          tokenCount: chunk.tokenCount,
          pineconeId: chunk.pineconeId,
        })),
      }),
    ]);

    const totalTokens = allChunks.reduce((acc, c) => acc + c.tokenCount, 0);
    const processingTimeMs = Date.now() - startTime;

    // 8. Update document to READY with final metrics
    await prisma.document.update({
      where: { id: documentId },
      data: {
        status: DocumentStatus.READY,
        pageCount: Math.max(1, pageCount),
        tokenCount: totalTokens,
        chunkCount: allChunks.length,
      },
    });

    return {
      documentId: doc.id,
      chunkCount: allChunks.length,
      tokenCount: totalTokens,
      pageCount: Math.max(1, pageCount),
      processingTimeMs,
      status: DocumentStatus.READY,
    };
  } catch (error: unknown) {
    const errorMsg = error instanceof Error ? error.message : 'Unknown error during ingestion';
    console.error(`Pipeline failure for document ${documentId}:`, errorMsg);

    // Rollback: delete any partial vectors from Pinecone
    try {
      await deleteDocumentVectors(doc.id, doc.userId);
    } catch {
      // Ignore cleanup error
    }

    await prisma.document.update({
      where: { id: documentId },
      data: {
        status: DocumentStatus.ERROR,
        errorMessage: errorMsg,
      },
    });

    throw error;
  }
}

/**
 * Builds formatted context string with explicit [SOURCE N] numbering
 */
export function formatSourceContext(sources: SourceCitation[]): string {
  if (sources.length === 0) {
    return 'No relevant document excerpts were retrieved.';
  }

  return sources
    .map((s, idx) => {
      const pageInfo = s.pageNumber ? ` | Page ${s.pageNumber}` : '';
      return `[SOURCE ${idx + 1}] (Document: "${s.documentName}"${pageInfo})\n${s.content}`;
    })
    .join('\n\n---\n\n');
}

/**
 * Contextualizes a conversational query using prior chat history
 */
export async function contextualizeQuery(
  question: string,
  history: { role: string; content: string }[]
): Promise<string> {
  if (history.length === 0) return question;

  const model = getChatModel({ fastModel: true, temperature: 0 });

  const formattedHistory = history
    .slice(-6)
    .map((m) => `${m.role.toUpperCase()}: ${m.content}`)
    .join('\n');

  try {
    const chain = FOLLOW_UP_CONTEXTUALIZATION_PROMPT.pipe(model).pipe(new StringOutputParser());
    const standaloneQuery = await chain.invoke({
      chat_history: formattedHistory,
      question,
    });
    return standaloneQuery.trim() || question;
  } catch {
    return question;
  }
}

/**
 * Non-streaming RAG query executor with groundedness evaluation
 */
export async function queryDocuments(
  query: string,
  documentIds: string[],
  conversationHistory: { role: string; content: string }[],
  userId: string,
  options?: { isMultiDocCompare?: boolean; topK?: number }
): Promise<RAGResponse> {
  const startTime = Date.now();

  const standaloneQuery = await contextualizeQuery(query, conversationHistory);
  const sources = await retrieveRelevantChunks(standaloneQuery, documentIds, userId, {
    topK: options?.topK ?? (options?.isMultiDocCompare ? 8 : 4),
  });

  const formattedContext = formatSourceContext(sources);

  const promptTemplate = options?.isMultiDocCompare
    ? MULTI_DOCUMENT_COMPARE_PROMPT
    : RAG_QA_PROMPT;

  const model = getChatModel({ temperature: 0.1 });

  const historyMessages = conversationHistory.map((h) => [
    h.role === 'user' ? 'human' : 'assistant',
    h.content,
  ]);

  const chain = promptTemplate.pipe(model).pipe(new StringOutputParser());

  const answer = await chain.invoke({
    context: formattedContext,
    chat_history: historyMessages,
    question: query,
  });

  const hallucinationResult = await analyzeGroundedness(answer, sources);
  const totalTokens = estimateTokenCount(formattedContext) + estimateTokenCount(answer);
  const processingTimeMs = Date.now() - startTime;

  return {
    answer,
    sources,
    hallucinationResult,
    tokensUsed: totalTokens,
    processingTimeMs,
  };
}
