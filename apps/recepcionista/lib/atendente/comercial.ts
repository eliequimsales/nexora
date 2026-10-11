import type { EntradaDoMotor, SaidaDoMotor } from "./motor";
import { URL_ATIVACAO } from "./comercial-config";

export type RamoDetectado =
  | "odonto"
  | "estetica"
  | "barbearia"
  | "clinica"
  | "advocacia"
  | "consultoria"
  | "servicos";

function normalizarTexto(txt: string): string {
  return (txt || "")
    .toLowerCase()
    .normalize("NFD")
    .replace(/\p{M}/gu, "")
    .replace(/[^a-z0-9\s]/g, " ")
    .replace(/\s+/g, " ")
    .trim();
}

export function detectarRamo(texto: string): RamoDetectado | null {
  const t = normalizarTexto(texto);

  // 1. Odontologia (específico, antes de clínica geral)
  if (/\b(odonto\w*|dentist\w*|ortodont\w*)\b/.test(t)) {
    return "odonto";
  }

  // 2. Estética (específico, antes de clínica geral)
  if (
    /\b(estetic\w*|espaco de beleza|centro de estetica|depilac\w*|harmonizac\w*|bronzeament\w*|massag\w*|spa\b)/.test(
      t,
    )
  ) {
    return "estetica";
  }

  // 3. Barbearia, Cabelo e Beleza
  if (
    /\b(barbeari\w*|barbeir\w*|salao|saloes|cabeleireir\w*|cortes?|hair\b|lash\b|sobrancelh\w*|manicur\w*|unhas?|pedicur\w*|podologi\w*|micropigmentac\w*|tatuad\w*|tatuag\w*|tattoo\w*)/.test(
      t,
    )
  ) {
    return "barbearia";
  }

  // 4. Advocacia / Jurídico
  if (
    /\b(advocaci\w*|advogad\w*|juridic\w*|direito\b|escritorio de advocacia)/.test(
      t,
    )
  ) {
    return "advocacia";
  }

  // 5. Consultoria / Gestão / Serviços B2B (consultoria, agência, etc.)
  if (
    /\b(consultori\w*|consultor\w*|agenci\w*|contabil\w*|contador\w*|imobiliari\w*|corretor\w*|personal\b|coach\w*)/.test(
      t,
    )
  ) {
    return "consultoria";
  }

  // 6. Clínica geral / Saúde / Consultório médico (consultorio médico, odonto, etc.)
  if (
    /\b(clinic\w*|consultorio\w*|medic\w*|saude\b|fisioterapi\w*|fisio\b|psicolog\w*|nutric\w*|pediatr\w*|dermatolog\w*|terapeut\w*|hospital\w*)/.test(
      t,
    )
  ) {
    return "clinica";
  }

  // 7. Outros ramos (serviços gerais)
  if (
    /\b(mecanic\w*|oficin\w*|auto\b|pet\b|veterinari\w*|petshop|loj\w*|comerci\w*|restaurant\w*|pizzari\w*|delivery|academi\w*|curs\w*|escol\w*|assistenci\w*|repar\w*|event\w*|fotografi\w*|energia solar)/.test(
      t,
    )
  ) {
    return "servicos";
  }

  return null;
}

export function detectarRamoNoHistorico(historico: { content: string }[]): RamoDetectado | null {
  for (let i = historico.length - 1; i >= 0; i--) {
    const ramo = detectarRamo(historico[i].content);
    if (ramo) return ramo;
  }
  return null;
}

const COPIAS_POR_RAMO: Record<RamoDetectado, { dor: string; link: string }> = {
  clinica: {
    dor: "Clínicas e consultórios perdem até 40% das consultas fora do horário comercial porque o paciente não espera até o dia seguinte.",
    link: `${URL_ATIVACAO}?ramo=clinica`,
  },
  odonto: {
    dor: "Consultórios odontológicos perdem pacientes de alto valor fora do horário comercial quando não respondem na hora.",
    link: `${URL_ATIVACAO}?ramo=odonto`,
  },
  barbearia: {
    dor: "Salões e barbearias perdem muitos clientes que tentam agendar à noite e no fim de semana.",
    link: `${URL_ATIVACAO}?ramo=barbearia`,
  },
  estetica: {
    dor: "Espaços de estética e beleza perdem agendamentos toda semana para concorrentes que respondem primeiro.",
    link: `${URL_ATIVACAO}?ramo=estetica`,
  },
  advocacia: {
    dor: "Escritórios de advocacia perdem clientes que precisam de retorno rápido no primeiro contato para fechar contrato.",
    link: `${URL_ATIVACAO}?ramo=advocacia`,
  },
  consultoria: {
    dor: "Empresas e consultorias perdem oportunidades valiosas quando o lead esfria esperando resposta.",
    link: `${URL_ATIVACAO}?ramo=consultoria`,
  },
  servicos: {
    dor: "Empresas de serviços perdem orçamentos valiosos toda noite e fim de semana. Quem responde primeiro fecha a venda.",
    link: `${URL_ATIVACAO}?ramo=servicos`,
  },
};

