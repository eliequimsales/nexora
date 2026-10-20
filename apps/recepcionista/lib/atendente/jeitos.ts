/**
 * OS TRÊS JEITOS DE FALAR DO ATENDENTE VIRTUAL.
 *
 * O dono escolhe lendo a mesma conversa escrita nos três jeitos — nunca
 * descrevendo um tom num campo vazio. Cada jeito tem os próprios textos prontos
 * para tudo que o sistema decide sozinho (saudação, oferta, confirmação, "não
 * sei", pedido de pessoa, reclamação); a IA só entra nas respostas livres, e
 * recebe o jeito como orientação.
 *
 * Duas regras valem para todos:
 *   - Nunca finge ser gente. Ele se apresenta como atendente virtual, uma vez.
 *   - Nunca inventa fatos nem confirma ações. Estes textos não recebem provas de
 *     registro ou notificação; só a confirmação de reserva usa resultado da agenda.
 *
 * Puro e sem banco: roda no servidor, no navegador (passo 1 da tela) e na
 * demonstração da landing.
 */

export type Jeito = "ACOLHEDOR" | "DIRETO" | "DESCONTRAIDO";

export const JEITOS: Jeito[] = ["ACOLHEDOR", "DIRETO", "DESCONTRAIDO"];

export const NOME_DO_JEITO: Record<Jeito, string> = {
  ACOLHEDOR: "Acolhedor",
  DIRETO: "Direto",
  DESCONTRAIDO: "Descontraído",
};

export const DESCRICAO_DO_JEITO: Record<Jeito, string> = {
  ACOLHEDOR: "Gentil e atencioso.",
  DIRETO: "Educado e sem rodeio.",
  DESCONTRAIDO: "Leve e simpático, sem perder o profissionalismo.",
};

const PARTICULAS = new Set(["da", "de", "do", "das", "dos", "e"]);

/**
 * O nome do profissional como o cliente lê: "cleber" → "Cleber", "maria da
 * silva" → "Maria da Silva". Só a exibição muda; a agenda guarda como o dono
 * escreveu.
 */
export function nomeProprio(nome: string): string {
  return nome
    .trim()
    .split(/\s+/)
    .map((parte, i) => {
      const minuscula = parte.toLocaleLowerCase("pt-BR");
      if (i > 0 && PARTICULAS.has(minuscula)) return minuscula;
      return parte.charAt(0).toLocaleUpperCase("pt-BR") + parte.slice(1);
    })
    .join(" ");
}

/** "quarta, 23/09, às 11h" → "Quarta, 23/09, às 11h", para quando o dia começa a frase. */
function comMaiuscula(texto: string): string {
  return texto.charAt(0).toLocaleUpperCase("pt-BR") + texto.slice(1);
}

export function lerJeito(valor: unknown): Jeito {
  return JEITOS.includes(valor as Jeito) ? (valor as Jeito) : "ACOLHEDOR";
}

/**
 * Como ele se apresenta. Sem artigo antes do nome ("Eu sou Bia"), para não
 * supor gênero a partir do nome que o dono escolheu.
 */
export function apresentacao(p: { nome: string; empresa: string }): string {
  const nome = p.nome.trim();
  return nome
    ? `Eu sou ${nome}, atendente virtual da ${p.empresa}`
    : `Aqui é o atendimento virtual da ${p.empresa}`;
}

/** "Bom dia", "Boa tarde" ou "Boa noite", pela hora de Brasília. */
export function cumprimento(agora: Date): string {
  const hora = (agora.getUTCHours() + 24 - 3) % 24;
  if (hora >= 5 && hora < 12) return "Bom dia";
  if (hora >= 12 && hora < 18) return "Boa tarde";
  return "Boa noite";
}

/**
 * O primeiro nome que veio do WhatsApp, só quando parece nome. Apelido com
 * emoji, número ou texto comprido fica de fora: "Oi, 🔥🔥!" é pior que "Oi!".
 */
