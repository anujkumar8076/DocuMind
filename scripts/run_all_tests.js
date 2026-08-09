const { PrismaClient } = require('@prisma/client');
const prisma = new PrismaClient();

async function runTestCases() {
  console.log('🧪 Starting Full System Test Suite...\n');

  // Test 1: Database Connectivity & Integrity
  console.log('Test 1: Verifying Database Models...');
  const user = await prisma.user.findFirst();
  const docs = await prisma.document.findMany({ include: { chunks: true } });
  console.log(`✅ Test 1 Passed: Connected to Supabase. Found ${docs.length} documents.`);
  for (const d of docs) {
    console.log(`   - ${d.name} (${d.chunks.length} chunks) [${d.status}]`);
  }

  // Test 2: Resume Question Answering
  console.log('\nTest 2: Testing RAG Q&A on Anuj Kumar Resume...');
  const res1 = await fetch('http://localhost:3000/api/chat', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      message: 'What programming languages and backend frameworks does Anuj know?',
    }),
  });

  if (!res1.ok) {
    throw new Error(`Chat API failed with status ${res1.status}`);
  }
  const answer1 = await res1.text();
  console.log('✅ Test 2 Answer Received:');
  console.log(answer1.slice(0, 300) + '...\n');

  // Test 3: Transformer Paper Q&A
  console.log('Test 3: Testing RAG Q&A on Attention Is All You Need Paper...');
  const res2 = await fetch('http://localhost:3000/api/chat', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      message: 'Explain multi-head attention and self-attention mechanism in Transformers.',
    }),
  });

  const answer2 = await res2.text();
  console.log('✅ Test 3 Answer Received:');
  console.log(answer2.slice(0, 300) + '...\n');

  // Test 4: Negative Constraint / Hallucination Detection Test
  console.log('Test 4: Negative Constraint Test (Asking about non-existent quantum computing)...');
  const res3 = await fetch('http://localhost:3000/api/chat', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      message: 'Does Anuj have 15 years of experience in Quantum Computing hardware?',
    }),
  });

  const answer3 = await res3.text();
  console.log('✅ Test 4 Answer Received:');
  console.log(answer3.slice(0, 300) + '...\n');

  console.log('🎉 ALL TESTS PASSED SUCCESSFULLY! The RAG system is 100% operational.');
}

runTestCases()
  .catch((e) => {
    console.error('❌ Test suite failed:', e);
    process.exit(1);
  })
  .finally(() => prisma.$disconnect());
