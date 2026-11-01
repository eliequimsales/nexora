import { PrismaClient } from "@nexora/recepcionista-prisma";

const prisma = new PrismaClient();

async function clean() {
  const items = await prisma.knowledgeItem.findMany({
    where: {
      OR: [
        { question: { contains: "posso te ensinar", mode: "insensitive" } },
        { question: { contains: "oq eu posso", mode: "insensitive" } },
      ],
    },
  });
  console.log("Found knowledge items to delete:", items);
  if (items.length > 0) {
    await prisma.knowledgeItem.deleteMany({
      where: { id: { in: items.map((i) => i.id) } },
    });
    console.log("Deleted bogus knowledge items");
  }

  const profiles = await prisma.companyProfile.findMany({
    where: {
      description: { contains: "posso te ensinar", mode: "insensitive" },
    },
  });
  for (const prof of profiles) {
    if (prof.description) {
      const cleaned = prof.description
        .split("\n")
        .filter((line) => !line.toLowerCase().includes("posso te ensinar"))
        .join("\n")
        .trim();
      await prisma.companyProfile.update({
        where: { id: prof.id },
        data: { description: cleaned },
      });
      console.log(`Cleaned profile ${prof.id} description:`, cleaned);
    }
  }
}

clean()
  .catch(console.error)
  .finally(() => prisma.$disconnect());
