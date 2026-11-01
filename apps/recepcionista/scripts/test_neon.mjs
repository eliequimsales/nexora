import { PrismaClient } from '@nexora/recepcionista-prisma';

const url = 'postgresql://neondb_owner:npg_lf8xjwQ9ibuR@ep-quiet-king-b6z3lrqe.c-2.sa-east-1.aws.neon.tech/neondb?sslmode=require&connect_timeout=30';

const prisma = new PrismaClient({
  datasources: { db: { url } }
});

async function run() {
  for (let attempt = 1; attempt <= 3; attempt++) {
    try {
      console.log(`Tentativa ${attempt}: Conectando ao Neon...`);
      await prisma.$executeRawUnsafe('CREATE SCHEMA IF NOT EXISTS evolution;');
      console.log('SUCESSO: Schema evolution criado/verificado no Neon!');
      return;
    } catch (e) {
      console.warn(`Tentativa ${attempt} falhou: ${e.message}`);
      await new Promise(r => setTimeout(r, 3000));
    }
  }
}

run()
  .catch(e => console.error('Erro final:', e.message))
  .finally(() => prisma.$disconnect());
