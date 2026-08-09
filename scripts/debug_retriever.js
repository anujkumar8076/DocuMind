const { retrieveRelevantChunks } = require('../lib/rag/retriever');
const { queryVectors } = require('../lib/pinecone/client');
const { embedQuery } = require('../lib/rag/embedder');
const { prisma } = require('../lib/db/prisma');

async function debug() {
  const query = "Summarize Anuj Kumar's technical skills, experience, and projects in detail.";
  const docId = 'cmsm4rtj400076h095upbjxob';
  const userId = 'usr_test_demo_01';

  console.log('1. Checking DB chunks for doc:', docId);
  const chunks = await prisma.documentChunk.findMany({
    where: { documentId: docId },
  });
  console.log('Found chunks in DB:', chunks.length);
  for (const c of chunks) {
    console.log(`Chunk #${c.chunkIndex} length: ${c.content.length} chars | preview: ${c.content.slice(0, 100)}...`);
  }

  console.log('\n2. Testing embedQuery...');
  const emb = await embedQuery(query);
  console.log('Query embedding vector length:', emb.length, 'sample values:', emb.slice(0, 5));

  console.log('\n3. Testing queryVectors...');
  const vectorResults = await queryVectors(emb, {
    topK: 6,
    documentIds: [docId],
    userId,
    minScore: 0.1,
  });
  console.log('vectorResults length:', vectorResults.length);
  console.log('vectorResults:', vectorResults);

  console.log('\n4. Testing retrieveRelevantChunks...');
  const citations = await retrieveRelevantChunks(query, [docId], userId, {
    minSimilarity: 0.1,
  });
  console.log('Citations returned:', citations.length);
  console.log('Citations:', citations);
}

debug().finally(() => prisma.$disconnect());
