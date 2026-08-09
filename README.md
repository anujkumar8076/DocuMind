# DocuMind 🧠📄

> **A High-Speed RAG Document Intelligence System with Real-Time Hallucination Detection & Exact Source Attribution.**

DocuMind is a Retrieval-Augmented Generation (RAG) platform built for ultra-fast performance and zero-cost free-tier deployment. Built with **Next.js 14 (App Router)**, **Groq LPU (Llama 3.3 70B @ 500 tok/sec)**, **Supabase PostgreSQL**, **unpdf (PDF.js Engine)**, and **LangChain.js**.

---

## 🏛️ System Architecture

```
[ User PDF / Text Upload ]
         │
         ▼
[ Direct Multipart / Ingestion API ]
         │
         ▼
[ Modern PDF.js Parser (unpdf) ] ──► Extracts Text & Page Structure
         │
         ▼
[ Token-Aware Chunker (tiktoken) ]
   (500–800 tokens / 100–150 token overlap)
         │
         ▼
[ Dual-Engine Embedder ] ──► (OpenAI text-embedding-3-small + High-Precision Semantic Fallback)
         │
         ▼
[ Supabase PostgreSQL + Vector Store ]
   - Document metadata & page mapping
   - Chunks with token counts & vector embeddings
   - (Optional: Pinecone multi-tenant isolated namespaces)

──────────────────────────────────────────────────────────────────────────────────────────

[ User Chat Query ]
         │
         ▼
[ Contextualizer & History Fusion ]
         │
         ▼
[ Dense Vector Query + Keyword Matching ]
         │
         ▼
[ Hybrid Reranker (Semantic Similarity + Lexical BM25 Overlap) ]
         │
         ▼
[ Top Candidate Chunks (Token Budget Controls) ]
         │
         ▼
[ Groq LPU Engine (Llama 3.3 70B Versatile @ 500 Tokens/Sec) ]
         │
         ▼
[ Real-Time Hallucination Guard (Sentence-by-Sentence Grounding) ]
         │
         ▼
[ Streaming Markdown Response + Clickable Source Citations [SOURCE 1] ]
```

---

## ✨ Key AI Engineering Features

### 1. Ultra-Fast Inference via Groq LPU
Powers deep reasoning using open-source **Llama 3.3 70B Versatile** at approximately 500 tokens/second. Includes fallback support for OpenAI GPT-4o.

### 2. Modern PDF Extraction (`unpdf`)
Leverages Mozilla's modern PDF.js engine (`unpdf`), purpose-built for Next.js and Node.js environments. Accurately extracts complete structured text across multi-column layouts, Canva PDFs, Google Docs exports, and LaTeX papers — with zero external binary dependencies.

### 3. Consolidated Zero-Cost Infrastructure (No AWS S3 Required)
Eliminates multi-cloud complexity (AWS S3, separate vector DBs, Redis) by consolidating everything into a single **Supabase PostgreSQL** database. Runs 100% free within generous free-tier limits.

### 4. Zero-Credit Graceful Fallback
Automatically switches to a deterministic semantic hash embedding fallback when the OpenAI credit balance reaches $0, ensuring document ingestion and querying remain fully operational at all times.

### 5. Multi-Document Hybrid Retrieval & Reranker
Retrieves candidates via vector similarity, then reranks using a hybrid scoring formula: **60% dense semantic score + 40% lexical term overlap**. Context window token budget controls prevent prompt overflow.

### 6. Real-Time Hallucination Detection & Grounding
Analyzes model output sentence-by-sentence against retrieved source chunks. Classifies each claim as `GROUNDED`, `INFERRED`, or `HALLUCINATED`, and surfaces an interactive groundedness badge with per-claim confidence scores.

### 7. Exact Clickable Source Citations
Every response includes inline citation badges (`[SOURCE 1]`, `[SOURCE 2]`) with corresponding page numbers, match percentages, and full chunk excerpts for complete traceability.

---

## 🛠️ Tech Stack

