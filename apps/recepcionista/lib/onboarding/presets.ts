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
        "Atendente Inteligente 24h no WhatsApp para pequenas empresas, clínicas e prestadores de serviços. Conduz o lead para testar gratuitamente por 7 dias em meunexora.com.br/ativar sem pedir cartão de crédito.",
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
            "Viu a velocidade dessa resposta? Se fossem 23h ou um domingo, seu cliente receberia essa mesma atenção na sua empresa.\n\nQual o ramo do seu negócio?",
        },
        {
          question: "Clínica",
          answer:
            "Clínicas e consultórios perdem até 40% das consultas fora do horário. Já deixei seu Atendente 100% pré-configurado com 7 dias grátis, sem pedir cartão: 👉 meunexora.com.br/ativar/clinica",
        },
        {
          question: "Barbearia",
          answer:
            "Salões e barbearias perdem muitos clientes que tentam agendar à noite. Já deixei seu Atendente 100% pré-configurado com 7 dias grátis, sem pedir cartão: 👉 meunexora.com.br/ativar/barbearia",
        },
        {
          question: "Estética",
          answer:
            "Espaços de estética perdem clientes toda semana que tentam agendar fora do expediente. Já deixei seu Atendente 100% pré-configurado com 7 dias grátis: 👉 meunexora.com.br/ativar/estetica",
        },
        {
          question: "Odontologia",
          answer:
            "Consultórios odontológicos perdem pacientes de alto valor fora do horário comercial. Já deixei seu Atendente pré-configurado com 7 dias grátis sem cartão: 👉 meunexora.com.br/ativar/odonto",
        },
        {
          question: "Consultório",
          answer:
            "Consultórios perdem muitos agendamentos fora do horário de atendimento. Já deixei seu Atendente 100% pré-configurado com 7 dias grátis, sem pedir cartão: 👉 meunexora.com.br/ativar/clinica",
        },
        {
          question: "Dentista",
          answer:
            "Consultórios odontológicos perdem pacientes de alto valor fora do expediente. Já deixei seu Atendente pré-configurado com 7 dias grátis sem cartão: 👉 meunexora.com.br/ativar/odonto",
        },
        {
          question: "Salão",
          answer:
            "Salões de beleza perdem agendamentos todos os dias fora do expediente. Já deixei seu Atendente 100% pré-configurado com 7 dias grátis, sem pedir cartão: 👉 meunexora.com.br/ativar/salao",
        },
        {
          question: "Pet shop",
          answer:
            "Pet shops e veterinárias perdem muitos clientes fora do horário. Já deixei seu Atendente 100% pré-configurado com 7 dias grátis, sem pedir cartão: 👉 meunexora.com.br/ativar/pet",
        },
        {
          question: "Serviços",
          answer:
            "Empresas de serviços perdem orçamentos valiosos toda noite e fim de semana. Já deixei seu Atendente 100% pré-configurado com 7 dias grátis, sem pedir cartão: 👉 meunexora.com.br/ativar/servicos",
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

  // 7. Pet Shop e Clínicas Veterinárias
  if (/pet|veterin|banho|tosa|hotel\s*pet|creche\s*pet/i.test(limpo)) {
    return {
      nomeEmpresa: "Pet Shop e Veterinária",
      atendenteNome: "Pet Shop",
      description: "Cuidados, banho, tosa e atendimento veterinário",
      endereco: "Atendimento presencial e com hora marcada",
      pagamento: "Pix, Cartão de Crédito e Débito",
      serviceRules: "⏱️ Tolerância de atraso: 15 minutos",
      servicos: [
        { name: "Banho e Tosa", durationMin: 60, priceCents: 0 },
        { name: "Consulta Veterinária", durationMin: 30, priceCents: 0 },
      ],
      duvidas: [
        {
          question: "Como funciona o agendamento de banho e tosa?",
          answer: "Agendamos o melhor horário para trazer seu pet com total conforto e pontualidade!",
        },
      ],
    };
  }

  // 8. Oficinas e Centros Automotivos
  if (/mecanic|oficin|auto\s*center|centro\s*automotivo|funilar|lava\s*jato|lava\s*rapido|pneu|borrachari/i.test(limpo)) {
    return {
      nomeEmpresa: "Centro Automotivo",
      atendenteNome: "Centro Automotivo",
      description: "Manutenção mecânica, revisão e cuidados automotivos",
      endereco: "Atendimento presencial com agendamento",
      pagamento: "Pix e Cartão de Crédito",
      serviceRules: "Orçamentos e diagnósticos com hora marcada",
      servicos: [
        { name: "Revisão Geral e Diagnóstico", durationMin: 60, priceCents: 0 },
        { name: "Troca de Óleo e Filtros", durationMin: 30, priceCents: 0 },
      ],
      duvidas: [
        {
          question: "Como funciona o orçamento?",
          answer: "Avaliamos seu veículo na data marcada e passamos o orçamento transparente antes de qualquer serviço.",
        },
      ],
    };
  }

  // 9. Fitness, Academias e Personal Trainer
  if (/academia|personal|crossfit|pilates|funcional|treino|natacao|luta/i.test(limpo)) {
    return {
      nomeEmpresa: "Studio Fitness",
      atendenteNome: "Studio Fitness",
      description: "Treinos, acompanhamento físico e saúde",
      endereco: "Atendimento presencial com hora marcada",
      pagamento: "Pix e Cartão de Crédito",
      serviceRules: "Agendamento de aulas e avaliações",
      servicos: [
        { name: "Aula Experimental Gratuita", durationMin: 50, priceCents: 0 },
        { name: "Avaliação Física Inicial", durationMin: 40, priceCents: 0 },
      ],
      duvidas: [
        {
          question: "Como funciona a aula experimental?",
          answer: "Você pode agendar um horário para conhecer o espaço e fazer um treino sem compromisso!",
        },
      ],
    };
  }

  // 10. Imobiliárias e Corretores de Imóveis
  if (/imobiliari|corretor|imovel|imoveis/i.test(limpo)) {
    return {
      nomeEmpresa: "Imobiliária",
      atendenteNome: "Imobiliária",
      description: "Intermediação imobiliária, locação e vendas",
      endereco: "Atendimento presencial e visitas agendadas",
      pagamento: "Pix, Boleto e Transferência",
      serviceRules: "Visitas acompanhadas com agendamento prévio",
      servicos: [
        { name: "Agendamento de Visita ao Imóvel", durationMin: 45, priceCents: 0 },
        { name: "Atendimento com Corretor", durationMin: 30, priceCents: 0 },
      ],
      duvidas: [
        {
          question: "Como agendar uma visita?",
          answer: "Basta me informar o imóvel de interesse e seu horário disponível para agendarmos com o corretor!",
        },
      ],
    };
  }

  // 11. Estúdios de Tatuagem e Piercing
  if (/tatuag|tattoo|piercing/i.test(limpo)) {
    return {
      nomeEmpresa: "Studio de Tattoo",
      atendenteNome: "Studio de Tattoo",
      description: "Tatuagens autorais, coberturas e body piercing",
      endereco: "Atendimento exclusivo com hora marcada",
      pagamento: "Pix e Cartão de Crédito",
      serviceRules: "Materiais 100% descartáveis e esterilizados",
      servicos: [
        { name: "Orçamento e Criação de Arte", durationMin: 30, priceCents: 0 },
        { name: "Aplicação de Piercing", durationMin: 30, priceCents: 0 },
      ],
      duvidas: [
        {
          question: "Como faço para orçar uma tatuagem?",
          answer: "Você pode me enviar a ideia, o tamanho aproximado em centímetros e o local do corpo para calcularmos o valor!",
        },
      ],
    };
  }

  // 12. Fotografia, Filmagem e Eventos
  if (/fotograf|filmagem|evento|buffet|cerimonial/i.test(limpo)) {
    return {
      nomeEmpresa: "Estúdio de Fotografia e Eventos",
      atendenteNome: "Estúdio de Fotografia",
      description: "Ensaios fotográficos, coberturas de eventos e produções",
      endereco: "Atendimento em estúdio ou externa com hora marcada",
      pagamento: "Pix e Cartão de Crédito",
      serviceRules: "Agendamento prévio com confirmação",
      servicos: [
        { name: "Ensaio Fotográfico", durationMin: 60, priceCents: 0 },
        { name: "Reunião de Orçamento para Evento", durationMin: 40, priceCents: 0 },
      ],
      duvidas: [
        {
          question: "Como funciona o agendamento de ensaios?",
          answer: "Reservamos a data exclusiva para o seu ensaio. Me diga qual estilo de foto você busca!",
        },
      ],
    };
  }

  // 13. Manutenção, Ar Condicionado, Vidraçaria, Marcenaria e Reformas
  if (/ar\s*condicionado|refrigerac|climatizac|eletricist|encanador|vidracar|marcenar|serralher|pintor|reforma|energia\s*solar|manutencao/i.test(limpo)) {
    return {
      nomeEmpresa: "Serviços e Manutenção",
      atendenteNome: "Serviços e Manutenção",
      description: "Instalação, reparos especializados e orçamentos",
      endereco: "Atendimento no local com visita agendada",
      pagamento: "Pix, Cartão e Boleto",
      serviceRules: "Visitas técnicas pontuais com garantia de serviço",
      servicos: [
        { name: "Visita Técnica e Orçamento", durationMin: 45, priceCents: 0 },
        { name: "Manutenção Preventiva", durationMin: 60, priceCents: 0 },
      ],
      duvidas: [
        {
          question: "Como funciona a visita técnica?",
          answer: "Agendamos o melhor dia e horário para um profissional ir até o seu local fazer o diagnóstico e orçamento.",
        },
      ],
    };
  }

  // 14. Padrão Universal Inteligente
  const nomeCustom = ramoOuTexto
    ? ramoOuTexto
        .trim()
        .split(/[\s_-]+/)
        .map((w) => w.charAt(0).toUpperCase() + w.slice(1).toLowerCase())
        .join(" ")
    : "Minha Empresa";

  return {
    nomeEmpresa: nomeCustom.length <= 40 ? nomeCustom : "Minha Empresa",
    atendenteNome: "Atendente Virtual",
    description: `Atendimento rápido e agendamentos para ${ramoOuTexto ? ramoOuTexto.trim() : "clientes"}`,
    endereco: "Atendimento com hora marcada",
    pagamento: "Pix, Cartão de Crédito e Débito",
    serviceRules: "⏱️ Tolerância de atraso: 15 minutos",
    servicos: [
      { name: "Atendimento e Agendamento", durationMin: 30, priceCents: 0 },
      { name: "Orçamento Personalizado", durationMin: 30, priceCents: 0 },
    ],
    duvidas: [
      {
        question: "Como funciona o agendamento?",
        answer: "Nosso agendamento é rápido e automático por aqui. Basta me dizer o melhor dia e horário para você!",
      },
    ],
  };
}
