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
        { name: "Limpeza Dental", durationMin: 40, priceCents: 15000 },
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
        { name: "Consulta", durationMin: 30, priceCents: 20000 },
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
        { name: "Limpeza de Pele Profunda", durationMin: 60, priceCents: 18000 },
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
        { name: "Corte de Cabelo", durationMin: 30, priceCents: 4500 },
        { name: "Barba Completa", durationMin: 30, priceCents: 3500 },
        { name: "Combo Corte + Barba", durationMin: 50, priceCents: 7500 },
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
