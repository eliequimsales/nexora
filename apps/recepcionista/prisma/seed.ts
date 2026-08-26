/**
 * Cenário de demonstração — empresa fictícia genérica (serve para qualquer
 * segmento) com conversas, oportunidades e histórico suficientes para
 * apresentar o Nexora Atendente em 5 minutos.
 *
 * Uso:  pnpm db:seed   (re-executável: recria a empresa demo do zero)
 * Login: demo@nexora.app / demo12345
 */
import {
  PrismaClient,
  ConversationStatus,
  MessageRole,
} from "@nexora/recepcionista-prisma";
import bcrypt from "bcryptjs";

const prisma = new PrismaClient();

const DEMO_EMAIL = "demo@nexora.app";
const OLD_DEMO_EMAILS = ["demo@nexora.app", "demo@recepcionista.app"];
const DEMO_PASSWORD = "demo12345";

/** Data de N dias atrás, em hora local de São Paulo (UTC-3). */
function spTime(daysAgo: number, hour: number, minute = 0): Date {
  const date = new Date();
  date.setUTCDate(date.getUTCDate() - daysAgo);
  date.setUTCHours(hour + 3, minute, 0, 0);
  return date;
}

interface SeedMessage {
  role: MessageRole;
  content: string;
  at: Date;
}

interface SeedConversation {
  phone: string;
  name: string | null;
  status: ConversationStatus;
  followUpCount?: number;
  lastFollowUpAt?: Date;
  messages: SeedMessage[];
  lead?: { name: string; interest: string };
}

