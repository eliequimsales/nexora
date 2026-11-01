import { PrismaClient } from '@nexora/recepcionista-prisma';
import fs from 'fs';

const dbUrl = 'postgresql://postgres:IwaWdlFMxCZgSIyHmhQfgJSQNpWwSElF@maglev.proxy.rlwy.net:29542/recepcionista';
process.env.DATABASE_URL = dbUrl;

const prisma = new PrismaClient({
  datasources: { db: { url: dbUrl } }
});

async function main() {
  console.log('Conectando ao banco de produção no Railway...');
  
  const companies = await prisma.company.findMany({
    include: {
      profile: true,
      services: true,
      knowledgeItems: true,
      knowledgeGaps: true,
      conversations: {
        include: { messages: true }
      },
      customers: true,
      appointments: true,
      leads: true,
      passes: true
    }
  });

  console.log(`Encontradas ${companies.length} empresas.`);
  
  const backup = {
    dataExportacao: new Date().toISOString(),
    totalEmpresas: companies.length,
    companies
  };

  fs.writeFileSync('../../backup_producao_completo.json', JSON.stringify(backup, null, 2), 'utf8');
  console.log('✅ Backup salvo com sucesso em backup_producao_completo.json!');
}

main()
  .catch(err => {
    console.error('Erro no backup:', err);
    process.exit(1);
  })
  .finally(() => prisma.$disconnect());
