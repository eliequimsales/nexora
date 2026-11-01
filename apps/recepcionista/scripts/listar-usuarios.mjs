import { PrismaClient } from "@nexora/recepcionista-prisma";

const prisma = new PrismaClient();

async function main() {
  const users = await prisma.user.findMany({
    select: { id: true, email: true, companyId: true, role: true, createdAt: true },
    orderBy: { createdAt: "desc" },
    take: 20,
  });

  console.log(`=== Total de Usuários encontrados: ${users.length} ===`);
  for (const u of users) {
    console.log(`User: ${u.email} | Role: ${u.role} | CompanyId: ${u.companyId} | Criado: ${u.createdAt}`);
  }
}

main()
  .catch((err) => {
    console.error("Erro:", err);
    process.exit(1);
  })
  .finally(() => prisma.$disconnect());