export function primeiroNomeDoCliente(nomeDoWhatsApp: string | null | undefined): string | null {
  const primeiro = (nomeDoWhatsApp ?? "").trim().split(/\s+/)[0] ?? "";
  if (!/^[\p{L}'-]{2,20}$/u.test(primeiro)) return null;
  return primeiro.charAt(0).toLocaleUpperCase("pt-BR") + primeiro.slice(1).toLocaleLowerCase("pt-BR");
}

export interface Textos {
  saudacao(p: { cumprimento: string; cliente: string | null; apresentacao: string }): string;
  contextoFechado(volta: string | null): string;
  contextoExpediente: string;
  convite: string;
  /** `servico` null: não há serviço cadastrado, e o texto fala só dos horários. */
  ofertaLead(p: { servico: string | null; detalhe: string | null; quando: string | null }): string;
  respondaComNumero: string;
  /** "Marcar direto" desligado e sem link: a escolha ainda precisa de confirmação. */
  respondaParaAnotar: string;
  anoteiHorario(p: { quando: string; volta: string | null }): string;
  escolherServico: string;
  confirmacao(p: { quando: string; servico: string | null; profissional: string | null }): string;
  ocupado: string;
  semHorario(quando: string | null): string;
  semAgenda: string;
  linkAgenda(link: string): string;
  conviteLink(p: { link: string; servico: string | null }): string;
  pessoa(volta: string | null): string;
  reclamacao(volta: string | null): string;
  naoSei(volta: string | null): string;
  preco(p: { servico: string; preco: string; duracao: string | null }): string;
  semPreco(servico: string): string;
  agradecimento: string;
  teto(p: { apresentacao: string; volta: string | null }): string;
  limiteDoDia(volta: string | null): string;
}

const comNome = (cliente: string | null) => (cliente ? `, ${cliente}` : "");
const entreParenteses = (detalhe: string | null) => (detalhe ? ` (${detalhe})` : "");
const espacoAntes = (quando: string | null) => (quando ? ` ${quando}` : "");
/** " para Corte (R$ 45,00, 40 min)" — ou nada, quando não há serviço cadastrado. */
const doServico = (prefixo: string, servico: string | null, detalhe: string | null) =>
  servico ? ` ${prefixo} ${servico}${entreParenteses(detalhe)}` : "";
/** "Quarta, 23/09, às 11h — Corte com Léo", sem serviço ou sem profissional quando faltam. */
const oQueEComQuem = (p: { servico: string | null; profissional: string | null }, separador: string) =>
  `${p.servico ? `${separador}${p.servico}` : ""}${p.profissional ? ` com ${p.profissional}` : ""}`;

const ACOLHEDOR: Textos = {
  saudacao: (p) => `${p.cumprimento}${comNome(p.cliente)}! ${p.apresentacao} 💛`,
  contextoFechado: (volta) =>
    volta
      ? `Estamos fora do horário de atendimento. A próxima abertura é ${volta}.`
      : "Estamos fora do horário de atendimento.",
  contextoExpediente: "Posso te ajudar por aqui.",
  convite: "Quer que eu te mostre os horários livres?",
  ofertaLead: (p) => `Tenho estes horários${doServico("para", p.servico, p.detalhe)}${espacoAntes(p.quando)}:`,
  respondaComNumero: "É só responder com o número do horário que você prefere.",
  respondaParaAnotar: "Qual horário você prefere? A escolha ainda precisa de confirmação da equipe.",
  anoteiHorario: (p) => `Você escolheu ${p.quando}. Esse horário ainda precisa de confirmação da equipe.`,
  escolherServico: "Qual desses você quer? É só responder com o número:",
  confirmacao: (p) =>
    `Prontinho! ${comMaiuscula(p.quando)}${oQueEComQuem(p, " — ")}. ` +
    "Já está na agenda. Se precisar desmarcar, é só avisar por aqui 💛",
  ocupado: "Esse horário não está mais disponível. Veja as próximas opções:",
  semHorario: (quando) =>
    quando ? `Para ${quando} não tenho mais horário livre. Os próximos são:` : "Os próximos horários livres são:",
  semAgenda: "Não encontrei horário livre nos dias consultados. Outras possibilidades precisam ser verificadas com a equipe.",
  linkAgenda: (link) => `Para confirmar, é só escolher o seu por aqui: ${link}`,
  conviteLink: (p) =>
    `Você pode escolher o melhor horário direto por este link:\n${p.link} 💛`,
  pessoa: (volta) =>
    volta
      ? `Claro. Vou pausar o atendimento virtual para você falar com a equipe. A próxima abertura é ${volta}; não tenho um prazo de resposta confirmado.`
      : "Claro. Vou pausar o atendimento virtual para você falar com a equipe. Não tenho um prazo de resposta confirmado.",
  reclamacao: () =>
    "Sinto muito pelo ocorrido. Essa situação precisa da atenção da equipe; vou pausar o atendimento virtual.",
  naoSei: () => "Não tenho essa informação confirmada. Esse detalhe precisa ser verificado com a equipe.",
  preco: (p) => `${p.servico} sai por ${p.preco}${p.duracao ? ` e leva ${p.duracao}` : ""}.`,
  semPreco: (servico) =>
    `Não tenho o valor de ${servico} confirmado. Esse preço precisa ser verificado com a equipe.`,
  agradecimento: "Imagina! Qualquer coisa, é só chamar 💛",
  teto: (p) =>
    `Oi! ${p.apresentacao}. Neste momento, a continuação do atendimento depende da equipe. Não tenho um prazo de resposta confirmado.`,
  limiteDoDia: () => "A continuação desta conversa precisa da equipe. Não tenho um prazo de resposta confirmado.",
};

const DIRETO: Textos = {
  saudacao: (p) => `${p.cumprimento}${comNome(p.cliente)}. ${p.apresentacao}.`,
  contextoFechado: (volta) =>
    volta
      ? `Estamos fora do horário de atendimento. Próxima abertura: ${volta}.`
      : "Estamos fora do horário de atendimento.",
  contextoExpediente: "Posso ajudar por aqui.",
  convite: "Quer ver os horários livres?",
  ofertaLead: (p) => `Horários${p.servico ? doServico("para", p.servico, p.detalhe) : " livres"}${espacoAntes(p.quando)}:`,
  respondaComNumero: "Responda com o número do horário desejado.",
  respondaParaAnotar: "Responda com o número desejado. A escolha depende de confirmação da equipe.",
  anoteiHorario: (p) => `Horário escolhido: ${p.quando}. Ainda não está confirmado; depende da equipe.`,
  escolherServico: "Qual serviço? Responda com o número:",
  confirmacao: (p) =>
    `Confirmado: ${p.quando}${oQueEComQuem(p, ", ")}. ` + "Está na agenda. Para desmarcar, avise por aqui.",
  ocupado: "Esse horário não está mais disponível. Próximas opções:",
  semHorario: (quando) => (quando ? `Sem horário livre para ${quando}. Próximos:` : "Próximos horários livres:"),
  semAgenda: "Não encontrei horário livre nos dias consultados. Outras possibilidades dependem de consulta à equipe.",
  linkAgenda: (link) => `Para confirmar, escolha pelo link: ${link}`,
  conviteLink: (p) =>
    `Escolha seu horário direto pelo link:\n${p.link}`,
  pessoa: (volta) =>
    volta
      ? `Vou pausar o atendimento virtual para você falar com a equipe. Próxima abertura: ${volta}. Não há prazo de resposta confirmado.`
      : "Vou pausar o atendimento virtual para você falar com a equipe. Não há prazo de resposta confirmado.",
  reclamacao: () => "Lamento pelo ocorrido. A equipe precisa avaliar essa situação. Vou pausar o atendimento virtual.",
  naoSei: () => "Não tenho essa informação confirmada. É preciso verificar com a equipe.",
  preco: (p) => `${p.servico}: ${p.preco}${p.duracao ? `, ${p.duracao}` : ""}.`,
  semPreco: (servico) =>
    `Não tenho o valor de ${servico} confirmado. É preciso consultar a equipe sobre esse preço.`,
  agradecimento: "Por nada. Qualquer coisa, estou por aqui.",
  teto: (p) =>
    `Olá. ${p.apresentacao}. Este atendimento precisa continuar com a equipe. Não há prazo de resposta confirmado.`,
  limiteDoDia: () => "Esta conversa precisa continuar com a equipe. Não há prazo de resposta confirmado.",
};

const DESCONTRAIDO: Textos = {
  saudacao: (p) => `Opa, ${p.cumprimento.toLocaleLowerCase("pt-BR")}${comNome(p.cliente)}! ${p.apresentacao} 😄`,
  contextoFechado: (volta) =>
    volta ? `Estamos fora do horário de atendimento. Abrimos ${volta}.` : "Estamos fora do horário de atendimento.",
  contextoExpediente: "Posso te ajudar por aqui.",
  convite: "Bora ver um horário?",
  ofertaLead: (p) => `Olha o que tenho${doServico("pra", p.servico, p.detalhe)}${espacoAntes(p.quando)}:`,
  respondaComNumero: "Me diga o número do horário que você prefere.",
  respondaParaAnotar: "Me diga o número que você prefere. A escolha ainda depende de confirmação da equipe.",
  anoteiHorario: (p) => `Sua escolha foi ${p.quando}. O horário ainda não está confirmado; precisa da confirmação da equipe.`,
  escolherServico: "Qual deles vai ser? Manda o número:",
  confirmacao: (p) =>
    `Fechado! ${comMaiuscula(p.quando)}${oQueEComQuem(p, " — ")}. ` +
    "Já tá na agenda. Se precisar desmarcar, é só avisar aqui.",
  ocupado: "Esse horário não está mais disponível. Olha as próximas opções:",
  semHorario: (quando) => (quando ? `Não encontrei horário livre pra ${quando}. Os próximos são:` : "Os próximos livres são:"),
  semAgenda: "Não encontrei horário livre nos dias consultados. A equipe precisa verificar outras possibilidades.",
  linkAgenda: (link) => `Pra confirmar, é só escolher o seu aqui: ${link}`,
  conviteLink: (p) =>
    `Dá uma olhada nos horários e escolhe o seu aqui:\n${p.link} 😄`,
  pessoa: (volta) =>
    volta
      ? `Claro! Vou pausar o atendimento virtual pra você falar com a equipe. Abrimos ${volta}; ainda não tenho um prazo de resposta.`
      : "Claro! Vou pausar o atendimento virtual pra você falar com a equipe. Ainda não tenho um prazo de resposta.",
  reclamacao: () =>
    "Sinto muito pelo ocorrido. A equipe precisa cuidar dessa situação; vou pausar o atendimento virtual.",
  naoSei: () => "Esse detalhe eu não tenho confirmado. Precisa ser verificado com a equipe.",
  preco: (p) => `${p.servico} sai ${p.preco}${p.duracao ? ` e leva ${p.duracao}` : ""}.`,
  semPreco: (servico) =>
    `O valor de ${servico} eu ainda não tenho confirmado. A equipe precisa verificar esse preço.`,
  agradecimento: "Por nada! Se precisar, estou por aqui 😄",
  teto: (p) => `Olá! ${p.apresentacao}. A equipe precisa continuar este atendimento. Ainda não tenho um prazo de resposta.`,
  limiteDoDia: () => "A equipe precisa continuar esta conversa. Ainda não tenho um prazo de resposta.",
};

const TEXTOS: Record<Jeito, Textos> = { ACOLHEDOR, DIRETO, DESCONTRAIDO };

export function textosDoJeito(jeito: Jeito): Textos {
  return TEXTOS[jeito];
}

/**
 * URGÊNCIA DE SAÚDE OU SEGURANÇA — igual nos três jeitos, sem emoji e sem
 * orientação nenhuma além de buscar socorro. Quem decide que é urgência é o
 * código (lib/atendente/intencao.ts), nunca a IA.
 */
export function URGENCIA(empresa: string): string {
  return (
    "Entendi. Se for uma emergência, ligue 192 (SAMU) ou procure o pronto-socorro mais próximo. " +
    `O atendimento virtual da ${empresa} não substitui ajuda de emergência.`
  );
}

/**
 * RISCO À PRÓPRIA VIDA — texto fixo que aponta para o CVV (188), gratuito e 24
 * horas. Nenhuma orientação além de buscar ajuda; não presume notificação.
 */
export function URGENCIA_CVV(empresa: string): string {
  return (
    "Sinto muito que você esteja passando por isso. Se estiver pensando em se machucar, " +
    "o CVV atende agora, de graça, pelo 188 ou em cvv.org.br. " +
    `O atendimento virtual da ${empresa} não substitui ajuda de emergência.`
  );
}

export type Bolha = { de: "cliente" | "atendente"; texto: string };

/**
 * A MESMA CONVERSA NOS TRÊS JEITOS — para o passo 1 da tela e para a landing.
 * Monta com as mesmas peças do motor; quem chama decide se os dados são do
 * negócio de verdade ou de exemplo (e diz isso na tela).
 */
export function conversaDeExemplo(
  jeito: Jeito,
  d: {
    empresa: string;
    nome: string;
    cliente: string | null;
    /** null: o negócio ainda não tem serviço cadastrado. */
    servico: string | null;
    detalhe: string | null;
    opcoes: string[];
    escolhida: { quando: string; profissional: string | null };
    volta: string | null;
    cumprimento: string;
    linkAgenda?: string | null;
  },
): Bolha[] {
  const t = textosDoJeito(jeito);
  const ap = apresentacao({ nome: d.nome, empresa: d.empresa });
  const perguntaAgenda = [
    t.ofertaLead({ servico: d.servico, detalhe: d.detalhe, quando: null }),
    ...d.opcoes,
    t.respondaComNumero,
    ...(d.linkAgenda ? [t.linkAgenda(d.linkAgenda)] : []),
  ].join("\n");

  return [
    {
      de: "cliente",
      texto: `${d.cumprimento}! Tem horário${d.servico ? ` pra ${d.servico.toLocaleLowerCase("pt-BR")}` : ""}?`,
    },
    {
      de: "atendente",
      texto: `${t.saudacao({ cumprimento: d.cumprimento, cliente: d.cliente, apresentacao: ap })} ${t.contextoFechado(d.volta)}`,
    },
    {
      de: "atendente",
      texto: perguntaAgenda,
    },
    {
      de: "cliente",
      texto: `Pode ser ${d.escolhida.quando}, por favor!`,
    },
    {
      de: "atendente",
      texto: t.confirmacao({ quando: d.escolhida.quando, servico: d.servico, profissional: d.escolhida.profissional }),
    },
  ];
}

