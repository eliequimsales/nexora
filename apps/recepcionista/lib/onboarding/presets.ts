/**
 * PRESETS INTELIGENTES DE NICHO — ZERO FRICÇÃO NO ONBOARDING.
 *
 * Quando o empresário informa seu ramo (no WhatsApp ou no link /ativar?ramo=...),
 * o atendente já nasce 100% pré-configurado com serviços, preços de referência,
 * formas de pagamento e dúvidas frequentes do seu próprio segmento.
 *
 * Isso elimina completamente formulários chatos e a sensação de "está tudo vazio".
 */

export type PresetNicho = {
  nomeEmpresa: string;
  atendenteNome: string;
  description: string;
  endereco: string;
  pagamento: string;
  serviceRules: string;
  servicos: { name: string; durationMin: number; priceCents: number }[];
  duvidas: { question: string; answer: string }[];
};

export function obterPresetDoRamo(ramoOuTexto?: string | null): PresetNicho {
  const limpo = (ramoOuTexto || "")
    .toLowerCase()
    .normalize("NFD")
    .replace(/\p{M}/gu, "");

  // 0. Nexora Tecnologia (Comercial / Demonstração)
  if (/nexora/i.test(limpo)) {
    return {
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
  }

  // 1. Odontologia e Consultórios Dentários
  if (/odonto|dentist|dente/i.test(limpo)) {
    return {
      nomeEmpresa: "Consultório Odontológico",
      atendenteNome: "Consultório",
      description: "Atendimento odontológico com agendamento rápido",
      endereco: "Atendimento com hora marcada",
      pagamento: "Pix, Cartão de Crédito e Débito",
      serviceRules: "⏱️ Tolerância de atraso: 15 minutos",
      servicos: [
        { name: "Consulta e Avaliação", durationMin: 30, priceCents: 0 },
        { name: "Limpeza Dental", durationMin: 40, priceCents: 0 },
      ],
      duvidas: [
        {
          question: "Como funciona a avaliação?",
          answer: "Na avaliação examinamos sua necessidade e apresentamos o plano ideal de tratamento com valores e prazos.",
        },
      ],
    };
  }

  // 2. Clínicas Médicas e Profissionais da Saúde
  if (/clinica|medic|saude|fisio|psico|doutor|terapia|hospital/i.test(limpo)) {
    return {
      nomeEmpresa: "Clínica Médica",
      atendenteNome: "Clínica Médica",
      description: "Consultas e atendimentos na área da saúde",
      endereco: "Atendimento com hora marcada",
      pagamento: "Pix, Cartão de Crédito e Débito",
      serviceRules: "⏱️ Tolerância de atraso: 15 minutos",
      servicos: [
        { name: "Consulta", durationMin: 30, priceCents: 0 },
        { name: "Retorno", durationMin: 20, priceCents: 0 },
      ],
      duvidas: [
        {
          question: "Como funciona o agendamento?",
          answer: "Realizamos atendimento pontual com hora marcada. Basta me dizer o melhor dia e horário para sua consulta!",
        },
      ],
    };
  }

  // 3. Estética, Beleza, Salão e Spa
  if (/estetica|beleza|salao|sobrancelha|cilios|unha|manicure|spa|massagem|depila/i.test(limpo)) {
    return {
      nomeEmpresa: "Espaço de Estética",
      atendenteNome: "Espaço de Estética",
      description: "Procedimentos estéticos e cuidados corporais",
      endereco: "Atendimento com hora marcada",
      pagamento: "Pix, Cartão e Débito",
      serviceRules: "⏱️ Tolerância de atraso: 15 minutos",
      servicos: [
        { name: "Avaliação Estética", durationMin: 30, priceCents: 0 },
        { name: "Limpeza de Pele Profunda", durationMin: 60, priceCents: 0 },
      ],
      duvidas: [
        {
          question: "Preciso agendar com antecedência?",
          answer: "Sim! Agendando com antecedência garantimos seu horário reservado com total exclusividade.",
        },
      ],
    };
  }

  // 4. Barbearias e Cuidados Masculinos
  if (/barbe|barba|corte|cabel/i.test(limpo)) {
    return {
      nomeEmpresa: "Barbearia",
      atendenteNome: "Barbearia",
      description: "Cortes modernos, barba e estilo masculino",
      endereco: "Atendimento com hora marcada ou por ordem de chegada",
      pagamento: "Pix, Cartão e Dinheiro",
      serviceRules: "⏱️ Tolerância de atraso: 15 minutos",
      servicos: [
        { name: "Corte de Cabelo", durationMin: 30, priceCents: 0 },
        { name: "Barba Completa", durationMin: 30, priceCents: 0 },
        { name: "Combo Corte + Barba", durationMin: 50, priceCents: 0 },
      ],
      duvidas: [
        {
          question: "Atendem com hora marcada?",
          answer: "Sim! Reservando por aqui você não pega fila e é atendido no horário marcado.",
        },
      ],
    };
  }

  // 5. Advocacia e Escritórios Jurídicos
  if (/advoc|jurid|direito/i.test(limpo)) {
    return {
      nomeEmpresa: "Advocacia e Consultoria",
      atendenteNome: "Advocacia",
      description: "Assessoria e consultoria jurídica especializada",
      endereco: "Atendimento presencial e online",
      pagamento: "Pix, Boleto e Cartão",
      serviceRules: "Atendimento com horário agendado",
      servicos: [
        { name: "Consulta Jurídica", durationMin: 45, priceCents: 0 },
      ],
      duvidas: [
        {
          question: "O atendimento pode ser online?",
          answer: "Sim! Atendemos presencialmente no escritório e também por videochamada conforme sua preferência.",
        },
      ],
    };
  }

  // 6. Consultoria, Finanças e Contabilidade
  if (/consultor|agencia|contabil|financeir/i.test(limpo)) {
    return {
      nomeEmpresa: "Consultoria",
      atendenteNome: "Consultoria",
      description: "Consultoria estratégica e atendimento empresarial",
      endereco: "Atendimento online e presencial",
      pagamento: "Pix e Transferência",
      serviceRules: "Atendimento com horário agendado",
      servicos: [
        { name: "Reunião de Diagnóstico", durationMin: 45, priceCents: 0 },
      ],
      duvidas: [
        {
          question: "Como agendar?",
          answer: "Basta me informar seu dia e horário de preferência que agendamos sua reunião!",
        },
      ],
    };
  }

  // 7. Padrão Universal Acolhedor
  return {
    nomeEmpresa: "Minha Empresa",
    atendenteNome: "Atendente Virtual",
    description: "Atendimento rápido e agendamentos",
    endereco: "Atendimento com hora marcada",
    pagamento: "Pix, Cartão de Crédito e Débito",
    serviceRules: "⏱️ Tolerância de atraso: 15 minutos",
    servicos: [
      { name: "Atendimento e Agendamento", durationMin: 30, priceCents: 0 },
    ],
    duvidas: [
      {
        question: "Como funciona o agendamento?",
        answer: "Nosso agendamento é rápido e automático por aqui. Basta me dizer o melhor dia e horário para você!",
      },
    ],
  };
}
