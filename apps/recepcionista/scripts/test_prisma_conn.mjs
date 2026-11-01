import { PrismaClient } from '@nexora/recepcionista-prisma';

console.log('DATABASE_URL carregada:', process.env.DATABASE_URL ? 'Sim (definida)' : 'Não');

const prisma = new PrismaClient();

async function run() {
  console.log('Conectando ao Neon com PrismaClient...');
  const count = await prisma.company.count();
  console.log('Sucesso! Contagem de empresas no Neon:', count);
}

run()
  .catch((e) => console.error('Erro na conexão:', e.message))
  .finally(() => prisma.$disconnect());
