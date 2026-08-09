import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/db/prisma';
import { checkRateLimit } from '@/lib/rateLimit';
import { retrieveRelevantChunks } from '@/lib/rag/retriever';
import { analyzeGroundedness } from '@/lib/rag/hallucination';
import { formatSourceContext, contextualizeQuery } from '@/lib/rag/pipeline';
import { getChatModel } from '@/lib/rag/llm';
import {
  RAG_QA_PROMPT,
  MULTI_DOCUMENT_COMPARE_PROMPT,
  CONVERSATION_TITLE_PROMPT,
} from '@/lib/rag/prompts';
import { requireAuthSession, apiError } from '@/lib/api/response';
import { StringOutputParser } from '@langchain/core/output_parsers';
import { MessageRole, Plan } from '@prisma/client';
import { z } from 'zod';

const ChatSchema = z.object({
  message: z.string().min(1, 'Message cannot be empty').max(4000, 'Message exceeds 4000 characters limit'),
  documentIds: z.array(z.string()).default([]),
  conversationId: z.string().optional(),
  options: z
    .object({
      hallucinationCheck: z.boolean().default(true),
      mode: z.enum(['qa', 'compare']).default('qa'),
    })
    .optional(),
});

export async function POST(req: NextRequest) {
  try {
    const auth = await requireAuthSession();
    if (auth.errorResponse || !auth.userId) {
      return auth.errorResponse!;
    }
    const userId = auth.userId;
    const userPlan = auth.session?.user?.plan || Plan.PRO;

    // 1. Rate Limiting Check
    const rateLimitCap = userPlan === Plan.PRO ? 60 : 10;
    const rateCheck = await checkRateLimit(`chat:${userId}`, rateLimitCap, 60);

    if (!rateCheck.success) {
      return apiError(
        `Rate limit exceeded. Maximum ${rateLimitCap} queries per minute allowed on your current plan.`,
        'RATE_LIMIT_EXCEEDED',
        429,
        undefined,
        {
          'Retry-After': String(rateCheck.reset),
          'X-RateLimit-Limit': String(rateCheck.limit),
          'X-RateLimit-Remaining': String(rateCheck.remaining),
        }
      );
    }

    let body: unknown;
    try {
      body = await req.json();
    } catch {
      return apiError('Malformed JSON payload', 'INVALID_JSON', 400);
    }

    const validated = ChatSchema.safeParse(body);
    if (!validated.success) {
      return apiError('Invalid request parameters', 'VALIDATION_FAILED', 400, validated.error.flatten());
    }

    const { message: userPrompt, documentIds, options } = validated.data;
    let conversationId = validated.data.conversationId;

    // 2. Load or Create Conversation
    let conversation = null;
    if (conversationId) {
      conversation = await prisma.conversation.findUnique({
        where: { id: conversationId },
        include: {
          messages: {
            orderBy: { createdAt: 'asc' },
            take: 10,
          },
        },
      });

      if (conversation && conversation.userId !== userId) {
        return apiError('Forbidden: Access to this conversation is denied', 'FORBIDDEN', 403);
      }
    }

    if (!conversation) {
      conversation = await prisma.conversation.create({
        data: {
          userId,
          documentId: documentIds.length === 1 ? (documentIds[0] ?? null) : null,
          title: userPrompt.slice(0, 35) + '...',
        },
        include: {
          messages: true,
        },
      });
      conversationId = conversation.id;

      // Async title generation
      (async () => {
        try {
          const titleModel = getChatModel({ fastModel: true, temperature: 0.2 });
          const chain = CONVERSATION_TITLE_PROMPT.pipe(titleModel).pipe(new StringOutputParser());
          const generatedTitle = await chain.invoke({ question: userPrompt });
          if (generatedTitle) {
            await prisma.conversation.update({
              where: { id: conversation!.id },
              data: { title: generatedTitle.replace(/["']/g, '').trim() },
            });
          }
        } catch {
          // Ignore title errors
        }
      })();
    }

    // 3. Save User Message to DB in Transaction
    await prisma.$transaction([
      prisma.message.create({
        data: {
          conversationId: conversation.id,
          role: MessageRole.USER,
          content: userPrompt,
        },
      }),
      prisma.conversation.update({
        where: { id: conversation.id },
        data: { updatedAt: new Date() },
      }),
    ]);

    // 4. Retrieve Context Chunks with Reranking
    const history = (conversation.messages || []).map((m) => ({
      role: m.role.toLowerCase(),
      content: m.content,
    }));

    const standaloneQuery = await contextualizeQuery(userPrompt, history);
    const sources = await retrieveRelevantChunks(standaloneQuery, documentIds, userId, {
      topK: options?.mode === 'compare' ? 8 : 4,
      maxContextTokens: 3500,
    });

    const formattedContext = formatSourceContext(sources);

    // 5. Initialize streaming LLM (Groq / OpenAI)
    const promptTemplate =
      options?.mode === 'compare'
        ? MULTI_DOCUMENT_COMPARE_PROMPT
        : RAG_QA_PROMPT;

    const chatModel = getChatModel({ streaming: true, temperature: 0.1 });

    const historyMessages = history.map((h) => [
      h.role === 'user' ? 'human' : 'assistant',
      h.content,
    ]);

    const chain = promptTemplate.pipe(chatModel).pipe(new StringOutputParser());
    const stream = await chain.stream({
      context: formattedContext,
      chat_history: historyMessages,
      question: userPrompt,
    });

    // 6. Streaming Response Handler with Post-Generation Groundedness
    let completeResponseText = '';
    const textEncoder = new TextEncoder();
    const convIdForClosure = conversation.id;

    const readableStream = new ReadableStream({
      async start(controller) {
        try {
          for await (const chunk of stream) {
            completeResponseText += chunk;
            controller.enqueue(textEncoder.encode(chunk));
          }

          // Run hallucination evaluation on complete response
          const hallucinationResult = await analyzeGroundedness(completeResponseText, sources);

          // Persist assistant message with sources and groundedness data
          await prisma.message.create({
            data: {
              conversationId: convIdForClosure,
              role: MessageRole.ASSISTANT,
              content: completeResponseText,
              sources: sources as any,
              hallucinationScore: hallucinationResult.overallScore,
              hallucinationData: hallucinationResult as any,
              retrievedChunkIds: sources.map((s) => s.id),
              tokensUsed: Math.ceil((formattedContext.length + completeResponseText.length) / 4),
            },
          });

          controller.close();
        } catch (streamError) {
          console.error('Error during token streaming:', streamError);
          controller.error(streamError);
        }
      },
    });

    return new Response(readableStream, {
      headers: {
        'Content-Type': 'text/plain; charset=utf-8',
        'X-Conversation-Id': conversation.id,
        'X-Sources-Count': String(sources.length),
        'X-Sources': encodeURIComponent(JSON.stringify(sources)),
      },
    });
  } catch (error: unknown) {
    const message = error instanceof Error ? error.message : 'Internal server error';
    return apiError(message, 'INTERNAL_SERVER_ERROR', 500);
  }
}
