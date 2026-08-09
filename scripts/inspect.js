const { PrismaClient } = require('@prisma/client');
const prisma = new PrismaClient();

async function main() {
  const docs = await prisma.document.findMany({
    include: { chunks: true },
    orderBy: { createdAt: 'desc' },
  });

  console.log('Total documents in database:', docs.length);
  for (const d of docs) {
    console.log(`\n📄 Doc ID: ${d.id}`);
    console.log(`   Name: ${d.name}`);
    console.log(`   Status: ${d.status}`);
    console.log(`   Chunks: ${d.chunks.length}`);
    console.log(`   Sample chunk preview:`);
    if (d.chunks.length > 0) {
      console.log('   ---');
      console.log(d.chunks[0].content.slice(0, 300));
      console.log('   ---');
    }
  }
}

main().finally(() => prisma.$disconnect());
