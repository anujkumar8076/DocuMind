const { PrismaClient } = require('@prisma/client');
const prisma = new PrismaClient();

async function main() {
  // Delete the old empty placeholder document attempts
  const deleted = await prisma.document.deleteMany({
    where: {
      OR: [
        { id: 'cmsm4onvf000ltv0okn9uq0fc' },
        { id: 'cmsm4kmzj000ctv0o0tmgxjg0' },
        { id: 'cmsm4acs00001tv0o3mhttnn3' },
      ],
    },
  });

  console.log('Cleaned up old empty placeholder attempts:', deleted.count);
}

main().finally(() => prisma.$disconnect());
