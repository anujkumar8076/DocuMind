import { embedQuery } from './embedder';
import { queryVectors } from '../pinecone/client';
import { prisma } from '../db/prisma';
import { ScoredChunk, SourceCitation } from '@/types';

export interface RetrievalOptions {
  topK?: number; // Final chunks to return (default: 4)
  candidatePoolSize?: number; // Initial candidate pool size (default: 12)
  minSimilarity?: number; // Minimum cosine similarity threshold (default: 0.15)
  maxContextTokens?: number; // Max token budget for context (default: 3500)
}

/**
 * Calculates lexical term overlap score (BM25-style / Jaccard)
 */
function calculateLexicalOverlap(query: string, text: string): number {
  const clean = (s: string) =>
    s
      .toLowerCase()
      .replace(/[^\w\s]/g, '')
      .split(/\s+/)
      .filter((w) => w.length > 2);

  const queryTerms = new Set(clean(query));
  if (queryTerms.size === 0) return 0.5;

  const docTerms = clean(text);
  let matches = 0;
  for (const term of docTerms) {
    if (queryTerms.has(term)) {
      matches++;
    }
  }

  return Math.min(1.0, matches / Math.max(1, queryTerms.size));
}

/**
 * Heuristic Reranker: combines dense vector similarity, lexical term density,
 * and chunk order to produce an interview-defensible cross-ranked score.
 */
function rerankChunks(query: string, candidates: ScoredChunk[], topK: number): ScoredChunk[] {
  const reranked = candidates.map((chunk) => {
    const lexicalScore = calculateLexicalOverlap(query, chunk.content);
    // Weighted hybrid score: 60% semantic similarity + 40% lexical term overlap
    const hybridScore = chunk.score * 0.6 + lexicalScore * 0.4;

    return {
      ...chunk,
      score: Number(hybridScore.toFixed(4)),
    };
  });

  reranked.sort((a, b) => b.score - a.score);
  return reranked.slice(0, topK);
}

/**
 * Retrieves relevant chunks with vector search, threshold filtering, reranking,
 * token budget enforcement, and DB document metadata resolution.
 */
export async function retrieveRelevantChunks(
  query: string,
  documentIds: string[],
  userId: string,
  options?: RetrievalOptions
): Promise<SourceCitation[]> {
  const topK = options?.topK ?? 4;
  const candidatePoolSize = options?.candidatePoolSize ?? 12;
  const minSimilarity = options?.minSimilarity ?? 0.15;
  const maxContextTokens = options?.maxContextTokens ?? 3500;

  // 1. Embed query
  const queryEmbedding = await embedQuery(query);

  // 2. Query vector store for candidate pool
  const candidates = await queryVectors(queryEmbedding, {
    topK: candidatePoolSize,
    documentIds: documentIds && documentIds.length > 0 ? documentIds : undefined,
    userId,
    minScore: minSimilarity,
  });

  if (candidates.length === 0) {
    // If no candidate met threshold, fetch first chunks of the document to avoid empty response
    const fallbackDbChunks = await prisma.documentChunk.findMany({
      where: documentIds && documentIds.length > 0
        ? { documentId: { in: documentIds } }
        : {},
      take: topK,
      orderBy: { chunkIndex: 'asc' },
    });

    if (fallbackDbChunks.length === 0) return [];

    candidates.push(
      ...fallbackDbChunks.map((c) => ({
        id: c.id,
        pineconeId: c.pineconeId,
        documentId: c.documentId,
        content: c.content,
        chunkIndex: c.chunkIndex,
        pageNumber: c.pageNumber ?? 1,
        tokenCount: c.tokenCount,
        score: 0.5,
      }))
    );
  }

  // 3. Rerank candidate pool
  const topChunks = rerankChunks(query, candidates, topK);

  // 4. Fetch document names from DB for citations
  const uniqueDocIds = Array.from(new Set(topChunks.map((c) => c.documentId)));
  const docs = await prisma.document.findMany({
    where: {
      id: { in: uniqueDocIds },
    },
    select: { id: true, name: true },
  });

  const docNameMap = new Map(docs.map((d) => [d.id, d.name]));

  // 5. Enforce token budget while building citations
  let accumulatedTokens = 0;
  const finalCitations: SourceCitation[] = [];

  for (const chunk of topChunks) {
    if (accumulatedTokens + chunk.tokenCount > maxContextTokens && finalCitations.length > 0) {
      break;
    }

    accumulatedTokens += chunk.tokenCount;
    finalCitations.push({
      id: chunk.id || chunk.pineconeId,
      pineconeId: chunk.pineconeId,
      documentId: chunk.documentId,
      documentName: docNameMap.get(chunk.documentId) || 'Document',
      chunkIndex: chunk.chunkIndex,
      pageNumber: chunk.pageNumber ?? 1,
      content: chunk.content,
      score: chunk.score,
    });
  }

  return finalCitations;
}
