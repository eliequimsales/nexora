import { PrismaClient } from "@nexora/recepcionista-prisma";

const prisma = new PrismaClient();

async function main() {
  const company = await prisma.company.findFirst({
    where: { name: "Nexora" },
    include: { profile: true },
  });

  if (!company) {
    console.log("Nenhuma empresa Nexora encontrada.");
    return;
  }

  console.log("Empresa:", company.name, "(ID:", company.id, ")");
  console.log("Instância:", company.profile?.whatsappInstance);
  console.log("Status:", company.profile?.whatsappStatus);
  console.log("QR Code presente no banco?", !!company.profile?.whatsappQrCode);

  const baseUrl = (process.env.EVOLUTION_API_URL || "").replace(/\/+$/, "");
  const apiKey = process.env.EVOLUTION_API_KEY;

  if (baseUrl && apiKey && company.profile?.whatsappInstance) {
    const res = await fetch(
      `${baseUrl}/instance/connectionState/${encodeURIComponent(company.profile.whatsappInstance)}`,
      { headers: { apikey: apiKey } }
    );
    const data = await res.json().catch(() => ({}));
    console.log("Estado real na Evolution:", JSON.stringify(data));
  }
}

main()
  .catch((e) => console.error(e))
  .finally(() => prisma.$disconnect());
