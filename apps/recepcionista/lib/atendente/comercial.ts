import type { EntradaDoMotor, SaidaDoMotor } from "./motor";
import { URL_ATIVACAO } from "./comercial-config";

export type InformacaoDeRamo = {
  slug: string;
  nome: string;
  dor: string;
  link: string;
};

function normalizarTexto(txt: string): string {
  return (txt || "")
    .toLowerCase()
    .normalize("NFD")
    .replace(/\p{M}/gu, "")
    .replace(/[^a-z0-9\s]/g, " ")
    .replace(/\s+/g, " ")
    .trim();
}

function gerarSlug(txt: string): string {
  return (txt || "")
    .toLowerCase()
    .normalize("NFD")
    .replace(/\p{M}/gu, "")
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "")
    .slice(0, 30);
}

/**
 * 17 GRANDES SETORES COM GATILHOS DE DOR HIPER-ESPECÍFICOS E AUTORIDADE
 */
const CATALOGO_DE_RAMOS: {
  slug: string;
  nome: string;
  regex: RegExp;
  dor: string;
}[] = [
  // 1. Odontologia
  {
    slug: "odonto",
    nome: "Odontologia",
    regex: /\b(odonto\w*|dentist\w*|ortodont\w*|implante dental|clareamento dental)\b/,
    dor: "Consultórios odontológicos perdem pacientes de alto valor fora do horário comercial quando não respondem na hora.",
  },
  // 2. Estética e Spas
  {
    slug: "estetica",
    nome: "Estética",
    regex: /\b(estetic\w*|espaco de beleza|centro de estetica|depilac\w*|harmonizac\w*|bronzeament\w*|massag\w*|massoterapi\w*|drenagem|spa\b)/,
    dor: "Espaços de estética e beleza perdem agendamentos toda semana para concorrentes que respondem primeiro.",
  },
  // 3. Barbearia
  {
    slug: "barbearia",
    nome: "Barbearia",
    regex: /\b(barbeari\w*|barbeir\w*|corte masculino|corte de cabelo masculino|barba\b)/,
    dor: "Salões e barbearias perdem muitos clientes que tentam agendar à noite e no fim de semana.",
  },
  // 4. Salão de Beleza, Cabelo, Manicure e Cílios
  {
    slug: "salao",
    nome: "Salão de Beleza",
    regex: /\b(salao|saloes|cabeleireir\w*|hair\b|lash\b|cilios|sobrancelh\w*|manicur\w*|unhas?|pedicur\w*|podologi\w*|micropigmentac\w*)/,
    dor: "Salões de beleza e profissionais de estética perdem dezenas de agendamentos toda semana para concorrentes que respondem na hora à noite.",
  },
  // 5. Advocacia e Jurídico
  {
    slug: "advocacia",
    nome: "Advocacia",
    regex: /\b(advocaci\w*|advogad\w*|juridic\w*|direito\b|escritorio de advocacia)/,
    dor: "Escritórios de advocacia perdem clientes que precisam de retorno rápido no primeiro contato para fechar contrato.",
  },
  // 6. Consultoria, Gestão, Agências e Marketing
  {
    slug: "consultoria",
    nome: "Consultoria",
    regex: /\b(consultori\w*|consultor\w*|agenci\w*|marketing\b|trafego pago|social media|rh\b|recrutamento|gestao\b)/,
    dor: "Empresas e consultorias perdem oportunidades valiosas quando o lead esfria esperando resposta.",
  },
  // 7. Contabilidade e Finanças
  {
    slug: "contabilidade",
    nome: "Contabilidade",
    regex: /\b(contabil\w*|contador\w*|escritorio contabil|fiscal\b|abertura de empresa)/,
    dor: "Escritórios de contabilidade perdem clientes empresariais que buscam troca de contador ou abertura de empresa e esperam um retorno imediato.",
  },
  // 8. Imobiliárias e Corretores de Imóveis
  {
    slug: "imobiliaria",
    nome: "Imobiliária",
    regex: /\b(imobiliari\w*|corretor\w*|imovel\b|imoveis\b|aluguel de temporada)/,
    dor: "Imobiliárias e corretores perdem leads quentes de imóveis que pesquisam à noite e no fim de semana e querem agendar visitas imediatamente.",
  },
  // 9. Pet Shop e Clínicas Veterinárias
  {
    slug: "pet",
    nome: "Pet Shop e Veterinária",
    regex: /\b(pet\b|petshop\b|veterinari\w*|banho e tosa|tosa\b|hotel pet|creche pet|adestrament\w*)/,
    dor: "Pet shops e clínicas veterinárias perdem agendamentos de banho, tosa e consultas toda noite e fim de semana, quando os tutores têm tempo para marcar.",
  },
  // 10. Mecânica, Auto Center e Automotivo
  {
    slug: "automotivo",
    nome: "Centro Automotivo",
    regex: /\b(mecanic\w*|oficin\w*|auto center|centro automotivo|funilari\w*|lava jato|lava rapido|lavagem|estetica automotiva|troca de oleo|auto eletric\w*|borrachari\w*|pneus?)/,
    dor: "Oficinas e centros automotivos perdem orçamentos valiosos toda noite e fim de semana. Quem responde o motorista primeiro fecha o serviço.",
  },
  // 11. Fitness, Academias e Personal Trainer
  {
    slug: "fitness",
    nome: "Academia e Fitness",
    regex: /\b(academi\w*|personal\b|crossfit\b|pilates\b|funcional\b|treino\b|natacao\b|lutas?\b|jiu jitsu|muay thai|beach tennis|futvolei)/,
    dor: "Academias, estúdios e personais perdem alunos novos toda semana que buscam informações à noite e acabam esfriando ou indo pro concorrente.",
  },
  // 12. Estúdios de Tatuagem e Piercing
  {
    slug: "tattoo",
    nome: "Estúdio de Tattoo",
    regex: /\b(tatuad\w*|tatuag\w*|tattoo\w*|piercing\b|body piercing)/,
    dor: "Estúdios de tatuagem e piercing perdem clientes com ideias prontas que mandam mensagem fora de hora e fecham com quem responder primeiro.",
  },
  // 13. Fotografia, Filmagem e Eventos
  {
    slug: "eventos",
    nome: "Fotografia e Eventos",
    regex: /\b(fotograf\w*|filmagem\b|estudio fotografico|cerimonial\w*|buffet\b|decoracao de festas|locacao de brinquedos|dj\b)/,
    dor: "Profissionais de eventos e fotografia perdem contratos importantes toda semana quando clientes orçam à noite e quem responde primeiro fecha.",
  },
  // 14. Manutenção, Ar Condicionado, Vidraçaria, Marcenaria e Reformas
  {
    slug: "manutencao",
    nome: "Serviços e Manutenção",
    regex: /\b(ar condicionado|refrigerac\w*|climatizac\w*|eletricist\w*|encanador\w*|vidracar\w*|vidraceir\w*|marcenar\w*|marceneir\w*|moveis planejados|serralher\w*|serralheir\w*|pintor\w*|pintura residencial|reformas?\b|gesso|gesseiro|energia solar|marido de aluguel|dedetizador\w*|limpeza de estofados)/,
    dor: "Profissionais de manutenção e reformas perdem chamados e orçamentos toda noite. O cliente sempre chama quem responder primeiro.",
  },
  // 15. Educação, Escolas e Cursos
  {
    slug: "educacao",
    nome: "Educação e Cursos",
    regex: /\b(escol\w*|curs\w*|escola de idiomas|ingles\b|aulas particulares|reforco escolar|danca\b)/,
    dor: "Escolas e cursos perdem matrículas valiosas todos os dias de interessados que buscam informações no tempo livre à noite.",
  },
  // 16. Gastronomia, Restaurantes e Confeitarias
  {
    slug: "gastronomia",
    nome: "Restaurantes e Gastronomia",
    regex: /\b(restaurant\w*|bistro\b|pizzari\w*|hamburgueri\w*|confeitari\w*|bolos?\b|doces?\b|encomendas?\b|marmitari\w*)/,
    dor: "Restaurantes e confeitarias perdem reservas e encomendas toda semana quando o cliente quer tirar dúvidas rápidas e fica sem retorno.",
  },
  // 17. Clínica Geral, Saúde, Médicos e Terapeutas
  {
    slug: "clinica",
    nome: "Clínica Médica",
    regex: /\b(clinic\w*|consultorio\w*|medic\w*|saude\b|fisioterapi\w*|fisio\b|psicolog\w*|nutric\w*|pediatr\w*|dermatolog\w*|terapeut\w*|hospital\w*|fonoaudiolog\w*|psicanalise|quiropraxi\w*)/,
    dor: "Clínicas e consultórios perdem até 40% das consultas fora do horário comercial porque o paciente não espera até o dia seguinte.",
  },
];

