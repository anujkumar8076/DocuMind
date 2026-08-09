import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/db/prisma';
import { chunkDocument } from '@/lib/rag/chunker';
import { embedChunks } from '@/lib/rag/embedder';
import { upsertVectors } from '@/lib/pinecone/client';
import { requireAuthSession, apiError } from '@/lib/api/response';
import { extractText } from 'unpdf';
import { DocumentStatus } from '@prisma/client';

/**
 * Extracts plain text from PDF buffer using unpdf (modern PDF.js engine)
 */
async function parsePdfBuffer(buffer: Buffer): Promise<{ text: string; pages: { pageNumber: number; text: string }[] }> {
  try {
    const uint8Array = new Uint8Array(buffer);
    const { text, totalPages } = await extractText(uint8Array);

    if (Array.isArray(text)) {
      const pages = text.map((pageText: string, idx: number) => ({
        pageNumber: idx + 1,
        text: pageText || '',
      }));
      return {
        text: text.join('\n\n'),
        pages: pages.length > 0 ? pages : [{ pageNumber: 1, text: '' }],
      };
    }

    const fullText = String(text || '');
    const rawPages = fullText.split('\f').filter((p) => p.trim().length > 0);
    const pages = rawPages.length > 0
      ? rawPages.map((p, i) => ({ pageNumber: i + 1, text: p }))
      : [{ pageNumber: 1, text: fullText }];

    return {
      text: fullText,
      pages,
    };
  } catch (err: unknown) {
    console.error('unpdf extraction failed, attempting fallback:', err);
    // Fallback: extract string streams
    const raw = buffer.toString('latin1');
    const matches = raw.match(/\((.*?)\)Tj|\[(.*?)\]TJ/g) || [];
    const extracted = matches
      .map((m) => m.replace(/[\(\)\[\]]/g, '').replace(/Tj|TJ/g, ' '))
      .join(' ')
      .trim();

    return {
      text: extracted,
      pages: [{ pageNumber: 1, text: extracted }],
    };
  }
}

export async function POST(req: NextRequest) {
  try {
    const auth = await requireAuthSession();
    if (auth.errorResponse || !auth.userId) {
      return auth.errorResponse!;
    }
    const userId = auth.userId;

    const formData = await req.formData();
    const file = formData.get('file') as File | null;

    if (!file) {
      return apiError('No file provided in form data', 'MISSING_FILE', 400);
    }

    const buffer = Buffer.from(await file.arrayBuffer());
    const originalFilename = file.name;
    const documentName = originalFilename.replace(/\.[^/.]+$/, '');
    const isPdf = originalFilename.toLowerCase().endsWith('.pdf') || (file.type && file.type.includes('pdf'));
    const mimeType = isPdf ? 'application/pdf' : 'text/plain';

    // 1. Create Document Record in DB
    const document = await prisma.document.create({
      data: {
        userId,
        name: documentName,
        originalFilename,
        s3Key: `uploads/${userId}/${Date.now()}_${originalFilename}`,
        s3Url: `local://${originalFilename}`,
        status: DocumentStatus.PROCESSING,
        fileSize: file.size,
        mimeType,
      },
    });

    // 2. Parse Text Content
    let text = '';
    let pages: { pageNumber: number; text: string }[] = [];

    if (isPdf) {
      const parsed = await parsePdfBuffer(buffer);
      text = parsed.text;
      pages = parsed.pages;
    } else {
      text = buffer.toString('utf-8');
      pages = [{ pageNumber: 1, text }];
    }

    if (!text || text.trim().length === 0) {
      text = `Document Title: ${documentName}\nFile: ${originalFilename}`;
      pages = [{ pageNumber: 1, text }];
    }

    // 3. Chunk Document
    const allChunks = [];
    let chunkCounter = 0;

    for (const page of pages) {
      if (!page.text.trim()) continue;
      const pageChunks = chunkDocument(
        page.text,
        {
          documentId: document.id,
          pageNumber: page.pageNumber,
          startChunkIndex: chunkCounter,
        },
        { chunkSizeTokens: 500, chunkOverlapTokens: 100 }
      );
      chunkCounter += pageChunks.length;
      allChunks.push(...pageChunks);
    }

    if (allChunks.length === 0) {
      allChunks.push({
        documentId: document.id,
        content: text.slice(0, 1000),
        chunkIndex: 0,
        pageNumber: 1,
        tokenCount: Math.ceil(text.length / 4),
        pineconeId: `${document.id}#0`,
      });
    }

    // 4. Generate Embeddings
    const embeddedChunks = await embedChunks(allChunks);

    // 5. Upsert Vectors to Vector Store
    await upsertVectors(embeddedChunks, userId);

    // 6. Save Chunks to Database
    await prisma.documentChunk.createMany({
      data: embeddedChunks.map((c) => ({
        documentId: document.id,
        content: c.content,
        chunkIndex: c.chunkIndex,
        pageNumber: c.pageNumber ?? 1,
        tokenCount: c.tokenCount,
        pineconeId: c.pineconeId,
      })),
    });

    const totalTokens = allChunks.reduce((acc, c) => acc + c.tokenCount, 0);
    const pageCount = Math.max(1, pages.length);

    // 7. Update Document Status to READY
    const updatedDoc = await prisma.document.update({
      where: { id: document.id },
      data: {
        status: DocumentStatus.READY,
        pageCount,
        tokenCount: totalTokens,
        chunkCount: allChunks.length,
      },
    });

    return NextResponse.json({
      success: true,
      document: updatedDoc,
      chunkCount: allChunks.length,
      tokenCount: totalTokens,
    });
  } catch (error: unknown) {
    const message = error instanceof Error ? error.message : 'Upload processing error';
    console.error('Direct upload failed:', error);
    return apiError(message, 'UPLOAD_FAILED', 500);
  }
}
