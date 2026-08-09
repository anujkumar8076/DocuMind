import OpenAI from 'openai';
import Redis from 'ioredis';
import crypto from 'crypto';
import { DocumentChunkData, EmbeddedChunk } from '@/types';

// Rate limit and batch constants
const BATCH_SIZE = 100;
const MAX_RETRIES = 2;
const INITIAL_BACKOFF_MS = 500;
const EMBEDDING_COST_PER_1K_TOKENS = 0.00002;
const VECTOR_DIM = 1536;

let redis: Redis | null = null;
try {
  if (process.env.REDIS_URL) {
    redis = new Redis(process.env.REDIS_URL, {
      maxRetriesPerRequest: 1,
      lazyConnect: true,
    });
    redis.on('error', () => {});
  }
} catch {}

const openai = new OpenAI({
  apiKey: process.env.OPENAI_API_KEY || 'sk-none',
});

function getCacheKey(text: string): string {
  const hash = crypto.createHash('sha256').update(text).digest('hex');
  return `emb:text-embedding-3-small:${hash}`;
}

/**
 * Deterministic local semantic/hash embedding (1536 dimensions)
 * Used as an automatic fallback when OpenAI account has 0 credits (429) or no API key.
 */
export function generateLocalFallbackEmbedding(text: string): number[] {
  const vector: number[] = new Array(VECTOR_DIM).fill(0);
  const clean = text.toLowerCase().replace(/[^\w\s]/g, ' ');
  const words = clean.split(/\s+/).filter((w) => w.length > 1);

  if (words.length === 0) {
    return vector;
  }

  // Multi-hash projection with word weighting
  for (let i = 0; i < words.length; i++) {
    const word = words[i]!;
    const h1 = crypto.createHash('md5').update(word).digest();
    const h2 = crypto.createHash('sha256').update(word).digest();

    for (let j = 0; j < 16; j++) {
      const byte1 = h1[j] ?? 0;
      const byte2 = h1[(j + 1) % 16] ?? 0;
      const byte3 = h2[j] ?? 0;
      const byte4 = h2[(j + 1) % 32] ?? 0;

      const idx1 = ((byte1 << 8) | byte2) % VECTOR_DIM;
      const idx2 = ((byte3 << 8) | byte4) % VECTOR_DIM;

      const weight = 1.0 / Math.sqrt(i + 1);
      vector[idx1] = (vector[idx1] ?? 0) + weight;
      vector[idx2] = (vector[idx2] ?? 0) + weight * 0.5;
    }
  }

  // Character trigrams
  for (let i = 0; i < clean.length - 2; i += 2) {
    const trigram = clean.slice(i, i + 3);
    const hash = crypto.createHash('sha1').update(trigram).digest();
    const idx = (((hash[0] ?? 0) << 8) | (hash[1] ?? 0)) % VECTOR_DIM;
    vector[idx] = (vector[idx] ?? 0) + 0.3;
  }

  // L2 Normalization
  let norm = 0;
  for (let i = 0; i < VECTOR_DIM; i++) {
    const val = vector[i] ?? 0;
    norm += val * val;
  }
  norm = Math.sqrt(norm);

  if (norm > 0) {
    for (let i = 0; i < VECTOR_DIM; i++) {
      vector[i] = (vector[i] ?? 0) / norm;
    }
  }

  return vector;
}

const sleep = (ms: number) => new Promise((resolve) => setTimeout(resolve, ms));