const PALAVRAS_RESERVADAS_DUVIDAS =
  /\b(preco|quanto|custa|computador|pc|nuvem|chip|whatsapp|teste|cartao|humano|atendente|ola|oi|bom dia|boa tarde|boa noite|inventar|errar|alucin|conectar|instalar)\b/i;

/**
 * Identifica o ramo do usuário:
 * 1. Primeiro confere no catálogo mapeado.
 * 2. Se não encontrar e a mensagem não for uma dúvida/pergunta reservada,
 *    faz a extração semântica dinâmica de QUALQUER ramo citado.
 */
export function identificarRamo(texto: string, historico: { content: string }[] = []): InformacaoDeRamo | null {
  const t = normalizarTexto(texto);
  if (!t) return null;

  // 1. Confere no catálogo fixo dos 17 grandes setores
  for (const item of CATALOGO_DE_RAMOS) {
    if (item.regex.test(t)) {
      return {
        slug: item.slug,
        nome: item.nome,
        dor: item.dor,
        link: `${URL_ATIVACAO}?ramo=${item.slug}`,
      };
    }
  }

  // Se a mensagem for sobre dúvidas operacionais ou preços, não faz extração dinâmica aqui
  if (PALAVRAS_RESERVADAS_DUVIDAS.test(t)) {
    return null;
  }

  // 2. Extração semântica por padrões de fala ("tenho uma X", "sou X", "trabalho com X", "é uma X")
  const padraoDeclaracao =
    /(?:tenho\s+(?:uma?|um)?|sou\s+|trabalho\s+com\s+|[eé]\s+(?:uma?|um)?|meu\s+ramo\s+[eé]\s+|meu\s+neg[oó]cio\s+[eé]\s+|minha\s+empresa\s+[eé]\s+(?:uma?|um)?)\s*([a-z0-9\s-]{3,35})/i;
  const match = t.match(padraoDeclaracao);
  if (match && match[1]) {
    const ramoExtraido = match[1].trim();
    // Confere se o termo extraído cai em algum dos ramos do catálogo
    for (const item of CATALOGO_DE_RAMOS) {
      if (item.regex.test(ramoExtraido)) {
        return {
          slug: item.slug,
          nome: item.nome,
          dor: item.dor,
          link: `${URL_ATIVACAO}?ramo=${item.slug}`,
        };
      }
    }

    const slug = gerarSlug(ramoExtraido) || "servicos";
    return {
      slug,
      nome: ramoExtraido,
      dor: `Empresas de ${ramoExtraido} perdem orçamentos e clientes valiosos toda noite e fim de semana. Quem responde primeiro fecha a venda.`,
      link: `${URL_ATIVACAO}?ramo=${slug}`,
    };
  }

  // 3. Resposta direta à pergunta anterior do atendente ("qual é o ramo do seu negócio?")
  const ultimaIaPerguntouRamo = historico.slice(-2).some((m) =>
    /qual\s+[eé]\s+o\s+ramo|tipo\s+de\s+neg[oó]cio/i.test(m.content),
  );

  if (
    ultimaIaPerguntouRamo &&
    t.length >= 3 &&
    t.length <= 40
  ) {
    const slug = gerarSlug(t) || "servicos";
    return {
      slug,
      nome: t,
      dor: `Empresas de ${t} perdem orçamentos e clientes valiosos toda noite e fim de semana. Quem responde primeiro fecha a venda.`,
      link: `${URL_ATIVACAO}?ramo=${slug}`,
    };
  }

  // 4. Se o usuário digitou uma única palavra que expressa "serviços" em geral
  if (/\b(servico|servicos|prestador|prestadora|autonomo|autonoma)\b/.test(t)) {
    return {
      slug: "servicos",
      nome: "Serviços em Geral",
      dor: "Empresas de serviços perdem orçamentos valiosos toda noite e fim de semana. Quem responde primeiro fecha a venda.",
      link: `${URL_ATIVACAO}?ramo=servicos`,
    };
  }

  return null;
}

