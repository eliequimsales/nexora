import { PrismaClient } from "@nexora/recepcionista-prisma";

const prisma = new PrismaClient();

async function main() {
  const companies = await prisma.company.findMany({
    include: {
      profile: true,
      services: true,
      knowledgeItems: true,
    },
    orderBy: { createdAt: "desc" },
    take: 10,
  });

  console.log(`=== Total de Empresas encontradas: ${companies.length} ===`);
  for (const c of companies) {
    console.log(`\nEmpresa: "${c.name}" (ID: ${c.id})`);
    console.log(`  Slug: ${c.slug}`);
    console.log(`  Email: ${c.email}`);
    console.log(`  Telefone: ${c.phone}`);
    console.log(`  Assinatura Status: ${c.subscriptionStatus}`);
    console.log(`  WhatsApp Instância: ${c.profile?.whatsappInstance ?? "Nenhuma"}`);
    console.log(`  WhatsApp Status: ${c.profile?.whatsappStatus ?? "Desconectado"}`);
    console.log(`  Plantão Ativo: ${c.profile?.plantaoAtivo}`);
    console.log(`  Atendente Nome: ${c.profile?.atendenteNome}`);
    console.log(`  Serviços cadastrados: ${c.services.length}`);
    console.log(`  Dúvidas ensinadas: ${c.knowledgeItems.length}`);
  }
}

main()
  .catch((err) => {
    console.error("Erro:", err);
    process.exit(1);
  })
  .finally(() => prisma.$disconnect());
