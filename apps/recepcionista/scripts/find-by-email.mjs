import { PrismaClient } from "@nexora/recepcionista-prisma";

const prisma = new PrismaClient();

async function main() {
  const company = await prisma.company.findUnique({
    where: { email: "nexora.iabusiness@gmail.com" },
    include: { profile: true },
  });

  if (company) {
    console.log("Encontrada empresa existente com esse e-mail:");
    console.log("  ID:", company.id);
    console.log("  Nome:", company.name);
    console.log("  Slug:", company.slug);
    console.log("  Telefone:", company.phone);
    console.log("  Instância:", company.profile?.whatsappInstance);
    console.log("  Status:", company.profile?.whatsappStatus);
    console.log("  Tem senha?", !!company.passwordHash);
  } else {
    console.log("Nenhuma empresa encontrada com nexora.iabusiness@gmail.com");
  }
}

main().catch(console.error).finally(() => prisma.$disconnect());
