import type { DependenciasDoMotor, EntradaDoMotor, SaidaDoMotor } from "./motor";
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
    regex: /\b(advocaci\w*|advogad\w*|juridic\w*|escritorio de advocacia)\b/,
    dor: "Escritórios de advocacia perdem clientes que precisam de retorno rápido no primeiro contato para fechar contrato.",
  },
  // 6. Consultoria, Gestão, Agências e Marketing
  {
    slug: "consultoria",
    nome: "Consultoria",
    regex: /\b(consultori\w*|consultor\w*|agenci\w*|marketing\b|trafego pago|social media|rh\b|recrutamento|gestao empresarial)\b/,
    dor: "Empresas e consultorias perdem oportunidades valiosas quando o lead esfria esperando resposta.",
  },
  // 7. Contabilidade e Finanças
  {
    slug: "contabilidade",
    nome: "Contabilidade",
    regex: /\b(contabil\w*|contador\w*|escritorio contabil|assessoria fiscal|planejamento fiscal|abertura de empresa)\b/,
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
    regex: /\b(escol\w*|curs\w*|escola de idiomas|curso de ingles|escola de ingles|aulas particulares|reforco escolar|danca\b)/,
    dor: "Escolas e cursos perdem matrículas valiosas todos os dias de interessados que buscam informações no tempo livre à noite.",
  },
  // 16. Gastronomia, Restaurantes e Confeitarias
  {
    slug: "gastronomia",
    nome: "Restaurantes e Gastronomia",
    regex: /\b(restaurant\w*|bistro\b|pizzari\w*|hamburgueri\w*|confeitari\w*|doceria|bolos? e doces?|marmitari\w*)/,
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
  /\b(preco|quanto|custa|computador|pc|nuvem|chip|whatsapp|teste|cartao|humano|atendente|ola|oi|bom dia|boa tarde|boa noite|inventar|errar|alucin|conectar|instalar|audio|audios|nota fiscal|cnpj|cpf|segur\w*|lgpd|cancel\w*|integrac\w*|google agenda)\b/i;

const PALAVRAS_IGNORAR_RAMO = new Set([
  "cliente",
  "clientes",
  "usuario",
  "usuarios",
  "suporte",
  "ajuda",
  "duvida",
  "duvidas",
  "interesse",
  "novo",
  "nova",
  "novos",
  "novas",
  "aqui",
  "painel",
  "conta",
  "cadastro",
  "verdade",
  "seguro",
  "seguranca",
  "teste",
  "preco",
  "precos",
  "valor",
  "valores",
  "audio",
  "audios",
  "video",
  "videos",
  "humano",
  "humanos",
  "pessoa",
  "pessoas",
  "bot",
  "robo",
  "robos",
  "ia",
  "inteligencia",
  "sistema",
  "app",
  "plataforma",
  "massa",
  "legal",
  "bom",
  "boa",
  "verdadeiro",
  "fake",
  "golpe",
  "real",
  "gratis",
  "gratuito",
  "pagamento",
  "nota",
  "nota fiscal",
  "cnpj",
  "cpf",
  "empresa",
  "negocio",
  "ramo",
]);

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
        link: `${URL_ATIVACAO}/${item.slug}`,
      };
    }
  }

  // Se a mensagem for sobre dúvidas operacionais ou preços, não faz extração dinâmica aqui
  if (PALAVRAS_RESERVADAS_DUVIDAS.test(t)) {
    return null;
  }

  // 2. Extração semântica por padrões de fala ("tenho uma X", "sou X", "trabalho com X", "é uma X")
  const padraoDeclaracao =
    /\b(?:tenho\s+(?:uma?|um\s+)?|sou\s+(?:uma?|um\s+)?|trabalho\s+com\s+|[eé]\s+(?:uma?|um)\s+|[eé]\s+do\s+ramo\s+de\s+|meu\s+ramo\s+[eé]\s+|meu\s+neg[oó]cio\s+[eé]\s+|minha\s+empresa\s+[eé]\s+(?:uma?|um\s+)?)\s*([a-z0-9\s-]{3,35})/i;
  const match = t.match(padraoDeclaracao);
  if (match && match[1]) {
    const ramoExtraido = match[1].trim();
    const primeiraPalavra = ramoExtraido.split(/\s+/)[0];

    // Ignora termos de controle, dúvidas, suporte, etc.
    if (!PALAVRAS_IGNORAR_RAMO.has(primeiraPalavra) && !PALAVRAS_IGNORAR_RAMO.has(ramoExtraido)) {
      // Confere se o termo extraído cai em algum dos ramos do catálogo
      for (const item of CATALOGO_DE_RAMOS) {
        if (item.regex.test(ramoExtraido)) {
          return {
            slug: item.slug,
            nome: item.nome,
            dor: item.dor,
            link: `${URL_ATIVACAO}/${item.slug}`,
          };
        }
      }

      const slug = gerarSlug(ramoExtraido) || "servicos";
      return {
        slug,
        nome: ramoExtraido,
        dor: `Empresas de ${ramoExtraido} perdem orçamentos e clientes valiosos toda noite e fim de semana. Quem responde primeiro fecha a venda.`,
        link: `${URL_ATIVACAO}/${slug}`,
      };
    }
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
    const primeiraPalavra = t.split(/\s+/)[0];
    if (!PALAVRAS_IGNORAR_RAMO.has(primeiraPalavra) && !PALAVRAS_IGNORAR_RAMO.has(t)) {
      const slug = gerarSlug(t) || "servicos";
      return {
        slug,
        nome: t,
        dor: `Empresas de ${t} perdem orçamentos e clientes valiosos toda noite e fim de semana. Quem responde primeiro fecha a venda.`,
        link: `${URL_ATIVACAO}/${slug}`,
      };
    }
  }

  // 4. Se o usuário digitou uma única palavra que expressa "serviços" em geral
  if (/\b(servico|servicos|prestador|prestadora|autonomo|autonoma)\b/.test(t)) {
    return {
      slug: "servicos",
      nome: "Serviços em Geral",
      dor: "Empresas de serviços perdem orçamentos valiosos toda noite e fim de semana. Quem responde primeiro fecha a venda.",
      link: `${URL_ATIVACAO}/servicos`,
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

export function montarPromptComercial(
  _e: EntradaDoMotor,
  ramoHistorico: InformacaoDeRamo | null,
): string {
  const ramoContexto = ramoHistorico
    ? `O usuário já mencionou que atua no ramo de "${ramoHistorico.nome}". A dor desse ramo é: "${ramoHistorico.dor}". O link de ativação dele é: 👉 ${ramoHistorico.link}`
    : `O ramo do usuário ainda não foi identificado. Convide-o suavemente a dizer o ramo do seu negócio para ver o atendente pré-configurado.`;

  return `Você é a inteligência artificial comercial da Nexora (meunexora.com.br) atendendo no WhatsApp oficial da empresa.
Seu objetivo é encantar o lead, responder com segurança, autoridade e simpatia e conduzi-lo a ativar o atendente pré-configurado dele no WhatsApp.

# Sobre a Nexora
- Plataforma de IA para atendimento e agendamento automático 24/7 no WhatsApp de empresas e profissionais autônomos.
- Responde em segundos, com regras próprias, preços e horários da empresa cadastrada, sem inventar nada.
- Não precisa de chip novo, funciona com o WhatsApp atual da empresa sem perder histórico.
- Roda 100% em nuvem 24h: não precisa de computador ligado nem celular conectado.
- Seguro, isolado e em total conformidade com a LGPD.
- Teste grátis de 7 dias sem cartão de crédito. Mensalidade de R$ 97/mês sem contrato e sem fidelidade (cancela com 1 clique). Nota fiscal emitida automaticamente para CNPJ e CPF.
- Integração nativa com Google Agenda e Webhooks/APIs externas.
- Escuta e compreende áudios de clientes perfeitamente e responde em texto.

# Contexto do Lead
${ramoContexto}

# Regras de Resposta
- Responda em português do Brasil, tom consultivo, ágil, educado e focado em conversão.
- Máximo de 2 a 3 parágrafos curtos.
- Nunca seja robótico ou repetitivo.
- Não mencione preço a menos que o cliente pergunte sobre valores, custos ou planos.
- Retorne SEMPRE um JSON válido no formato:
{
  "resposta": "sua resposta aqui formatada para WhatsApp",
  "transferir_humano": false,
  "motivo_transferencia": "",
  "nome_cliente": "",
  "interesse": ""
}`;
}

export async function responderComercial(e: EntradaDoMotor, deps?: DependenciasDoMotor): Promise<SaidaDoMotor> {
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
          "Enquanto isso, se quiser adiantar e ver seu atendente funcionando na prática agora mesmo, você já pode acessar:\n" +
          `👉 ${URL_ATIVACAO}`,
      ],
      estado: null,
      equipe: true,
      fontes: ["Transição humanizada para equipe comercial"],
      usouIa: false,
    };
  }

  // 2. Cliente já existente / Suporte com painel
  const ehClienteOuSuporte =
    /\b(ja sou cliente|sou cliente|minha conta|meu painel|preciso de suporte|falar com o suporte|problema no painel|minha assinatura|meu plano)\b/.test(
      t,
    );
  if (ehClienteOuSuporte) {
    return {
      mensagens: [
        "Olá! Que bom falar com você. Como você já é nosso cliente, você pode acessar seu painel diretamente por aqui:\n" +
          "👉 https://meunexora.com.br/painel\n\n" +
          "Já notifiquei nossa equipe de suporte para te ajudar por aqui também em instantes!",
      ],
      estado: null,
      equipe: true,
      fontes: ["Suporte a cliente existente"],
      usouIa: false,
    };
  }

  // 3. Pergunta sobre áudio (escuta/entende áudios que os clientes mandam)
  const perguntouAudio =
    /\b(audio|audios|entende audio|escuta audio|ouve audio|manda audio|ouvir audio|recebe audio|transcreve audio)\b/.test(
      t,
    );
  if (perguntouAudio) {
    const link = ramoHistorico ? ramoHistorico.link : URL_ATIVACAO;
    return {
      mensagens: [
        "Sim! O Nexora ouve e compreende áudios perfeitamente, respondendo em texto instantaneamente com as regras do seu negócio. Ele não se perde nem com áudios longos de clientes.\n\n" +
          (ramoHistorico
            ? `${ramoHistorico.dor}\n\nVocê já pode ativar e testar agora mesmo:\n👉 ${link}`
            : "Qual é o ramo da sua empresa? Já deixo configurado para você testar na prática!"),
      ],
      estado: null,
      fontes: ["Compreensão nativa de áudio"],
      usouIa: false,
    };
  }

  // 4. Pergunta sobre Nota Fiscal / CNPJ
  const perguntouNotaFiscal =
    /\b(nota fiscal|emite nota|emitir nota|emitem nota|nfe|nf-e|cnpj|dados para faturamento)\b/.test(
      t,
    );
  if (perguntouNotaFiscal) {
    const link = ramoHistorico ? ramoHistorico.link : URL_ATIVACAO;
    return {
      mensagens: [
        "Sim! Emitimos nota fiscal automaticamente para todas as assinaturas, tanto para CNPJ quanto para CPF. A nota é gerada e enviada para o seu e-mail a cada mensalidade.\n\n" +
          (ramoHistorico
            ? `Você já pode ativar seu atendente agora:\n👉 ${link}`
            : "Qual é o ramo da sua empresa para eu já liberar seu modelo pré-configurado?"),
      ],
      estado: null,
      fontes: ["Emissão automática de nota fiscal"],
      usouIa: false,
    };
  }

  // 5. Pergunta sobre Google Agenda / Integração
  const perguntouIntegracao =
    /\b(google agenda|agenda do google|integrac\w*|webhook|api|crm|sincroniz\w*)\b/.test(
      t,
    );
  if (perguntouIntegracao) {
    const link = ramoHistorico ? ramoHistorico.link : URL_ATIVACAO;
    return {
      mensagens: [
        "Sim! O Nexora tem integração nativa com o Google Agenda e sistemas externos via Webhook/API. Quando um cliente agenda pelo WhatsApp, o horário é sincronizado na hora e bloqueado na sua agenda para evitar choque de horários.\n\n" +
          (ramoHistorico
            ? `${ramoHistorico.dor}\n\nJá deixei seu Atendente 100% pré-configurado para você ativar agora:\n👉 ${link}`
            : "Qual é o ramo da sua empresa para eu já liberar seu modelo pré-configurado?"),
      ],
      estado: null,
      fontes: ["Integração com Google Agenda e Webhooks"],
      usouIa: false,
    };
  }

  // 6. Pergunta sobre Segurança / LGPD / Privacidade
  const perguntouSeguranca =
    /\b(segur\w*|lgpd|dados dos clientes|privacidade|protegido|vazar|vazamento)\b/.test(
      t,
    );
  if (perguntouSeguranca) {
    const link = ramoHistorico ? ramoHistorico.link : URL_ATIVACAO;
    return {
      mensagens: [
        "É 100% seguro! Trabalhamos em total conformidade com a LGPD e criptografia de ponta a ponta. Seus dados e os dados dos seus clientes ficam isolados no seu ambiente seguro e nunca são compartilhados nem usados para treinar modelos públicos.\n\n" +
          (ramoHistorico
            ? `${ramoHistorico.dor}\n\nVocê já pode ativar seu modelo com total segurança:\n👉 ${link}`
            : "Qual é o ramo da sua empresa para eu já liberar seu modelo pré-configurado?"),
      ],
      estado: null,
      fontes: ["Segurança e conformidade LGPD"],
      usouIa: false,
    };
  }

  // 7. Pergunta sobre Cancelamento / Fidelidade / Contrato
  const perguntouCancelamento =
    /\b(cancel\w*|fidelidade|contrato|multa|prender|reembolso)\b/.test(
      t,
    );
  if (perguntouCancelamento) {
    const link = ramoHistorico ? ramoHistorico.link : URL_ATIVACAO;
    return {
      mensagens: [
        "Zero fidelidade e zero burocracia. Você pode cancelar quando quiser com 1 clique direto no seu painel, sem multa, sem contrato e sem pegadinhas. Você só continua se o Nexora realmente estiver gerando lucro e poupando seu tempo.\n\n" +
          (ramoHistorico
            ? `${ramoHistorico.dor}\n\nJá deixei seu Atendente 100% pré-configurado para você testar agora:\n👉 ${link}`
            : "Qual é o ramo do seu negócio para eu já liberar seu modelo pré-configurado?"),
      ],
      estado: null,
      fontes: ["Cancelamento sem fricção e sem fidelidade"],
      usouIa: false,
    };
  }

  // 8. Mensagem de curiosidade / "É de verdade?" / "É robô?"
  const perguntouSeEReal =
    /\b(e de verdade|e real|voce e robo|e robo|voce e humano|isso e de verdade|e bot|voce e um bot|inteligencia artificial mesmo)\b/.test(
      t,
    );
  if (perguntouSeEReal) {
    const link = ramoHistorico ? ramoHistorico.link : URL_ATIVACAO;
    return {
      mensagens: [
        "Sou 100% inteligência artificial da Nexora rodando ao vivo! Exatamente igual ao que podemos colocar atendendo seus clientes na sua empresa 24h por dia, sem você precisar ficar preso ao celular.\n\n" +
          (ramoHistorico
            ? `${ramoHistorico.dor}\n\nVocê pode testar e ver seu modelo funcionando agora:\n👉 ${link}`
            : "Qual é o ramo da sua empresa? Te mostro como fica configurado para o seu negócio!"),
      ],
      estado: null,
      fontes: ["Prova viva de IA em funcionamento"],
      usouIa: false,
    };
  }

  // 9. Dúvida: IA erra / Alucinação
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

  // 10. Dúvida: Chip novo / WhatsApp Business / Número
  if (
    /\b(chip|numero novo|outro numero|business|outro whatsapp|perco meu numero|perder meu numero)\b/.test(
      t,
    )
  ) {
    return {
      mensagens: [
        "Não precisa de chip novo nem de número extra! Você conecta o seu WhatsApp atual mesmo em 30 segundos pelo QR Code ou código de 8 dígitos, sem perder suas conversas e sem burocracia.\n\n" +
          "Qual é o ramo da sua empresa para eu já liberar seu acesso?",
      ],
      estado: null,
      fontes: ["Conexão direta com número atual"],
      usouIa: false,
    };
  }

  // 11. Dúvida: Computador ligado / Nuvem
  if (
    /\b(computador ligado|pc ligado|deixar o computador|nuvem|celular ligado|celular conectado|desligado|funciona desligado)\b/.test(
      t,
    )
  ) {
    const link = ramoHistorico ? ramoHistorico.link : URL_ATIVACAO;
    return {
      mensagens: [
        "Não precisa deixar o computador ligado nem o celular conectado! O Nexora roda 100% em nuvem 24 horas por dia. Você pode desligar tudo que ele continua atendendo e agendando normalmente.\n\n" +
          "Quer ver funcionando no seu ramo? É só me falar qual é o seu tipo de negócio ou ativar seu modelo aqui:\n" +
          `👉 ${link}`,
      ],
      estado: null,
      fontes: ["Esclarecimento de infraestrutura em nuvem"],
      usouIa: false,
    };
  }

  // 12. Dúvida: Como funciona o teste grátis / Cartão (quando explicitamente perguntado)
  if (
    /\b(teste gratis|como funciona o teste|pede cartao|cartao de credito|pegadinha)\b/.test(
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

  // 13. Dúvida: Como conecta / QR Code / Instalação
  if (
    /\b(conect\w*|instal\w*|pareament\w*|parear|qr\s*code|codigo de pareamento)\b/.test(
      t,
    )
  ) {
    const link = ramoHistorico ? ramoHistorico.link : URL_ATIVACAO;
    return {
      mensagens: [
        "É super simples e leva menos de 1 minuto: você entra no link, a tela já abre pré-configurada pro seu ramo, você testa uma mensagem no simulador e conecta seu WhatsApp escaneando o QR Code (ou com código de 8 dígitos).\n\n" +
          "Você já pode ativar agora mesmo:\n" +
          `👉 ${link}`,
      ],
      estado: null,
      fontes: ["Fluxo de pareamento sem atrito"],
      usouIa: false,
    };
  }

  // 14. Pergunta de Preço
  const perguntouPreco =
    /\b(preco|precos|quanto custa|quanto e|qual o valor|qual valor|tabela|planos|plano|mensalidade|investimento|r\$|reais)\b/.test(
      t,
    );

  // Nicho + Preço juntos na mesma mensagem
  if (ramoAtual && perguntouPreco) {
    return {
      mensagens: [
        `${ramoAtual.dor}\n\n` +
          "A primeira semana é 100% por nossa conta — grátis e sem pedir cartão de crédito. Você testa com seus clientes na prática e só decide se quer continuar depois de ver o resultado.\n\n" +
          "Depois, o plano é super acessível, apenas R$ 97/mês (no Pix ou Cartão), sem contrato e sem fidelidade.\n\n" +
          `Já deixei seu modelo pré-configurado para você ativar agora:\n👉 ${ramoAtual.link}`,
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
          "Me conta: qual é o ramo da sua empresa para eu já liberar seu modelo pré-configurado?",
      ],
      estado: null,
      fontes: ["Oferta comercial com convite ao nicho"],
      usouIa: false,
    };
  }

  // 15. Se o lead informou o nicho
  const perguntouComoFunciona =
    /\b(o que e|como funciona|o que voces fazem|funciona como|o que faz)\b/.test(
      t,
    );

  if (ramoAtual) {
    if (perguntouComoFunciona) {
      return {
        mensagens: [
          "O Nexora é o seu atendente inteligente de WhatsApp que nunca dorme. Ele responde seus clientes em segundos, tira dúvidas com as suas regras e agenda horários sozinho 24h por dia — para você nunca mais perder uma venda fora do expediente.\n\n" +
            `${ramoAtual.dor}\n\n` +
            "Já deixei seu Atendente 100% pré-configurado para você ativar agora:\n" +
            `👉 ${ramoAtual.link}`,
        ],
        estado: null,
        fontes: ["Apresentação de valor + Gancho de conversão do nicho"],
        usouIa: false,
      };
    }

    return {
      mensagens: [
        `${ramoAtual.dor}\n\n` +
          "Já deixei seu Atendente 100% pré-configurado para você ativar agora:\n" +
          `👉 ${ramoAtual.link}`,
      ],
      estado: null,
      fontes: ["Gancho de conversão específico por nicho"],
      usouIa: false,
    };
  }

  // 16. Dúvida: O que é a Nexora / Como funciona (sem nicho informado ainda)
  if (perguntouComoFunciona) {
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

  // 17. Saudação inicial ou primeira mensagem do contato
  const ehSaudacao =
    /^(ol[aá]|oi|bom dia|boa tarde|boa noite|opa|e ai|hello|hey|fala|tudo bem|tudo bom)\b/i.test(
      t,
    );

  if (ehSaudacao || e.primeiraDoDia) {
    return {
      mensagens: [
        "Viu a velocidade dessa resposta? Se fossem 23h ou um domingo, seu cliente receberia essa mesma atenção na sua empresa.\n\n" +
          "Qual o ramo do seu negócio?",
      ],
      estado: null,
      fontes: ["Prova imediata de velocidade + Gancho das 23h"],
      usouIa: false,
    };
  }

  // 18. Inteligência Artificial com montagem comercial avançada (se deps.ia disponível)
  if (deps?.ia) {
    try {
      const prompt = montarPromptComercial(e, ramoHistorico);
      const resIa = await deps.ia({ systemPrompt: prompt, historico: e.historico });
      if (resIa?.resposta) {
        return {
          mensagens: [resIa.resposta],
          estado: null,
          equipe: resIa.transferir_humano ? true : undefined,
          fontes: ["Inteligência Artificial Comercial Nexora"],
          usouIa: true,
        };
      }
    } catch {
      // Falha graciosa cai no acolhimento abaixo
    }
  }

  // 19. Fallback suave e humano
  return {
    mensagens: [
      "Entendi perfeitamente! O Nexora foi desenvolvido exatamente para dar essa agilidade e tranquilidade para o seu negócio, atendendo no mesmo segundo e sem deixar nenhum cliente sem resposta.\n\n" +
        "Qual é o ramo da sua empresa para eu liberar seu atendente pré-configurado?",
    ],
    estado: null,
    fontes: ["Acolhimento comercial + Condução suave para o nicho"],
    usouIa: false,
  };
}