| Layer | Technology | Purpose |
| :--- | :--- | :--- |
| **Frontend & API** | Next.js 14 (App Router), React, TypeScript | SSR, Streaming UI, API routes |
| **Styling & UI** | Tailwind CSS, Lucide Icons, Glassmorphism | Dark theme, responsive design |
| **LLM Inference** | Groq SDK / LangChain Groq (`llama-3.3-70b`) | Ultra-fast token generation (500 T/s) |
| **PDF Extraction** | `unpdf` (Modern PDF.js) | Structured text & page extraction |
| **Database & Vector Store** | Supabase PostgreSQL + Prisma ORM | Document storage, metadata & chunk vectors |
| **Optional Vector Cloud** | Pinecone | Multi-tenant namespace isolation |
| **Authentication** | NextAuth.js | Credentials & OAuth sessions |
| **Deployment** | Vercel | Serverless edge hosting |

---

## 🚀 Quick Start (Local Setup)

### 1. Prerequisites

- **Node.js 18+** (v20+ or v24 recommended)
- A free **Supabase** account — [supabase.com](https://supabase.com)
- A free **Groq** API key — [console.groq.com](https://console.groq.com/keys)

---

### 2. Environment Variables

Create a `.env` file in the project root:

```env
# Node Environment
NODE_ENV=development

# 1. Supabase Database Connection
DATABASE_URL="postgresql://postgres:YOUR_PASSWORD@db.YOUR_PROJECT_REF.supabase.co:5432/postgres"
DIRECT_URL="postgresql://postgres:YOUR_PASSWORD@db.YOUR_PROJECT_REF.supabase.co:5432/postgres"

# 2. Groq API (Free High-Speed LLM — Llama 3.3 70B)
GROQ_API_KEY="gsk_your_groq_api_key"
GROQ_MODEL="llama-3.3-70b-versatile"

# 3. Embeddings (OpenAI or Local Fallback)
OPENAI_API_KEY="sk-proj-your_key"   # Optional — falls back to local high-precision embeddings at $0 balance
OPENAI_EMBEDDING_MODEL="text-embedding-3-small"

# 4. NextAuth Authentication
NEXTAUTH_URL="http://localhost:3000"
NEXTAUTH_SECRET="generate-any-random-32-char-secret-string"

# 5. Optional — Pinecone (only if using Pinecone cloud instead of PostgreSQL)
PINECONE_API_KEY=""
PINECONE_INDEX_NAME="documind"
```

> **Note on Supabase Passwords:** If your database password contains special characters such as `@`, URL-encode them before embedding in the connection string (e.g. `@` → `%40`).

---

### 3. Install Dependencies & Push Database Schema

```bash
# Install dependencies
npm install

# Push database schema to Supabase
npm run db:push

# Seed sample documents and test user
node prisma/seed.js
```

---

### 4. Start the Development Server

```bash
npm run dev
```

Open **[http://localhost:3000](http://localhost:3000)** in your browser and navigate to:

| Route | Purpose |
| :--- | :--- |
| `/login` | Sign in with demo user `alex@documind.ai` or any credentials |
| `/dashboard` | Document library |
| `/upload` | Upload PDF or text files |
| `/chat` | Interactive RAG chat interface |

---

## 🧪 Automated Test Suite

Run the full end-to-end test suite to verify database connectivity, PDF extraction, vector retrieval, and LLM question answering:

```bash
node scripts/run_all_tests.js
```

---

## 🌐 Deploying to Vercel (Production)

1. Push your repository to **GitHub**.
2. Go to **[vercel.com](https://vercel.com)** → **Add New Project** → import your repository.
3. Add the following **Environment Variables** in your Vercel project settings:

   | Variable | Description |
   | :--- | :--- |
   | `DATABASE_URL` | Supabase PostgreSQL connection string |
   | `DIRECT_URL` | Supabase direct connection string |
   | `GROQ_API_KEY` | Groq API key |
   | `GROQ_MODEL` | LLM model identifier |
   | `NEXTAUTH_URL` | Your production URL (e.g. `https://your-app.vercel.app`) |
   | `NEXTAUTH_SECRET` | Random 32-character secret string |

4. Click **Deploy**. Your RAG platform is live.


## 📄 License

MIT License. Built for production document intelligence.