export function identificarRamoNoHistorico(historico: { content: string }[]): InformacaoDeRamo | null {
  for (let i = historico.length - 1; i >= 0; i--) {
    const ramo = identificarRamo(historico[i].content);
    if (ramo) return ramo;
  }
  return null;
}

export async function responderComercial(e: EntradaDoMotor): Promise<SaidaDoMotor> {
  const t = normalizarTexto(e.texto);
  const ramoAtual = identificarRamo(e.texto, e.historico);
  const ramoHistorico = ramoAtual || identificarRamoNoHistorico(e.historico);

  // 1. Pedido de atendente humano
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

  // 2. Dúvida: IA erra / Alucinação
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

  // 3. Dúvida: Chip novo / WhatsApp Business / Número
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

  // 4. Dúvida: Computador ligado / Nuvem
  if (
    /\b(computador ligado|pc ligado|deixar o computador|nuvem|celular ligado|celular conectado|desligado|funciona desligado)\b/.test(
      t,
    )
  ) {
    const link = ramoHistorico ? ramoHistorico.link : URL_ATIVACAO;
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

  // 5. Dúvida: Como funciona o teste grátis / Cartão
  if (
    /\b(teste gratis|como funciona o teste|pede cartao|cartao de credito|pegadinha|fidelidade)\b/.test(
      t,
    )
  ) {
    const link = ramoHistorico ? ramoHistorico.link : URL_ATIVACAO;
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

  // 6. Dúvida: Como conecta / QR Code / Instalação
  if (
    /\b(conect\w*|instal\w*|pareament\w*|parear|qr\s*code|codigo de pareamento)\b/.test(
      t,
    )
  ) {
    const link = ramoHistorico ? ramoHistorico.link : URL_ATIVACAO;
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

  // 7. Dúvida: O que é a Nexora / Como funciona
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

  // 8. Pergunta de Preço
  const perguntouPreco =
    /\b(preco|precos|quanto custa|quanto e|qual o valor|qual valor|tabela|planos|plano|mensalidade|investimento|r\$|reais)\b/.test(
      t,
    );

  // Nicho + Preço juntos na mesma mensagem
  if (ramoAtual && perguntouPreco) {
    return {
      mensagens: [
        `${ramoAtual.dor}\n\n` +
          "A primeira semana é 100% por nossa conta — grátis e sem pedir cartão de crédito para você ver o resultado na prática com seus clientes. Depois fica apenas R$ 97/mês (no Pix ou Cartão), sem contrato e sem fidelidade.\n\n" +
          `Já deixei seu modelo 100% pré-configurado para ativar agora:\n👉 ${ramoAtual.link}`,
      ],
      estado: null,
      fontes: ["Oferta comercial personalizada com inversão de risco"],
      usouIa: false,
    };
  }

  // Preço isolado
  if (perguntouPreco) {
    if (ramoHistorico) {
      return {
        mensagens: [
          "A primeira semana é 100% por nossa conta — grátis e sem pedir cartão de crédito. Você testa com seus clientes na prática e só decide se quer continuar depois de ver o resultado.\n\n" +
            "Depois, o plano é super acessível, apenas R$ 97/mês (no Pix ou Cartão), sem contrato e sem fidelidade.\n\n" +
            `Já deixei seu modelo pré-configurado para você ativar agora:\n👉 ${ramoHistorico.link}`,
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

  // 9. Se o lead informou o nicho
  if (ramoAtual) {
    return {
      mensagens: [
        `${ramoAtual.dor}\n\n` +
          "Já deixei seu Atendente 100% pré-configurado com 7 dias grátis por nossa conta, sem pedir cartão:\n" +
          `👉 ${ramoAtual.link}`,
      ],
      estado: null,
      fontes: ["Gancho de conversão específico por nicho"],
      usouIa: false,
    };
  }

  // 10. Saudação inicial ou primeira mensagem do contato
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

  // 11. Fallback suave e humano
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