const CONVERSATIONS: SeedConversation[] = [
  {
    phone: "5511999110001",
    name: "Marcos Oliveira",
    status: "FINISHED",
    messages: [
      { role: "CUSTOMER", content: "Boa noite! Vocês ainda estão abertos? Preciso de um orçamento 🙏", at: spTime(2, 2, 37) },
      { role: "AI", content: "Boa noite! 😊 Nosso horário é de segunda a sexta, das 8h às 18h — mas posso adiantar seu pedido agora mesmo. Me conta o que você precisa?", at: spTime(2, 2, 37) },
      { role: "CUSTOMER", content: "Preciso do serviço completo ainda esta semana. Meu nome é Marcos", at: spTime(2, 2, 38) },
      { role: "AI", content: "Perfeito, Marcos! Registrei seu pedido de orçamento para esta semana. Nossa equipe confirma os detalhes com você logo cedo. Posso ajudar em mais alguma coisa?", at: spTime(2, 2, 38) },
      { role: "CUSTOMER", content: "Só isso mesmo, obrigado!", at: spTime(2, 2, 39) },
      { role: "AI", content: "Nós que agradecemos, Marcos! Qualquer dúvida é só chamar. Até logo! 😊", at: spTime(2, 2, 39) },
      { role: "SYSTEM", content: "Conversa finalizada", at: spTime(2, 9, 5) },
    ],
    lead: { name: "Marcos Oliveira", interest: "orçamento do serviço completo" },
  },
  {
    phone: "5511999110002",
    name: "Juliana Martins",
    status: "AI",
    messages: [
      { role: "CUSTOMER", content: "Bom dia! Quais são as formas de pagamento?", at: spTime(0, 9, 12) },
      { role: "AI", content: "Bom dia! Aceitamos Pix, dinheiro e cartão em até 6x sem juros. No pagamento à vista você ganha 10% de desconto. Quer que eu registre um orçamento para você? Como posso te chamar?", at: spTime(0, 9, 12) },
      { role: "CUSTOMER", content: "Quanto custa o serviço?", at: spTime(0, 9, 15) },
      { role: "AI", content: "O serviço padrão custa R$ 250 e o plano mensal sai por R$ 480/mês. O orçamento detalhado é gratuito — posso registrar o seu?", at: spTime(0, 9, 16) },
    ],
  },
  {
    phone: "5511999110003",
    name: "Carlos Souza",
    status: "WAITING_HUMAN",
    messages: [
      { role: "CUSTOMER", content: "Oi, contratei o serviço semana passada e ainda não foi resolvido", at: spTime(0, 14, 2) },
      { role: "AI", content: "Sinto muito por isso, Carlos! Esse tipo de situação merece a atenção direta da nossa equipe. Vou te encaminhar agora para alguém resolver com você, tudo bem?", at: spTime(0, 14, 2) },
      { role: "CUSTOMER", content: "Sim, quero falar com atendente por favor", at: spTime(0, 14, 3) },
      { role: "AI", content: "Claro! Vou te transferir para um atendente da nossa equipe. Só um instante, por favor. 🙋", at: spTime(0, 14, 3) },
      { role: "SYSTEM", content: "Transferido para atendimento humano — Palavra-chave de atendimento humano detectada", at: spTime(0, 14, 3) },
    ],
  },
  {
    phone: "5511999110004",
    name: "Fernanda Lima",
    status: "HUMAN",
    messages: [
      { role: "CUSTOMER", content: "Boa tarde, queria contratar para duas unidades da minha empresa", at: spTime(1, 15, 30) },
      { role: "AI", content: "Boa tarde! Que ótimo! Para o serviço padrão o valor é R$ 250 por unidade. Qual o seu nome para eu registrar o interesse?", at: spTime(1, 15, 31) },
      { role: "CUSTOMER", content: "Fernanda. Fazem desconto para contrato das duas juntas?", at: spTime(1, 15, 34) },
      { role: "AI", content: "Ótima pergunta, Fernanda! Condições especiais para mais de uma unidade quem combina é a nossa equipe. Vou te encaminhar para alguém agora, combinado?", at: spTime(1, 15, 34) },
      { role: "SYSTEM", content: "Transferido para atendimento humano — negociação de condição especial", at: spTime(1, 15, 34) },
      { role: "SYSTEM", content: "Sua equipe assumiu a conversa — Atendente pausado", at: spTime(1, 15, 40) },
      { role: "HUMAN", content: "Oi Fernanda, aqui é a Renata! Para duas unidades conseguimos 15% no valor total. Quer que eu prepare a proposta e envie ainda hoje?", at: spTime(1, 15, 42) },
      { role: "CUSTOMER", content: "Perfeito! Pode enviar sim", at: spTime(1, 15, 50) },
    ],
    lead: { name: "Fernanda Lima", interest: "contrato para 2 unidades" },
  },
  {
    phone: "5511999110005",
    name: "Ricardo Alves",
    status: "AI",
    followUpCount: 1,
    lastFollowUpAt: spTime(1, 11, 0),
    messages: [
      { role: "CUSTOMER", content: "Oi, quanto custa o serviço?", at: spTime(2, 10, 20) },
      { role: "AI", content: "Oi! O serviço padrão custa R$ 250 e o orçamento detalhado é gratuito. Atendemos de segunda a sexta das 8h às 18h e sábado das 8h às 12h. Quer que eu registre um orçamento? Como posso te chamar?", at: spTime(2, 10, 20) },
      { role: "CUSTOMER", content: "Sou o Ricardo. Vou ver aqui e te falo", at: spTime(2, 10, 25) },
      { role: "AI", content: "Combinado, Ricardo! Fico no aguardo. Qualquer dúvida sobre valores ou prazos é só chamar. 😊", at: spTime(2, 10, 25) },
      { role: "AI", content: "Oi! Ficou alguma dúvida sobre o orçamento? Ainda temos agenda livre esta semana — é só me falar o melhor dia para você. 😊", at: spTime(1, 11, 0) },
    ],
    lead: { name: "Ricardo Alves", interest: "orçamento do serviço padrão" },
  },
  {
    phone: "5511999110006",
    name: "Patrícia Gomes",
    status: "FINISHED",
    messages: [
      { role: "CUSTOMER", content: "Qual o horário de funcionamento?", at: spTime(5, 20, 15) },
      { role: "AI", content: "Olá! Atendemos de segunda a sexta das 8h às 18h e aos sábados das 8h às 12h. Posso ajudar com mais alguma coisa?", at: spTime(5, 20, 15) },
      { role: "CUSTOMER", content: "Onde vocês ficam?", at: spTime(5, 20, 17) },
      { role: "AI", content: "Ficamos na Av. Central, 1000 — Centro, São Paulo/SP, perto do metrô. Quer que eu registre uma visita ou orçamento para você? 😊", at: spTime(5, 20, 18) },
      { role: "SYSTEM", content: "Conversa finalizada", at: spTime(4, 9, 0) },
    ],
  },
  {
    phone: "5511999110007",
    name: "Bruno Castro",
    status: "FINISHED",
    messages: [
      { role: "CUSTOMER", content: "Oi! Vocês emitem nota fiscal?", at: spTime(6, 16, 40) },
      { role: "AI", content: "Oi! Emitimos sim, nota fiscal para todos os serviços. Posso ajudar com um orçamento?", at: spTime(6, 16, 40) },
      { role: "CUSTOMER", content: "Qual o horário de funcionamento?", at: spTime(6, 16, 42) },
      { role: "AI", content: "Segunda a sexta das 8h às 18h e sábado das 8h às 12h. Quer que eu registre um horário de preferência para você?", at: spTime(6, 16, 42) },
      { role: "SYSTEM", content: "Conversa finalizada", at: spTime(5, 9, 0) },
    ],
  },
  {
    phone: "5511999110008",
    name: null,
    status: "AI",
    messages: [
      { role: "CUSTOMER", content: "Quanto custa o serviço?", at: spTime(0, 19, 5) },
      { role: "AI", content: "Olá! O serviço padrão custa R$ 250 e o orçamento é gratuito. Quer que eu registre o seu? Como posso te chamar?", at: spTime(0, 19, 5) },
    ],
  },
];

