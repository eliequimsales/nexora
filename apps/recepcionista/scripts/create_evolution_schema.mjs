import { PrismaClient } from '@nexora/recepcionista-prisma';

const prisma = new PrismaClient({
  datasources: {
    db: { url: 'postgresql://neondb_owner:npg_lf8xjwQ9ibuR@ep-quiet-king-b6z3lrqe.c-2.sa-east-1.aws.neon.tech/neondb?sslmode=require' }
  }
});

async function main() {
  await prisma.$executeRawUnsafe('CREATE SCHEMA IF NOT EXISTS evolution;');
  console.log('SCHEMA evolution CRIADO COM SUCESSO NO NEON!');
}

main().catch(console.error).finally(() => prisma.$disconnect());
