import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();

async function main() {
  await prisma.$executeRawUnsafe(
    'CREATE UNIQUE INDEX IF NOT EXISTS "job_source_primary_idx" ON "JobSourceReference"("jobId") WHERE "isPrimary" = true;'
  );
  console.log('Partial unique index job_source_primary_idx applied successfully.');
}

main()
  .catch((e) => {
    console.error(e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
