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
 *   - Nunca inventa número. Quando não sabe quando a equipe volta, o texto não
 *     diz hora nenhuma.
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
  ACOLHEDOR: "Caloroso, como alguém da casa.",
  DIRETO: "Educado e sem rodeio.",
  DESCONTRAIDO: "Leve, do jeito de quem já é cliente.",
};

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
  ofertaLead(p: { servico: string; detalhe: string | null; quando: string | null }): string;
  respondaComNumero: string;
  escolherServico: string;
  confirmacao(p: { quando: string; servico: string; profissional: string | null }): string;
  ocupado: string;
  semHorario(quando: string | null): string;
  semAgenda: string;
  linkAgenda(link: string): string;
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

const ACOLHEDOR: Textos = {
  saudacao: (p) => `${p.cumprimento}${comNome(p.cliente)}! ${p.apresentacao} 💛`,
  contextoFechado: (volta) =>
    volta
      ? `A equipe volta ${volta}, mas a agenda eu já consigo ver.`
      : "A equipe não está agora, mas a agenda eu já consigo ver.",
  contextoExpediente:
    "A equipe está no atendimento agora e já te responde; enquanto isso, eu te ajudo por aqui.",
  convite: "Quer que eu te mostre os horários livres?",
  ofertaLead: (p) =>
    `Tenho estes horários para ${p.servico}${entreParenteses(p.detalhe)}${espacoAntes(p.quando)}:`,
  respondaComNumero: "É só responder com o número que eu já deixo marcado.",
  escolherServico: "Qual desses você quer? É só responder com o número:",
  confirmacao: (p) =>
    `Prontinho! ${p.quando} — ${p.servico}${p.profissional ? ` com ${p.profissional}` : ""}. ` +
    "Já está na agenda. Se precisar desmarcar, é só avisar por aqui 💛",
  ocupado: "Ih, esse horário acabou de ser ocupado. Olha os próximos:",
  semHorario: (quando) =>
    quando ? `Para ${quando} não tenho mais horário livre. Os próximos são:` : "Os próximos horários livres são:",
  semAgenda: "Não encontrei horário livre nos próximos dias. Deixei anotado para a equipe te chamar.",
  linkAgenda: (link) => `Para confirmar, é só escolher o seu por aqui: ${link}`,
  pessoa: (volta) =>
    volta
      ? `Claro! A equipe volta ${volta} e já deixei anotado para falarem com você.`
      : "Claro! Já avisei a equipe, e alguém te responde por aqui assim que puder.",
  reclamacao: (volta) =>
    `Sinto muito por isso. Anotei tudo para a equipe, e alguém fala com você ${volta ?? "assim que puder"}.`,
  naoSei: (volta) =>
    `Essa eu não tenho confirmada aqui. Deixei anotado para a equipe te responder ${volta ?? "assim que puder"}.`,
  preco: (p) => `${p.servico} sai por ${p.preco}${p.duracao ? ` e leva ${p.duracao}` : ""}.`,
  semPreco: (servico) =>
    `O valor de ${servico} eu não tenho confirmado aqui. Deixei anotado para a equipe te passar certinho.`,
  agradecimento: "Imagina! Qualquer coisa, é só chamar 💛",
  teto: (p) =>
    `Oi! ${p.apresentacao}. Recebi sua mensagem e a equipe te responde ${p.volta ?? "assim que puder"}.`,
  limiteDoDia: (volta) =>
    `Deixei tudo anotado para a equipe, que te responde ${volta ?? "assim que puder"}.`,
};

const DIRETO: Textos = {
  saudacao: (p) => `${p.cumprimento}${comNome(p.cliente)}. ${p.apresentacao}.`,
  contextoFechado: (volta) =>
    volta
      ? `Estamos fechados agora e voltamos ${volta}, mas já consigo ver a agenda.`
      : "Estamos fechados agora, mas já consigo ver a agenda.",
  contextoExpediente: "A equipe está atendendo e já responde; enquanto isso, posso adiantar por aqui.",
  convite: "Quer ver os horários livres?",
  ofertaLead: (p) => `Horários para ${p.servico}${entreParenteses(p.detalhe)}${espacoAntes(p.quando)}:`,
  respondaComNumero: "Responda com o número para marcar.",
  escolherServico: "Qual serviço? Responda com o número:",
  confirmacao: (p) =>
    `Confirmado: ${p.quando}, ${p.servico}${p.profissional ? ` com ${p.profissional}` : ""}. ` +
    "Está na agenda. Para desmarcar, avise por aqui.",
  ocupado: "Esse horário acabou de ser ocupado. Próximos:",
  semHorario: (quando) => (quando ? `Sem horário livre para ${quando}. Próximos:` : "Próximos horários livres:"),
  semAgenda: "Não há horário livre nos próximos dias. Anotei para a equipe entrar em contato.",
  linkAgenda: (link) => `Para confirmar, escolha pelo link: ${link}`,
  pessoa: (volta) =>
    volta
      ? `Certo. A equipe volta ${volta} e vai falar com você.`
      : "Certo. Avisei a equipe, e alguém responde por aqui em breve.",
  reclamacao: (volta) => `Lamento. Registrei para a equipe, que fala com você ${volta ?? "em breve"}.`,
  naoSei: (volta) => `Não tenho essa informação confirmada. Anotei para a equipe responder ${volta ?? "em breve"}.`,
  preco: (p) => `${p.servico}: ${p.preco}${p.duracao ? `, ${p.duracao}` : ""}.`,
  semPreco: (servico) => `Não tenho o valor de ${servico} confirmado. Anotei para a equipe informar.`,
  agradecimento: "Por nada. Qualquer coisa, estou por aqui.",
  teto: (p) =>
    `Olá. ${p.apresentacao}. Sua mensagem foi registrada e a equipe responde ${p.volta ?? "em breve"}.`,
  limiteDoDia: (volta) => `Registrei tudo para a equipe, que responde ${volta ?? "em breve"}.`,
};