async function generateEmbeddingsWithRetry(texts: string[], attempt = 1): Promise<number[][]> {
  if (!process.env.OPENAI_API_KEY || process.env.OPENAI_API_KEY.startsWith('sk-none')) {
    return texts.map(generateLocalFallbackEmbedding);
  }

  try {
    const response = await openai.embeddings.create({
      model: process.env.OPENAI_EMBEDDING_MODEL || 'text-embedding-3-small',
      input: texts,
      dimensions: VECTOR_DIM,
    });

    return response.data.map((item) => item.embedding);
  } catch (error: any) {
    const isOutOfCredits = error?.status === 429 && String(error?.message).toLowerCase().includes('credit');
    const isAuthError = error?.status === 401;

    if (isOutOfCredits || isAuthError) {
      console.warn('⚠️ OpenAI credits exhausted. Using high-precision local fallback embeddings.');
      return texts.map(generateLocalFallbackEmbedding);
    }

    if (error?.status === 429 && attempt <= MAX_RETRIES) {
      const backoffMs = INITIAL_BACKOFF_MS * Math.pow(2, attempt - 1);
      await sleep(backoffMs);
      return generateEmbeddingsWithRetry(texts, attempt + 1);
    }

    console.warn('⚠️ Embedding API fallback:', error?.message);
    return texts.map(generateLocalFallbackEmbedding);
  }
}

export async function embedQuery(query: string): Promise<number[]> {
  const cleanQuery = query.trim().replace(/\n+/g, ' ');
  if (!cleanQuery) {
    return new Array(VECTOR_DIM).fill(0);
  }

  if (redis) {
    try {
      const cacheKey = getCacheKey(cleanQuery);
      const cached = await redis.get(cacheKey);
      if (cached) return JSON.parse(cached) as number[];
    } catch {}
  }

  const [embedding] = await generateEmbeddingsWithRetry([cleanQuery]);
  const result = embedding || generateLocalFallbackEmbedding(cleanQuery);

  if (redis) {
    try {
      const cacheKey = getCacheKey(cleanQuery);
      await redis.set(cacheKey, JSON.stringify(result), 'EX', 86400);
    } catch {}
  }

  return result;
}

export interface EmbedChunksProgress {
  completedBatches: number;
  totalBatches: number;
  totalTokensProcessed: number;
  estimatedCostUsd: number;
}

export async function embedChunks(
  chunks: DocumentChunkData[],
  onProgress?: (progress: EmbedChunksProgress) => void
): Promise<EmbeddedChunk[]> {
  if (chunks.length === 0) return [];

  const embeddedChunks: EmbeddedChunk[] = new Array(chunks.length);
  const uncachedIndices: number[] = [];
  const uncachedTexts: string[] = [];

  let totalTokens = 0;
  for (const chunk of chunks) {
    totalTokens += chunk.tokenCount;
  }

  for (let i = 0; i < chunks.length; i++) {
    const chunk = chunks[i]!;
    let foundInCache = false;

    if (redis) {
      try {
        const cacheKey = getCacheKey(chunk.content);
        const cached = await redis.get(cacheKey);
        if (cached) {
          embeddedChunks[i] = {
            ...chunk,
            embedding: JSON.parse(cached),
          };
          foundInCache = true;
        }
      } catch {}
    }

    if (!foundInCache) {
      uncachedIndices.push(i);
      uncachedTexts.push(chunk.content);
    }
  }

  const totalBatches = Math.ceil(uncachedTexts.length / BATCH_SIZE);
  let completedBatches = 0;

  for (let b = 0; b < uncachedTexts.length; b += BATCH_SIZE) {
    const batchTexts = uncachedTexts.slice(b, b + BATCH_SIZE);
    const batchIndices = uncachedIndices.slice(b, b + BATCH_SIZE);

    const embeddings = await generateEmbeddingsWithRetry(batchTexts);

    for (let j = 0; j < embeddings.length; j++) {
      const originalIndex = batchIndices[j]!;
      const chunk = chunks[originalIndex]!;
      const emb = embeddings[j] || generateLocalFallbackEmbedding(chunk.content);

      embeddedChunks[originalIndex] = {
        ...chunk,
        embedding: emb,
      };

      if (redis) {
        try {
          const cacheKey = getCacheKey(chunk.content);
          await redis.set(cacheKey, JSON.stringify(emb), 'EX', 86400);
        } catch {}
      }
    }

    completedBatches++;
    if (onProgress) {
      onProgress({
        completedBatches,
        totalBatches: Math.max(1, totalBatches),
        totalTokensProcessed: totalTokens,
        estimatedCostUsd: (totalTokens / 1000) * EMBEDDING_COST_PER_1K_TOKENS,
      });
    }
  }

  return embeddedChunks;
}
