import { PrismaClient } from "@nexora/recepcionista-prisma";

const prisma = new PrismaClient();

const HORARIOS_24H_ONLINE = [
  { day: 0, open: "00:00", close: "00:00", closed: true },
  { day: 1, open: "00:00", close: "00:00", closed: true },
  { day: 2, open: "00:00", close: "00:00", closed: true },
  { day: 3, open: "00:00", close: "00:00", closed: true },
  { day: 4, open: "00:00", close: "00:00", closed: true },
  { day: 5, open: "00:00", close: "00:00", closed: true },
  { day: 6, open: "00:00", close: "00:00", closed: true },
];

const PRESET_NEXORA = {
  nomeEmpresa: "Nexora",
  atendenteNome: "Sofia da Nexora",
  description:
    "Atendente Inteligente 24h no WhatsApp para pequenas empresas, clínicas e prestadores de serviços. Conduz o lead para testar gratuitamente por 7 dias em https://www.meunexora.com.br/ativar sem pedir cartão de crédito.",
  endereco: "Atendimento 100% online em todo o Brasil — www.meunexora.com.br",
  pagamento: "Pix e Cartão de Crédito",
  serviceRules: "⚡ Resposta imediata 24 horas por dia. 7 dias de teste grátis sem cartão.",
  servicos: [
    { name: "Plano Atendente 24h (Mensal)", durationMin: 15, priceCents: 9700 },
    { name: "Plano Completo Atendente + Resgate (Mensal)", durationMin: 15, priceCents: 19700 },
    { name: "Demonstração Gratuita de 7 Dias", durationMin: 15, priceCents: 0 },
  ],
  duvidas: [
    {
      question: "Oi! Vi o anúncio da Nexora e quero ver como ela atenderia na minha empresa.",
      answer:
        "Olá! 👋 Viu a velocidade dessa resposta? Se fossem 23h ou um domingo, seu cliente receberia essa mesma atenção na sua empresa. Qual é o ramo do seu negócio (ex: clínica, estética, barbearia, consultório, serviços)?",
    },
    {
      question: "Clínica",
      answer:
        "Clínicas e consultórios perdem até 40% das consultas fora do horário. Já deixei seu Atendente 100% pré-configurado com 7 dias grátis, sem pedir cartão: 👉 https://www.meunexora.com.br/ativar?ramo=clinica",
    },
    {
      question: "Barbearia",
      answer:
        "Salões e barbearias perdem muitos clientes que tentam agendar à noite. Já deixei seu Atendente 100% pré-configurado com 7 dias grátis, sem pedir cartão: 👉 https://www.meunexora.com.br/ativar?ramo=barbearia",
    },
    {
      question: "Estética",
      answer:
        "Espaços de estética perdem clientes toda semana que tentam agendar fora do expediente. Já deixei seu Atendente 100% pré-configurado com 7 dias grátis: 👉 https://www.meunexora.com.br/ativar?ramo=estetica",
    },
    {
      question: "Odontologia",
      answer:
        "Consultórios odontológicos perdem pacientes de alto valor fora do horário comercial. Já deixei seu Atendente pré-configurado com 7 dias grátis sem cartão: 👉 https://www.meunexora.com.br/ativar?ramo=odonto",
    },
    {
      question: "Consultório",
      answer:
        "Consultórios perdem muitos agendamentos fora do horário de atendimento. Já deixei seu Atendente 100% pré-configurado com 7 dias grátis, sem pedir cartão: 👉 https://www.meunexora.com.br/ativar?ramo=clinica",
    },
    {
      question: "Dentista",
      answer:
        "Consultórios odontológicos perdem pacientes de alto valor fora do expediente. Já deixei seu Atendente pré-configurado com 7 dias grátis sem cartão: 👉 https://www.meunexora.com.br/ativar?ramo=odonto",
    },
    {
      question: "Salão",
      answer:
        "Salões de beleza perdem agendamentos todos os dias fora do expediente. Já deixei seu Atendente 100% pré-configurado com 7 dias grátis, sem pedir cartão: 👉 https://www.meunexora.com.br/ativar?ramo=barbearia",
    },
    {
      question: "Pet shop",
      answer:
        "Pet shops e veterinárias perdem muitos clientes fora do horário. Já deixei seu Atendente 100% pré-configurado com 7 dias grátis, sem pedir cartão: 👉 https://www.meunexora.com.br/ativar?ramo=clinica",
    },
    {
      question: "Serviços",
      answer:
        "Empresas de serviços perdem orçamentos valiosos toda noite e fim de semana. Já deixei seu Atendente 100% pré-configurado com 7 dias grátis, sem pedir cartão: 👉 https://www.meunexora.com.br/ativar?ramo=servicos",
    },
    {
      question: "Quanto custa o plano?",
      answer:
        "A primeira semana é por nossa conta, 100% grátis e sem pedir cartão. Depois, o plano do Atendente 24h é apenas R$ 97/mês (no Pix ou Cartão), sem contrato e sem fidelidade.",
    },
    {
      question: "Como funciona o teste grátis?",
      answer:
        "Você ganha 7 dias de acesso completo para testar na prática com seus clientes. Não precisa cadastrar cartão de crédito. Você só decide se continua depois de ver os resultados.",
    },
    {
      question: "Como conecta no WhatsApp?",
      answer:
        "Leva menos de 1 minuto! Você conecta pelo celular digitando um código seguro de 8 dígitos ou pelo computador escaneando o QR Code, idêntico ao WhatsApp Web. Não precisa de computador ligado nem equipamentos caros.",
    },
    {
      question: "O atendente inventa respostas?",
      answer:
        "Não! A Nexora usa guardrails de contexto e proteção anti-alucinação. Ele só responde os preços, serviços e regras cadastrados. Se não souber algo, anota a pendência para você responder.",
    },
    {
      question: "Precisa de computador ligado?",
      answer:
        "Não precisa! A Nexora roda 100% em servidores em nuvem de alta velocidade. Seu WhatsApp fica atendendo 24 horas por dia mesmo com celular desligado ou sem bateria.",
    },
  ],
};