const DESCONTRAIDO: Textos = {
  saudacao: (p) => `Opa, ${p.cumprimento.toLocaleLowerCase("pt-BR")}${comNome(p.cliente)}! ${p.apresentacao} 😄`,
  contextoFechado: (volta) =>
    volta ? `O pessoal volta ${volta}, mas a agenda eu já te mostro.` : "O pessoal não está agora, mas a agenda eu já te mostro.",
  contextoExpediente: "O pessoal está na correria aqui e já te responde; enquanto isso, deixa comigo.",
  convite: "Bora ver um horário?",
  ofertaLead: (p) => `Olha o que tenho pra ${p.servico}${entreParenteses(p.detalhe)}${espacoAntes(p.quando)}:`,
  respondaComNumero: "Manda o número que eu já marco pra você.",
  escolherServico: "Qual deles vai ser? Manda o número:",
  confirmacao: (p) =>
    `Fechado! ${p.quando} — ${p.servico}${p.profissional ? ` com ${p.profissional}` : ""}. ` +
    "Já tá na agenda. Se precisar desmarcar, é só avisar aqui.",
  ocupado: "Eita, esse acabou de ser pego. Olha os próximos:",
  semHorario: (quando) => (quando ? `Pra ${quando} lotou. Os próximos são:` : "Os próximos livres são:"),
  semAgenda: "Nos próximos dias tá tudo cheio. Deixei anotado pro pessoal te chamar.",
  linkAgenda: (link) => `Pra confirmar, é só escolher o seu aqui: ${link}`,
  pessoa: (volta) =>
    volta
      ? `Claro! O pessoal volta ${volta} e já deixei anotado pra falarem com você.`
      : "Claro! Já chamei o pessoal, e alguém te responde aqui assim que der.",
  reclamacao: (volta) =>
    `Poxa, sinto muito. Anotei tudo pro pessoal, e alguém fala com você ${volta ?? "assim que der"}.`,
  naoSei: (volta) =>
    `Essa eu não sei te dizer com certeza. Deixei anotado pro pessoal te responder ${volta ?? "assim que der"}.`,
  preco: (p) => `${p.servico} sai ${p.preco}${p.duracao ? ` e leva ${p.duracao}` : ""}.`,
  semPreco: (servico) => `O valor de ${servico} eu não tenho certinho aqui. Deixei anotado pro pessoal te passar.`,
  agradecimento: "Tamo junto! Qualquer coisa, chama aqui 😄",
  teto: (p) => `Opa! ${p.apresentacao}. Recebi sua mensagem e o pessoal te responde ${p.volta ?? "assim que der"}.`,
  limiteDoDia: (volta) => `Deixei tudo anotado pro pessoal, que te responde ${volta ?? "assim que der"}.`,
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
    `Já deixei avisado para a equipe da ${empresa}.`
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
    servico: string;
    detalhe: string | null;
    opcoes: string[];
    escolhida: { quando: string; profissional: string | null };
    volta: string | null;
    cumprimento: string;
  },
): Bolha[] {
  const t = textosDoJeito(jeito);
  const ap = apresentacao({ nome: d.nome, empresa: d.empresa });
  const numeroEscolhido = String(Math.min(2, d.opcoes.length) || 1);
  return [
    { de: "cliente", texto: `${d.cumprimento}! Tem horário amanhã pra ${d.servico.toLocaleLowerCase("pt-BR")}?` },
    {
      de: "atendente",
      texto: `${t.saudacao({ cumprimento: d.cumprimento, cliente: d.cliente, apresentacao: ap })} ${t.contextoFechado(d.volta)}`,
    },
    {
      de: "atendente",
      texto: [t.ofertaLead({ servico: d.servico, detalhe: d.detalhe, quando: "amanhã" }), ...d.opcoes, t.respondaComNumero].join("\n"),
    },
    { de: "cliente", texto: numeroEscolhido },
    {
      de: "atendente",
      texto: t.confirmacao({ quando: d.escolhida.quando, servico: d.servico, profissional: d.escolhida.profissional }),
    },
  ];
}
