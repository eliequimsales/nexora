import { prisma } from "./db";
import { DEFAULT_TIMEZONE } from "./ai/prompt";

export interface Reports {
  days: number;
  totalConversations: number;
  aiHandled: number;
  transferred: number;
  leads: number;
  waitingNow: number;
  topQuestions: { text: string; count: number }[];
  hourly: number[]; // 24 posições, mensagens de clientes por hora (fuso de Brasília)
}

function normalizeQuestion(text: string): string {
  return text.toLowerCase().replace(/\s+/g, " ").trim();
}

export async function getReports(companyId: string, days: number): Promise<Reports> {
  const since = new Date(Date.now() - days * 24 * 60 * 60 * 1000);

  const [totalConversations, aiHandled, transferred, leads, waitingNow] = await Promise.all([
    prisma.conversation.count({ where: { companyId, createdAt: { gte: since } } }),
    prisma.conversation.count({
      where: { companyId, createdAt: { gte: since }, messages: { some: { role: "AI" } } },
    }),
    prisma.conversation.count({
      where: {
        companyId,
        createdAt: { gte: since },
        OR: [
          { status: { in: ["WAITING_HUMAN", "HUMAN"] } },
          { messages: { some: { role: "HUMAN" } } },
        ],
      },
    }),
    prisma.lead.count({ where: { companyId, createdAt: { gte: since } } }),
    prisma.conversation.count({ where: { companyId, status: "WAITING_HUMAN" } }),
  ]);

  const customerMessages = await prisma.message.findMany({
    where: {
      role: "CUSTOMER",
      createdAt: { gte: since },
      conversation: { companyId },
    },
    select: { content: true, createdAt: true },
    orderBy: { createdAt: "desc" },
    take: 5000,
  });

  // Principais dúvidas: mensagens com "?" agrupadas por texto normalizado
  const questionCounts = new Map<string, { text: string; count: number }>();
  for (const message of customerMessages) {
    if (!message.content.includes("?")) continue;
    const key = normalizeQuestion(message.content);
    if (key.length < 4) continue;
    const entry = questionCounts.get(key);
    if (entry) entry.count += 1;
    else questionCounts.set(key, { text: message.content.slice(0, 160), count: 1 });
  }
  const topQuestions = [...questionCounts.values()]
    .sort((a, b) => b.count - a.count)
    .slice(0, 8);

  // Horários com mais mensagens (no fuso de Brasília)
  const hourFormatter = new Intl.DateTimeFormat("en-US", {
    timeZone: DEFAULT_TIMEZONE,
    hour: "2-digit",
    hourCycle: "h23",
  });
  const hourly = new Array<number>(24).fill(0);
  for (const message of customerMessages) {
    const hour = parseInt(hourFormatter.format(message.createdAt), 10);
    if (hour >= 0 && hour < 24) hourly[hour] += 1;
  }

  return { days, totalConversations, aiHandled, transferred, leads, waitingNow, topQuestions, hourly };
}