async function evoRequest(path, init = {}) {
  const baseUrl = (process.env.EVOLUTION_API_URL || "").replace(/\/+$/, "");
  const apiKey = process.env.EVOLUTION_API_KEY;
  if (!baseUrl || !apiKey) {
    throw new Error("EVOLUTION_API_URL ou EVOLUTION_API_KEY não configuradas");
  }

  const res = await fetch(`${baseUrl}${path}`, {
    method: init.method || "GET",
    headers: {
      "Content-Type": "application/json",
      apikey: apiKey,
    },
    body: init.body ? JSON.stringify(init.body) : undefined,
  });

  const text = await res.text().catch(() => "");
  try {
    return text ? JSON.parse(text) : {};
  } catch {
    return { raw: text };
  }
}

async function main() {
  console.log("=== CONFIGURANDO CONTA OFICIAL DA NEXORA NO BANCO ===");

  // 1. Encontra ou cria a empresa Nexora
  let company = await prisma.company.findFirst({
    where: {
      OR: [
        { name: "Nexora" },
        { slug: "nexora" },
        { phone: "5521966106737" },
        { email: "contato@meunexora.com.br" },
      ],
    },
  });

  if (!company) {
    // Procura a primeira empresa convidada para transformá-la ou cria uma nova
    const primeira = await prisma.company.findFirst({
      orderBy: { createdAt: "desc" },
    });

    if (primeira) {
      console.log(`Usando empresa existente (ID: ${primeira.id}) para converter na oficial Nexora`);
      company = await prisma.company.update({
        where: { id: primeira.id },
        data: {
          name: "Nexora",
          slug: "nexora",
          email: "contato@meunexora.com.br",
          phone: "5521966106737",
          subscriptionStatus: "active",
        },
      });
    } else {
      console.log("Criando nova empresa oficial Nexora...");
      company = await prisma.company.create({
        data: {
          name: "Nexora",
          slug: "nexora",
          email: "contato@meunexora.com.br",
          phone: "5521966106737",
          subscriptionStatus: "active",
        },
      });
    }
  } else {
    console.log(`Empresa Nexora já localizada (ID: ${company.id}). Atualizando dados principais...`);
    company = await prisma.company.update({
      where: { id: company.id },
      data: {
        name: "Nexora",
        slug: "nexora",
        phone: "5521966106737",
        subscriptionStatus: "active",
      },
    });
  }

  const agora = new Date();
  const instanceName = `nexora-${company.id}`;

  // 2. Atualiza perfil da empresa
  await prisma.companyProfile.upsert({
    where: { companyId: company.id },
    create: {
      companyId: company.id,
      atendenteNome: PRESET_NEXORA.atendenteNome,
      atendenteJeito: "ACOLHEDOR",
      plantaoAtivo: true,
      atendenteExpediente: true,
      atendenteLigadoPrimeiraVezEm: agora,
      atendenteTestadoEm: agora,
      description: PRESET_NEXORA.description,
      address: PRESET_NEXORA.endereco,
      paymentMethods: PRESET_NEXORA.pagamento,
      serviceRules: PRESET_NEXORA.serviceRules,
      businessHours: HORARIOS_24H_ONLINE,
      whatsappInstance: instanceName,
    },
    update: {
      atendenteNome: PRESET_NEXORA.atendenteNome,
      atendenteJeito: "ACOLHEDOR",
      plantaoAtivo: true,
      atendenteExpediente: true,
      atendenteLigadoPrimeiraVezEm: agora,
      atendenteTestadoEm: agora,
      description: PRESET_NEXORA.description,
      address: PRESET_NEXORA.endereco,
      paymentMethods: PRESET_NEXORA.pagamento,
      serviceRules: PRESET_NEXORA.serviceRules,
      businessHours: HORARIOS_24H_ONLINE,
      whatsappInstance: instanceName,
    },
  });

  console.log("✔ Perfil e horários 24h configurados com sucesso.");

  // 3. Cadastra os planos/serviços oficiais
  await prisma.service.deleteMany({ where: { companyId: company.id } });
  await prisma.service.createMany({
    data: PRESET_NEXORA.servicos.map((s, idx) => ({
      companyId: company.id,
      name: s.name,
      durationMin: s.durationMin,
      priceCents: s.priceCents,
      order: idx,
      active: true,
    })),
  });
  console.log(`✔ ${PRESET_NEXORA.servicos.length} Planos cadastrados.`);

  // 4. Cadastra todas as perguntas do funil
  for (const d of PRESET_NEXORA.duvidas) {
    const jaTem = await prisma.knowledgeItem.findFirst({
      where: { companyId: company.id, question: d.question },
    });
    if (!jaTem) {
      await prisma.knowledgeItem.create({
        data: {
          companyId: company.id,
          question: d.question,
          answer: d.answer,
          source: "TRAINING",
          status: "APPROVED",
          approvedAt: agora,
        },
      });
    } else {
      await prisma.knowledgeItem.update({
        where: { id: jaTem.id },
        data: { answer: d.answer, status: "APPROVED", approvedAt: agora },
      });
    }
  }
  console.log(`✔ ${PRESET_NEXORA.duvidas.length} Regras e respostas do funil configuradas.`);

  // 5. Configura a Evolution API
  console.log(`\nConfigurando Evolution API para a instância "${instanceName}"...`);
  try {
    // 5.1 Cria instância se não existir
    await evoRequest("/instance/create", {
      method: "POST",
      body: { instanceName, qrcode: true, integration: "WHATSAPP-BAILEYS" },
    }).catch(() => {});

    // 5.2 Configura Webhook
    const appUrl = (process.env.APP_URL || "https://www.meunexora.com.br").replace(/\/+$/, "");
    const token = process.env.WEBHOOK_TOKEN;
    const webhookUrl = token
      ? `${appUrl}/api/webhook/whatsapp?token=${encodeURIComponent(token)}`
      : `${appUrl}/api/webhook/whatsapp`;

    await evoRequest(`/webhook/set/${encodeURIComponent(instanceName)}`, {
      method: "POST",
      body: {
        webhook: {
          enabled: true,
          url: webhookUrl,
          byEvents: false,
          base64: true,
          events: ["MESSAGES_UPSERT", "CONNECTION_UPDATE", "QRCODE_UPDATED"],
        },
      },
    });
    console.log(`✔ Webhook configurado: ${webhookUrl}`);

    // 5.3 Gera Pairing Code e QR Code
    const connectRes = await evoRequest(
      `/instance/connect/${encodeURIComponent(instanceName)}?number=5521966106737`
    );

    console.log("\n========================================================");
    console.log("       RESULTADO DA CONEXÃO DO WHATSAPP DA NEXORA       ");
    console.log("========================================================");
    console.log("Instância:", instanceName);
    console.log("Telefone eSIM:", "5521966106737");

    if (connectRes.pairingCode || connectRes.code) {
      const code = (connectRes.pairingCode || connectRes.code || "").toUpperCase();
      console.log("\n🔑 CÓDIGO DE PAREAMENTO (DIGITE NO WHATSAPP):", code);
      console.log("👉 No WhatsApp do celular: Aparelhos Conectados > Conectar um aparelho > Conectar com número de telefone > Digite o código acima!");
    }

    if (connectRes.base64 || connectRes.qrcode?.base64) {
      const qr = connectRes.base64 || connectRes.qrcode?.base64;
      console.log("\n📱 QR Code gerado e disponível (data:image)");
      await prisma.companyProfile.update({
        where: { companyId: company.id },
        data: {
          whatsappStatus: "WAITING_QR",
          whatsappQrCode: qr,
        },
      });
    }

    if (connectRes.instance?.state === "open") {
      console.log("\n🎉 WhatsApp JÁ ESTÁ CONECTADO E ONLINE!");
      await prisma.companyProfile.update({
        where: { companyId: company.id },
        data: {
          whatsappStatus: "CONNECTED",
          whatsappConnectedAt: agora,
        },
      });
    }

    console.log("========================================================\n");
  } catch (evoErr) {
    console.error("Aviso ao contatar Evolution:", evoErr.message || evoErr);
  }

  console.log("✔ TODA A CONFIGURAÇÃO DO FUNIL ABSURDO ESTÁ CONCLUÍDA!");
}

main()
  .catch((e) => {
    console.error("Erro fatal:", e);
    process.exit(1);
  })
  .finally(() => prisma.$disconnect());
