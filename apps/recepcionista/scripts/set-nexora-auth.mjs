import { PrismaClient } from "@nexora/recepcionista-prisma";
import bcrypt from "bcryptjs";
import fs from "fs";

const prisma = new PrismaClient();

async function main() {
  const company = await prisma.company.findFirst({
    where: { name: "Nexora" },
    include: { profile: true },
  });

  if (!company) {
    console.error("Empresa Nexora não encontrada");
    return;
  }

  const senha = "Nexora2026!";
  const hash = await bcrypt.hash(senha, 10);

  await prisma.company.update({
    where: { id: company.id },
    data: {
      email: "nexora.iabusiness@gmail.com",
      passwordHash: hash,
      phone: "5521966106737",
    },
  });

  console.log("✔ Credenciais da Nexora atualizadas com sucesso:");
  console.log("  E-mail: nexora.iabusiness@gmail.com");
  console.log("  Senha:  Nexora2026!");
  console.log("  ID:     " + company.id);

  if (company.profile?.whatsappQrCode) {
    const b64 = company.profile.whatsappQrCode.replace(/^data:image\/png;base64,/, "");
    fs.writeFileSync("/tmp/nexora-qr.png", Buffer.from(b64, "base64"));
    console.log("✔ QR Code salvo em /tmp/nexora-qr.png (" + b64.length + " bytes)");
    console.log("QR_B64_START:" + b64.slice(0, 100) + "...QR_B64_END");
  }
}

main()
  .catch(console.error)
  .finally(() => prisma.$disconnect());
