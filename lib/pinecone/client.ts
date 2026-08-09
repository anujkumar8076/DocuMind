import { Pinecone, RecordMetadata } from '@pinecone-database/pinecone';
import { EmbeddedChunk, ScoredChunk } from '@/types';
import { prisma } from '../db/prisma';
import { generateLocalFallbackEmbedding } from '../rag/embedder';

let pineconeClient: Pinecone | null = null;

function getPineconeClient(): Pinecone | null {
  if (!process.env.PINECONE_API_KEY) {
    return null;
  }
  if (!pineconeClient) {
    pineconeClient = new Pinecone({
      apiKey: process.env.PINECONE_API_KEY,
    });
  }
  return pineconeClient;
}

const INDEX_NAME = process.env.PINECONE_INDEX_NAME || 'documind';

export interface VectorMetadata extends RecordMetadata {
  documentId: string;
  chunkIndex: number;
  pageNumber: number;
  content: string;
  tokenCount: number;
  userId: string;
}

export interface QueryVectorOptions {
  topK?: number;
  documentIds?: string[];
  userId: string;
  minScore?: number;
}

const mockVectorStore = new Map<string, { id: string; values: number[]; metadata: VectorMetadata }[]>();

function cosineSimilarity(a: number[], b: number[]): number {
  if (!a || !b || a.length === 0 || b.length === 0) return 0;
  let dotProduct = 0;
  let normA = 0;
  let normB = 0;
  const len = Math.min(a.length, b.length);
  for (let i = 0; i < len; i++) {
    const valA = a[i] ?? 0;
    const valB = b[i] ?? 0;
    dotProduct += valA * valB;
    normA += valA * valA;
    normB += valB * valB;
  }
  if (normA === 0 || normB === 0) return 0;
  return dotProduct / (Math.sqrt(normA) * Math.sqrt(normB));
}

export async function upsertVectors(
  chunks: EmbeddedChunk[],
  userId: string
): Promise<void> {
  if (chunks.length === 0) return;

  const namespace = `user-${userId}`;
  const client = getPineconeClient();

  const records = chunks.map((chunk) => ({
    id: chunk.pineconeId,
    values: chunk.embedding,
    metadata: {
      documentId: chunk.documentId,
      chunkIndex: chunk.chunkIndex,
      pageNumber: chunk.pageNumber ?? 1,
      content: chunk.content,
      tokenCount: chunk.tokenCount,
      userId,
    } as VectorMetadata,
  }));

  if (client) {
    const index = client.index<VectorMetadata>(INDEX_NAME).namespace(namespace);
    for (let i = 0; i < records.length; i += 100) {
      const batch = records.slice(i, i + 100);
      await index.upsert(batch);
    }
  } else {
    const existing = mockVectorStore.get(namespace) || [];
    const updated = existing.filter((r) => !records.some((newR) => newR.id === r.id)).concat(records);
    mockVectorStore.set(namespace, updated);
  }
}

export async function queryVectors(
  queryEmbedding: number[],
  options: QueryVectorOptions
): Promise<ScoredChunk[]> {
  const topK = options.topK ?? 6;
  const namespace = `user-${options.userId}`;
  const client = getPineconeClient();

  if (client) {
    const index = client.index<VectorMetadata>(INDEX_NAME).namespace(namespace);
    const filter: Record<string, any> = {};
    if (options.documentIds && options.documentIds.length > 0) {
      filter['documentId'] = { $in: options.documentIds };
    }

    const queryResponse = await index.query({
      vector: queryEmbedding,
      topK,
      filter: Object.keys(filter).length > 0 ? filter : undefined,
      includeMetadata: true,
    });

    const matches = queryResponse.matches || [];
    return matches
      .filter((m) => !options.minScore || (m.score ?? 0) >= options.minScore)
      .map((match) => ({
        id: match.id,
        pineconeId: match.id,
        documentId: (match.metadata?.documentId as string) || '',
        content: (match.metadata?.content as string) || '',
        chunkIndex: (match.metadata?.chunkIndex as number) ?? 0,
        pageNumber: (match.metadata?.pageNumber as number) ?? 1,
        tokenCount: (match.metadata?.tokenCount as number) ?? 0,
        score: match.score ?? 0,
      }));
  }

  // Fallback: Query all document chunks from PostgreSQL database directly
  const dbChunks = await prisma.documentChunk.findMany({
    where: options.documentIds && options.documentIds.length > 0
      ? { documentId: { in: options.documentIds } }
      : {},
    take: 100,
    orderBy: { chunkIndex: 'asc' },
  });

  if (dbChunks.length === 0) return [];

  // Compute similarity score for each DB chunk
  const scored = dbChunks.map((chunk) => {
    const chunkVector = generateLocalFallbackEmbedding(chunk.content);
    const sim = cosineSimilarity(queryEmbedding, chunkVector);
    return {
      id: chunk.id,
      pineconeId: chunk.pineconeId,
      documentId: chunk.documentId,
      content: chunk.content,
      chunkIndex: chunk.chunkIndex,
      pageNumber: chunk.pageNumber ?? 1,
      tokenCount: chunk.tokenCount,
      score: Number(Math.max(0.1, sim).toFixed(4)),
    };
  });

  scored.sort((a, b) => b.score - a.score);
  return scored
    .filter((s) => !options.minScore || s.score >= options.minScore)
    .slice(0, topK);
}

export async function deleteDocumentVectors(documentId: string, userId: string): Promise<void> {
  const namespace = `user-${userId}`;
  const client = getPineconeClient();

  if (client) {
    const index = client.index<VectorMetadata>(INDEX_NAME).namespace(namespace);
    await index.deleteMany({
      documentId: { $eq: documentId },
    });
  } else {
    const existing = mockVectorStore.get(namespace) || [];
    mockVectorStore.set(
      namespace,
      existing.filter((r) => r.metadata.documentId !== documentId)
    );
  }
}