async function main() {
  console.log("Recriando empresa de demonstração...");
  await prisma.company.deleteMany({ where: { email: { in: OLD_DEMO_EMAILS } } });

  const company = await prisma.company.create({
    data: {
      name: "Nexora Demonstração",
      email: DEMO_EMAIL,
      passwordHash: await bcrypt.hash(DEMO_PASSWORD, 10),
      phone: "11999990000",
      plan: "trial",
      profile: {
        create: {
          description:
            "Empresa de produtos e serviços usada para demonstrar o Nexora Atendente. Atende clientes da região há 10 anos, com equipe própria e orçamento gratuito.",
          address: "Av. Central, 1000 — Centro, São Paulo/SP (perto do metrô)",
          productsServices:
            "- Serviço padrão (execução em até 1h)\n- Plano mensal (manutenção e suporte)\n- Visita técnica com orçamento gratuito\n- Produtos sob encomenda",
          pricingInfo:
            "- Serviço padrão: R$ 250\n- Plano mensal: R$ 480/mês\n- Visita técnica / orçamento: gratuito\n- 10% de desconto no pagamento à vista",
          paymentMethods: "Pix, dinheiro e cartão em até 6x sem juros",
          serviceRules:
            "Nunca confirmar prazo ou agenda como garantidos — a equipe confirma. Condições especiais e descontos além do à vista só com a equipe. Reclamações e problemas: encaminhar para a equipe.",
          aiTone: "acolhedor e objetivo, como um atendente experiente que conhece os clientes",
          greetingMessage: "Olá! 👋 Aqui é o atendente da Nexora Demonstração. Como posso ajudar?",
          awayMessage:
            "Estamos fechados agora, mas já anotei sua mensagem! Nossa equipe retorna no próximo horário de atendimento (seg–sex 8h às 18h, sáb 8h às 12h).",
          businessHours: [
            { day: 0, open: "08:00", close: "18:00", closed: true },
            { day: 1, open: "08:00", close: "18:00", closed: false },
            { day: 2, open: "08:00", close: "18:00", closed: false },
            { day: 3, open: "08:00", close: "18:00", closed: false },
            { day: 4, open: "08:00", close: "18:00", closed: false },
            { day: 5, open: "08:00", close: "18:00", closed: false },
            { day: 6, open: "08:00", close: "12:00", closed: false },
          ],
          faqs: [
            { question: "Vocês emitem nota fiscal?", answer: "Sim, emitimos nota fiscal para todos os produtos e serviços." },
            { question: "O orçamento é pago?", answer: "Não! A visita técnica e o orçamento são gratuitos e sem compromisso." },
            { question: "Vocês atendem na minha região?", answer: "Atendemos toda a capital e região metropolitana. Fora dessa área, consulte a equipe." },
          ],
          handoffKeywords: ["falar com atendente", "reclamação", "urgente", "cancelar"],
          followUpEnabled: true,
          followUpDelayHours: 24,
          followUpMessage:
            "Oi! Ficou alguma dúvida sobre o orçamento? Ainda temos agenda livre esta semana — é só me falar o melhor dia para você. 😊",
          maxFollowUps: 2,
          whatsappInstance: "nexora-demo",
        },
      },
    },
  });

  for (const seed of CONVERSATIONS) {
    const firstAt = seed.messages[0].at;
    const lastAt = seed.messages[seed.messages.length - 1].at;
    const lastCustomerAt = [...seed.messages].reverse().find((m) => m.role === "CUSTOMER")?.at;

    await prisma.conversation.create({
      data: {
        companyId: company.id,
        customerPhone: seed.phone,
        customerName: seed.name,
        status: seed.status,
        followUpCount: seed.followUpCount ?? 0,
        lastFollowUpAt: seed.lastFollowUpAt ?? null,
        lastCustomerMessageAt: lastCustomerAt ?? null,
        createdAt: firstAt,
        updatedAt: lastAt,
        messages: {
          create: seed.messages.map((m) => ({ role: m.role, content: m.content, createdAt: m.at })),
        },
        ...(seed.lead
          ? {
              lead: {
                create: {
                  companyId: company.id,
                  name: seed.lead.name,
                  phone: seed.phone,
                  interest: seed.lead.interest,
                  createdAt: lastAt,
                },
              },
            }
          : {}),
      },
    });
  }

  const [conversations, messages, leads] = await Promise.all([
    prisma.conversation.count({ where: { companyId: company.id } }),
    prisma.message.count({ where: { conversation: { companyId: company.id } } }),
    prisma.lead.count({ where: { companyId: company.id } }),
  ]);

  console.log("");
  console.log("✔ Empresa demo criada: Nexora Demonstração");
  console.log(`  ${conversations} conversas · ${messages} mensagens · ${leads} oportunidades`);
  console.log("");
  console.log(`  Login:  ${DEMO_EMAIL}`);
  console.log(`  Senha:  ${DEMO_PASSWORD}`);
  console.log("");
}

main()
  .catch((error) => {
    console.error(error);
    process.exit(1);
  })
  .finally(() => prisma.$disconnect());
