import { PrismaClient, Plan, DocumentStatus, MessageRole } from '@prisma/client';

const prisma = new PrismaClient();

async function main() {
  console.log('🌱 Starting database seeding...');

  // 1. Cleanup existing sample data
  await prisma.message.deleteMany();
  await prisma.conversation.deleteMany();
  await prisma.documentChunk.deleteMany();
  await prisma.document.deleteMany();
  await prisma.session.deleteMany();
  await prisma.account.deleteMany();
  await prisma.user.deleteMany();

  // 2. Create Test User
  const testUser = await prisma.user.create({
    data: {
      id: 'usr_test_demo_01',
      name: 'Alex AI Engineer',
      email: 'alex@documind.ai',
      image: 'https://images.unsplash.com/photo-1534528741775-53994a69daeb?w=150',
      plan: Plan.PRO,
    },
  });

  console.log(`✅ Created test user: ${testUser.email} (${testUser.id})`);

  // 3. Create Sample Document
  const sampleDoc = await prisma.document.create({
    data: {
      id: 'doc_sample_attention_01',
      userId: testUser.id,
      name: 'Attention Is All You Need',
      originalFilename: 'attention-is-all-you-need.pdf',
      s3Key: `documents/${testUser.id}/doc_sample_attention_01.pdf`,
      s3Url: 'https://arxiv.org/pdf/1706.03762.pdf',
      status: DocumentStatus.READY,
      pageCount: 15,
      tokenCount: 8450,
      chunkCount: 3,
      fileSize: 2215200,
      mimeType: 'application/pdf',
    },
  });

  console.log(`✅ Created sample document: ${sampleDoc.name}`);

  // 4. Create Sample Document Chunks
  const chunk1 = await prisma.documentChunk.create({
    data: {
      id: 'chk_attention_01',
      documentId: sampleDoc.id,
      content: 'The dominant sequence transduction models are based on complex recurrent or convolutional neural networks that include an encoder and a decoder. The best performing models also connect the encoder and decoder through an attention mechanism. We propose a new simple network architecture, the Transformer, based solely on attention mechanisms, dispensing with recurrence and convolutions entirely.',
      chunkIndex: 0,
      pageNumber: 1,
      tokenCount: 68,
      pineconeId: `${sampleDoc.id}#0`,
    },
  });

  const chunk2 = await prisma.documentChunk.create({
    data: {
      id: 'chk_attention_02',
      documentId: sampleDoc.id,
      content: 'An attention function can be described as mapping a query and a set of key-value pairs to an output, where the query, keys, values, and output are all vectors. The output is computed as a weighted sum of the values, where the weight assigned to each value is computed by a compatibility function of the query with the corresponding key.',
      chunkIndex: 1,
      pageNumber: 3,
      tokenCount: 65,
      pineconeId: `${sampleDoc.id}#1`,
    },
  });

  const chunk3 = await prisma.documentChunk.create({
    data: {
      id: 'chk_attention_03',
      documentId: sampleDoc.id,
      content: 'Multi-head attention allows the model to jointly attend to information from different representation subspaces at different positions. MultiHead(Q, K, V) = Concat(head_1, ..., head_h) W^O where head_i = Attention(Q W_i^Q, K W_i^K, V W_i^V).',
      chunkIndex: 2,
      pageNumber: 4,
      tokenCount: 58,
      pineconeId: `${sampleDoc.id}#2`,
    },
  });

  console.log(`✅ Created 3 sample chunks for document`);

  // 5. Create Sample Conversation
  const conversation = await prisma.conversation.create({
    data: {
      id: 'conv_attention_demo',
      userId: testUser.id,
      documentId: sampleDoc.id,
      title: 'Transformer Architecture & Self-Attention',
    },
  });

  // 6. Create Messages in Conversation
  await prisma.message.create({
    data: {
      conversationId: conversation.id,
      role: MessageRole.USER,
      content: 'How does the Transformer model replace recurrence and convolutions?',
    },
  });

  await prisma.message.create({
    data: {
      conversationId: conversation.id,
      role: MessageRole.ASSISTANT,
      content: 'The Transformer architecture dispenses with recurrence and convolutions entirely by relying solely on attention mechanisms [SOURCE 1]. It maps queries and key-value pairs to vector outputs through compatibility functions [SOURCE 2] and utilizes multi-head attention to attend to representation subspaces jointly [SOURCE 3].',
      sources: [
        {
          id: chunk1.id,
          pineconeId: chunk1.pineconeId,
          documentId: sampleDoc.id,
          documentName: sampleDoc.name,
          chunkIndex: chunk1.chunkIndex,
          pageNumber: chunk1.pageNumber,
          content: chunk1.content,
          score: 0.94,
        },
        {
          id: chunk2.id,
          pineconeId: chunk2.pineconeId,
          documentId: sampleDoc.id,
          documentName: sampleDoc.name,
          chunkIndex: chunk2.chunkIndex,
          pageNumber: chunk2.pageNumber,
          content: chunk2.content,
          score: 0.88,
        },
        {
          id: chunk3.id,
          pineconeId: chunk3.pineconeId,
          documentId: sampleDoc.id,
          documentName: sampleDoc.name,
          chunkIndex: chunk3.chunkIndex,
          pageNumber: chunk3.pageNumber,
          content: chunk3.content,
          score: 0.84,
        },
      ],
      hallucinationScore: 0.98,
      hallucinationData: {
        overallScore: 0.98,
        riskLevel: 'LOW',
        annotatedSentences: [
          {
            sentence: 'The Transformer architecture dispenses with recurrence and convolutions entirely by relying solely on attention mechanisms.',
            status: 'GROUNDED',
            groundingChunkId: chunk1.id,
            confidence: 0.99,
          },
          {
            sentence: 'It maps queries and key-value pairs to vector outputs through compatibility functions and utilizes multi-head attention to attend to representation subspaces jointly.',
            status: 'GROUNDED',
            groundingChunkId: chunk2.id,
            confidence: 0.96,
          },
        ],
      },
      retrievedChunkIds: [chunk1.id, chunk2.id, chunk3.id],
      tokensUsed: 420,
    },
  });

  console.log('🎉 Seeding completed successfully!');
}

main()
  .catch((e) => {
    console.error('❌ Seeding error:', e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
