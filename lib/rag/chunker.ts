import { encoding_for_model, TiktokenModel } from 'tiktoken';
import { DocumentChunkData } from '@/types';

/**
 * Token Counter singleton using tiktoken (cl100k_base for OpenAI gpt-4o / text-embedding-3-small)
 */
let encoder: ReturnType<typeof encoding_for_model> | null = null;

function getEncoder() {
  if (!encoder) {
    try {
      encoder = encoding_for_model('gpt-4o' as TiktokenModel);
    } catch {
      encoder = encoding_for_model('gpt-3.5-turbo' as TiktokenModel);
    }
  }
  return encoder;
}

/**
 * Accurately estimates token count using tiktoken
 */
export function estimateTokenCount(text: string): number {
  if (!text || text.trim().length === 0) return 0;
  try {
    const enc = getEncoder();
    return enc.encode(text).length;
  } catch {
    // Fallback: ~4 chars per token
    return Math.ceil(text.length / 4);
  }
}

export interface ChunkerOptions {
  chunkSizeTokens?: number; // default: 1000 tokens
  chunkOverlapTokens?: number; // default: 200 tokens
  separators?: string[];
}

const DEFAULT_SEPARATORS = ['\n\n', '\n', '. ', '? ', '! ', '; ', ' ', ''];

/**
 * Recursive character splitter adapted for token-aware chunk boundaries.
 * Guarantees that chunks do not exceed token limits while respecting semantic boundaries.
 */
export function chunkDocument(
  text: string,
  metadata: {
    documentId: string;
    pageNumber?: number;
    startChunkIndex?: number;
  },
  options?: ChunkerOptions
): DocumentChunkData[] {
  const chunkSizeTokens = Math.max(50, options?.chunkSizeTokens ?? 1000);
  const chunkOverlapTokens = Math.min(
    Math.floor(chunkSizeTokens / 2),
    options?.chunkOverlapTokens ?? 200
  );
  const separators = options?.separators ?? DEFAULT_SEPARATORS;

  const sanitizedText = text.replace(/\r\n/g, '\n').trim();
  if (!sanitizedText) return [];

  const rawChunks = splitTextRecursively(sanitizedText, separators, chunkSizeTokens, chunkOverlapTokens);
  
  let currentOffset = 0;
  const startIndex = metadata.startChunkIndex ?? 0;

  return rawChunks
    .filter((chunk) => chunk.trim().length > 0)
    .map((chunkText, idx) => {
      const chunkIndex = startIndex + idx;
      const tokenCount = estimateTokenCount(chunkText);
      const startCharOffset = sanitizedText.indexOf(chunkText, currentOffset);
      if (startCharOffset !== -1) {
        currentOffset = startCharOffset + chunkText.length;
      }

      return {
        documentId: metadata.documentId,
        content: chunkText,
        chunkIndex,
        pageNumber: metadata.pageNumber ?? 1,
        tokenCount,
        pineconeId: `${metadata.documentId}#${chunkIndex}`,
        startCharOffset: startCharOffset !== -1 ? startCharOffset : undefined,
      };
    });
}

/**
 * Core recursive splitting algorithm adhering to token boundaries with edge-case handling
 */
function splitTextRecursively(
  text: string,
  separators: string[],
  chunkSizeTokens: number,
  chunkOverlapTokens: number
): string[] {
  const finalChunks: string[] = [];
  const textTokens = estimateTokenCount(text);

  // If text already fits within chunk size, return it directly
  if (textTokens <= chunkSizeTokens) {
    return [text.trim()];
  }

  // Find the highest-priority separator present in text
  let chosenSeparator = '';
  let newSeparators: string[] = [];

  for (let i = 0; i < separators.length; i++) {
    const s = separators[i] ?? '';
    if (s === '') {
      chosenSeparator = '';
      newSeparators = [];
      break;
    }
    if (text.includes(s)) {
      chosenSeparator = s;
      newSeparators = separators.slice(i + 1);
      break;
    }
  }

  // Fallback for long words/strings with no separator: split by character count
  if (chosenSeparator === '') {
    const charLimit = Math.max(100, chunkSizeTokens * 4);
    for (let i = 0; i < text.length; i += charLimit) {
      finalChunks.push(text.slice(i, i + charLimit));
    }
    return finalChunks;
  }

  const splits = text.split(chosenSeparator).filter((p) => p.length > 0);
  let currentDoc: string[] = [];
  let currentTokens = 0;

  for (const piece of splits) {
    const pieceTokens = estimateTokenCount(piece);

    // If a single piece is itself larger than chunkSizeTokens, recurse on it
    if (pieceTokens > chunkSizeTokens) {
      if (currentDoc.length > 0) {
        const mergedText = currentDoc.join(chosenSeparator).trim();
        if (mergedText) finalChunks.push(mergedText);
        currentDoc = [];
        currentTokens = 0;
      }
      finalChunks.push(...splitTextRecursively(piece, newSeparators, chunkSizeTokens, chunkOverlapTokens));
      continue;
    }

    if (currentTokens + pieceTokens > chunkSizeTokens && currentDoc.length > 0) {
      const mergedText = currentDoc.join(chosenSeparator).trim();
      if (mergedText) {
        finalChunks.push(mergedText);
      }

      // Keep overlap from end of currentDoc
      while (currentTokens > chunkOverlapTokens && currentDoc.length > 1) {
        const removed = currentDoc.shift();
        if (removed) {
          currentTokens -= estimateTokenCount(removed + chosenSeparator);
        }
      }
    }

    currentDoc.push(piece);
    currentTokens += pieceTokens;
  }

  if (currentDoc.length > 0) {
    const remainingText = currentDoc.join(chosenSeparator).trim();
    if (remainingText) {
      finalChunks.push(remainingText);
    }
  }

  return finalChunks;
}
