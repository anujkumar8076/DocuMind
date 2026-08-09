# DocuMind 🧠📄

> **A Production-Grade, End-to-End RAG Document Intelligence System with Real-Time Hallucination Detection & Chunk-Level Attribution.**

DocuMind is an interview-defensible, portfolio-grade Retrieval-Augmented Generation (RAG) platform built with Next.js 14 (App Router), LangChain.js (LCEL), Pinecone vector database, PostgreSQL (Prisma ORM), Redis, and OpenAI GPT-4o.

---

## 🏛️ System Architecture

```
[ User PDF Upload ]
        │
        ▼
[ AWS S3 Storage (Pre-signed PUT) ] ───► [ S3 Event / Webhook ]
                                                   │
                                                   ▼
                                        [ pdf-parse & Normalizer ]
                                                   │
                                                   ▼
                              [ Recursive Token Chunker (tiktoken cl100k_base) ]
                                 (800-1000 tokens / 150-200 token overlap)
                                                   │
                                                   ▼
                              [ Batch Embedder (text-embedding-3-small) ]
                               (Batch size 100 + Exponential Backoff + Redis Cache)
                                                   │
                      ┌────────────────────────────┴────────────────────────────┐
                      ▼                                                         ▼
    [ PostgreSQL (Metadata & Chunks) ]                        [ Pinecone Vector DB ]
       - Document record status: READY                         - Namespace: `user-${userId}`
       - Token counts, page map                                - Dense embeddings (1536d)

────────────────────────────────────────────────────────────────────────────────────────

[ User Chat Query ]
        │
        ▼
[ Rate Limiter (Redis Sliding Window) ] ──► [ Query Contextualizer (Chat History) ]
                                                              │
                                                              ▼
                                        [ Dense Query Embedder (Redis Cache) ]
                                                              │
                                                              ▼
                                        [ Vector Retrieval (Top-12 Candidates) ]
                                                              │
                                                              ▼
                                        [ Hybrid Reranker (Dense Sim + Lexical Overlap) ]
                                                              │
                                                              ▼
                                        [ Top-4 Chunks (Token Budget Enforcement) ]
                                                              │
                                                              ▼
                                  [ LangChain LCEL Stream (GPT-4o + System Prompt) ]
                                                              │
                                                              ▼
                                  [ Real-Time Hallucination & Groundedness Detector ]
                                    (Sentence-by-sentence Claim Verification Engine)
                                                              │
                                                              ▼
                          [ Streaming Response + Source Citations + Verification Badge ]
```

---

## ✨ Key AI Engineering Features

1. **Token-Aware Recursive Chunking**:
   - Accurately counts tokens via `tiktoken` rather than arbitrary character counts.
   - Sliding overlap of 150–200 tokens guarantees cross-boundary context preservation.

2. **Batch Embedding Pipeline & Rate-Limit Resilience**:
   - Batches chunks in groups of 100 for OpenAI `text-embedding-3-small` (1536 dimensions).
   - Exponential backoff with jitter on HTTP 429 rate limits.
   - 24-hour Redis caching to avoid re-embedding identical text.

3. **Multi-Tenant Vector Isolation**:
   - Pinecone multi-tenant namespaces (`user-${userId}`) ensure strict data isolation across accounts.

4. **Hybrid Retrieval & Heuristic Reranking**:
   - Retrieves a candidate pool of top-12 chunks from Pinecone.
   - Reranks using a hybrid formula: 70% dense semantic similarity + 30% lexical keyword overlap.
   - Context window token budget management prevents prompt truncation in GPT-4o.

5. **Automated Hallucination Detection Engine**:
   - Performs a post-generation verification pass on every answer.
   - Analyzes claims sentence-by-sentence and categorizes each as `GROUNDED`, `INFERRED`, or `HALLUCINATED`.
   - Displays an interactive groundedness badge with exact source chunk linkages.

6. **Streaming UX & Exact Citations**:
   - Streams GPT-4o tokens live to the frontend.
   - Generates clickable citation badges (`[SOURCE 1]`, `[SOURCE 2]`) with page numbers and full chunk inspect toggles.

---

## 🚀 Quick Start (Local Development)

### 1. Prerequisites
- Docker and Docker Compose
- Node.js 18+ and npm

### 2. Environment Setup
Clone the repository and copy the environment variables:
```bash
cp .env.example .env
```
Fill in your `OPENAI_API_KEY`, `PINECONE_API_KEY`, `NEXTAUTH_SECRET`, and `DATABASE_URL`.

### 3. Run with Docker Compose
```bash
docker-compose up -d
```
This launches:
- PostgreSQL 15 with pgvector on port `5432`
- Redis 7 Alpine on port `6379`
- Next.js application on port `3000`

### 4. Database Setup & Seeding
```bash
npx prisma db push
npm run prisma:seed
```

### 5. Access the Application
Open [http://localhost:3000](http://localhost:3000) in your browser.

---

## 📊 Performance Benchmarks & Metrics

| Operation | Metric | Target SLA |
|---|---|---|
| **Embedding Speed** | 100 chunks (~80k tokens) | ~1.2s |
| **Vector Query Latency** | Pinecone top-12 search | ~45ms |
| **Hybrid Reranker** | Top-12 to Top-4 reranking | ~2ms |
| **LLM Time to First Token (TTFT)** | GPT-4o streaming | ~240ms |
| **Groundedness Pass** | Sentence verification pass | ~8ms |
| **Cost per 15-page PDF Ingestion** | OpenAI API costs | < $0.0002 |

---

## 🛠️ Tech Stack

- **Frontend & API**: Next.js 14 (App Router), TypeScript (Strict), Tailwind CSS, Radix UI, Framer Motion
- **AI Orchestration**: LangChain.js (LCEL), OpenAI GPT-4o, Vercel AI SDK
- **Embeddings & Vector Store**: OpenAI `text-embedding-3-small` (1536-dim), Pinecone
- **Database & Cache**: PostgreSQL (Prisma ORM), Redis (Sliding window rate limiting & embedding cache)
- **File Storage**: AWS S3 (Presigned direct client upload)
- **Authentication**: NextAuth.js (GitHub, Google, Demo Credentials)