export async function responderComercial(e: EntradaDoMotor): Promise<SaidaDoMotor> {
  const t = normalizarTexto(e.texto);
  const ramoAtual = detectarRamo(e.texto);
  const ramoHistorico = ramoAtual || detectarRamoNoHistorico(e.historico);

  const querHumano =
    /\b(falar com pessoa|atendente humano|pessoa real|falar com alguem|falar com atendente|suporte humano|atendimento humano)\b/.test(
      t,
    );
  if (querHumano) {
    return {
      mensagens: [
        "Com certeza! Já notifiquei nossa equipe e um especialista vai te atender por aqui em instantes.\n\n" +
          "Enquanto isso, se quiser adiantar e ver seu atendente funcionando na prática com 7 dias grátis por nossa conta, você já pode acessar:\n" +
          `👉 ${URL_ATIVACAO}`,
      ],
      estado: null,
      equipe: true,
      fontes: ["Transição humanizada para equipe comercial"],
      usouIa: false,
    };
  }

  const perguntouPreco =
    /\b(preco|precos|quanto custa|quanto e|qual o valor|qual valor|tabela|planos|plano|mensalidade|investimento|r\$|reais)\b/.test(
      t,
    );

  // Nicho + Preço juntos na mesma mensagem
  if (ramoAtual && perguntouPreco) {
    const config = COPIAS_POR_RAMO[ramoAtual];
    return {
      mensagens: [
        `${config.dor}\n\n` +
          "A primeira semana é 100% por nossa conta — grátis e sem pedir cartão de crédito para você ver o resultado na prática com seus clientes. Depois fica apenas R$ 97/mês (no Pix ou Cartão), sem contrato e sem fidelidade.\n\n" +
          `Já deixei seu modelo 100% pré-configurado para ativar agora:\n👉 ${config.link}`,
      ],
      estado: null,
      fontes: ["Oferta comercial personalizada com inversão de risco"],
      usouIa: false,
    };
  }

  // Preço isolado
  if (perguntouPreco) {
    if (ramoHistorico) {
      const config = COPIAS_POR_RAMO[ramoHistorico];
      return {
        mensagens: [
          "A primeira semana é 100% por nossa conta — grátis e sem pedir cartão de crédito. Você testa com seus clientes na prática e só decide se quer continuar depois de ver o resultado.\n\n" +
            "Depois, o plano é super acessível, apenas R$ 97/mês (no Pix ou Cartão), sem contrato e sem fidelidade.\n\n" +
            `Já deixei seu modelo pré-configurado para você ativar agora:\n👉 ${config.link}`,
        ],
        estado: null,
        fontes: ["Oferta comercial transparente com inversão de risco"],
        usouIa: false,
      };
    }

    return {
      mensagens: [
        "A primeira semana é 100% por nossa conta — grátis e sem pedir cartão de crédito. Você testa com seus clientes na prática e só decide se quer continuar depois de ver o resultado.\n\n" +
          "Depois, o plano é super acessível, apenas R$ 97/mês (no Pix ou Cartão), sem contrato e sem fidelidade.\n\n" +
          "Me conta: qual é o ramo da sua empresa para eu já liberar seu modelo pronto?",
      ],
      estado: null,
      fontes: ["Oferta comercial com convite ao nicho"],
      usouIa: false,
    };
  }

  // Se o lead informou o nicho
  if (ramoAtual) {
    const config = COPIAS_POR_RAMO[ramoAtual];
    return {
      mensagens: [
        `${config.dor}\n\n` +
          "Já deixei seu Atendente 100% pré-configurado com 7 dias grátis por nossa conta, sem pedir cartão:\n" +
          `👉 ${config.link}`,
      ],
      estado: null,
      fontes: ["Gancho de conversão específico por nicho"],
      usouIa: false,
    };
  }

  // Dúvida: Computador ligado / Nuvem
  if (
    /\b(computador ligado|pc ligado|deixar o computador|nuvem|celular ligado|celular conectado|desligado|funciona desligado)\b/.test(
      t,
    )
  ) {
    const link = ramoHistorico ? COPIAS_POR_RAMO[ramoHistorico].link : URL_ATIVACAO;
    return {
      mensagens: [
        "Não precisa deixar o computador ligado nem o celular conectado! O Nexora roda 100% em nuvem 24 horas por dia. Você pode desligar tudo que ele continua atendendo e agendando normalmente.\n\n" +
          "Quer ver funcionando no seu ramo? É só me falar qual é o seu tipo de negócio ou ativar seu teste grátis aqui:\n" +
          `👉 ${link}`,
      ],
      estado: null,
      fontes: ["Esclarecimento de infraestrutura em nuvem"],
      usouIa: false,
    };
  }

  // Dúvida: IA erra / Alucinação
  if (
    /\b(erra|errar|inventar|alucin|se ele falar|confiavel|inteligencia erra|ia erra|resposta errada)\b/.test(
      t,
    )
  ) {
    return {
      mensagens: [
        "Essa é a melhor parte: ela é blindada contra invenções. O atendente só responde estritamente o que você ensina nas suas regras, serviços e horários. Se alguém fizer uma pergunta fora do cadastro, ele anota e te avisa no painel sem inventar nada.\n\n" +
          "Qual é o ramo da sua empresa? Já deixo configurado para você testar na prática!",
      ],
      estado: null,
      fontes: ["Blindagem contra alucinações"],
      usouIa: false,
    };
  }

  // Dúvida: Chip novo / WhatsApp Business / Número
  if (
    /\b(chip|numero novo|outro numero|business|outro whatsapp|perco meu numero|perder meu numero)\b/.test(
      t,
    )
  ) {
    return {
      mensagens: [
        "Não precisa de chip novo nem de número extra! Você conecta o seu WhatsApp atual mesmo em 30 segundos pelo QR Code, sem perder suas conversas e sem burocracia.\n\n" +
          "Qual é o ramo da sua empresa para eu já liberar seu acesso?",
      ],
      estado: null,
      fontes: ["Conexão direta com número atual"],
      usouIa: false,
    };
  }

  // Dúvida: Como funciona o teste grátis / Cartão
  if (
    /\b(teste gratis|como funciona o teste|pede cartao|cartao de credito|pegadinha|fidelidade)\b/.test(
      t,
    )
  ) {
    const link = ramoHistorico ? COPIAS_POR_RAMO[ramoHistorico].link : URL_ATIVACAO;
    return {
      mensagens: [
        "São 7 dias completos com todas as funções liberadas, 100% grátis e sem pedir cartão de crédito. Você conecta e seu atendente já começa a rodar hoje mesmo.\n\n" +
          "Me diz qual é o ramo do seu negócio ou acesse direto para ver pronto:\n" +
          `👉 ${link}`,
      ],
      estado: null,
      fontes: ["Condições transparentes do teste de 7 dias"],
      usouIa: false,
    };
  }

  // Dúvida: Como conecta / QR Code / Instalação
  if (
    /\b(conect\w*|instal\w*|pareament\w*|parear|qr\s*code|codigo de pareamento)\b/.test(
      t,
    )
  ) {
    const link = ramoHistorico ? COPIAS_POR_RAMO[ramoHistorico].link : URL_ATIVACAO;
    return {
      mensagens: [
        "É super simples e leva menos de 1 minuto: você entra no link, a tela já abre pré-configurada pro seu ramo, você testa uma mensagem no simulador e conecta seu WhatsApp escaneando o QR Code (ou com código de 8 dígitos).\n\n" +
          "Você pode testar agora mesmo com 7 dias grátis por nossa conta:\n" +
          `👉 ${link}`,
      ],
      estado: null,
      fontes: ["Fluxo de pareamento sem atrito"],
      usouIa: false,
    };
  }

  // Dúvida: O que é a Nexora / Como funciona
  if (
    /\b(o que e|como funciona|o que voces fazem|funciona como|o que faz)\b/.test(
      t,
    )
  ) {
    return {
      mensagens: [
        "O Nexora é o seu atendente inteligente de WhatsApp que nunca dorme. Ele responde seus clientes em segundos, tira dúvidas com as suas regras e agenda horários sozinho 24h por dia — para você nunca mais perder uma venda fora do expediente.\n\n" +
          "Qual é o ramo do seu negócio para eu te mostrar como ele fica pré-configurado?",
      ],
      estado: null,
      fontes: ["Apresentação de valor da Nexora"],
      usouIa: false,
    };
  }

  // Saudação inicial ou primeira mensagem do contato
  const ehSaudacao =
    /^(ol[aá]|oi|bom dia|boa tarde|boa noite|opa|e ai|hello|hey|fala|tudo bem|tudo bom)\b/i.test(
      t,
    );

  if (ehSaudacao || e.primeiraDoDia) {
    return {
      mensagens: [
        "Olá! Tudo bem? 👋 Viu a velocidade dessa resposta? Se fossem 23h ou um domingo, seu cliente receberia essa mesma atenção na sua empresa.\n\n" +
          "Me conta: qual é o ramo do seu negócio (ex: clínica, estética, barbearia, consultório, serviços)?",
      ],
      estado: null,
      fontes: ["Prova imediata de velocidade + Gancho das 23h"],
      usouIa: false,
    };
  }

  // Fallback suave e humano
  return {
    mensagens: [
      "Entendi perfeitamente! O Nexora foi desenvolvido exatamente para dar essa agilidade e tranquilidade para o seu negócio, atendendo no mesmo segundo e sem deixar nenhum cliente sem resposta.\n\n" +
        "A primeira semana é 100% grátis e sem pedir cartão de crédito. Qual é o ramo da sua empresa para eu liberar seu atendente pré-configurado?",
    ],
    estado: null,
    fontes: ["Acolhimento comercial + Condução suave para o nicho"],
    usouIa: false,
  };
}
