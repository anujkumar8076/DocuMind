import { Plan, DocumentStatus, MessageRole } from '@prisma/client';

export type { Plan, DocumentStatus, MessageRole };

export interface ChunkMetadata {
  documentId: string;
  documentName?: string;
  chunkIndex: number;
  pageNumber?: number;
  tokenCount: number;
  startCharOffset?: number;
  userId?: string;
}

export interface DocumentChunkData {
  id?: string;
  documentId: string;
  content: string;
  chunkIndex: number;
  pageNumber?: number;
  tokenCount: number;
  pineconeId: string;
  startCharOffset?: number;
}

export interface EmbeddedChunk extends DocumentChunkData {
  embedding: number[];
}

export interface ScoredChunk extends DocumentChunkData {
  score: number;
  documentName?: string;
}

export interface GroundedSentence {
  sentence: string;
  status: 'GROUNDED' | 'INFERRED' | 'HALLUCINATED';
  groundingChunkId?: string;
  confidence: number;
  reasoning?: string;
}

export interface GroundednessResult {
  overallScore: number; // 0-1, higher = more grounded
  riskLevel: 'LOW' | 'MEDIUM' | 'HIGH';
  summary: string;
  annotatedSentences: GroundedSentence[];
}

export interface SourceCitation {
  id: string;
  pineconeId: string;
  documentId: string;
  documentName: string;
  chunkIndex: number;
  pageNumber?: number;
  content: string;
  score: number;
}

export interface RAGResponse {
  answer: string;
  sources: SourceCitation[];
  hallucinationResult?: GroundednessResult;
  tokensUsed: number;
  processingTimeMs: number;
}

export interface ProcessingResult {
  documentId: string;
  chunkCount: number;
  tokenCount: number;
  pageCount: number;
  processingTimeMs: number;
  status: DocumentStatus;
}

export interface UserSession {
  id: string;
  email: string;
  name?: string | null;
  image?: string | null;
  plan: Plan;
}
