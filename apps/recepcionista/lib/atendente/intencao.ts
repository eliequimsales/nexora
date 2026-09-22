import { DEFAULT_HANDOFF_TERMS, isPureGreeting } from "@/lib/ai/quick-reply";
import { lerPedidoDeDia, normalizarTexto, type PedidoDeDia } from "./datas";

/**
 * O QUE O CLIENTE QUER — DECIDIDO POR PALAVRA, ANTES DE QUALQUER IA.
 *
 * Urgência, pedido de pessoa, reclamação, escolha de uma opção, pedido de
 * horário, preço, horário de funcionamento, endereço e pagamento têm resposta
 * certa, e a resposta certa não pode depender de um modelo acertar. Só o que
 * sobra (LIVRE) vai para a IA, e ainda assim com os fatos do banco.
 *
 * Na dúvida entre duas leituras, vence a que protege o cliente: "sangrando" é
 * urgência mesmo no meio de um pedido de horário; "urgente" sozinho não é.
 */

export type TipoDeIntencao =
  | "URGENCIA"
  | "DESMARCAR"
  | "PESSOA"
  | "RECLAMACAO"
  | "ESCOLHA"
  | "CONFIRMA"
  | "NEGA"
  | "FUNCIONAMENTO"
  | "HORARIO"
  | "PRECO"
  | "ENDERECO"
  | "PAGAMENTO"
  | "AGRADECIMENTO"
  | "SAUDACAO"
  | "LIVRE";

export type Intencao = {
  tipo: TipoDeIntencao;
  pedido: PedidoDeDia;
  escolha?: number;
  servicoId?: string;
  profissional?: string;
  /** Urgência emocional (risco à própria vida): o texto fixo aponta para o CVV. */
  emocional?: boolean;
};

export type ContextoDaIntencao = {
  servicos: { id: string; nome: string }[];
  profissionais: string[];
  /** As palavras que o dono cadastrou para ser chamado. */
  palavrasDoDono: string[];
  /** A escolha pendente na conversa, se houver. */
  estado: "SERVICO" | "HORARIO" | "CONVITE" | null;
  /** As opções numeradas oferecidas; nos horários, `minutos` é a hora local. */
  opcoes?: { n: number; minutos: number }[];
  agora: Date;
};

const URGENCIA =
  /\b(emergencia|socorro|sangr\w*|desmai\w*|falta de ar|nao consigo respirar|alergi\w*|reacao alergica|infecc\w*|infeccion\w*|inflam\w*|passando mal|machuc\w*|queimadura|queimei|dor muito forte|dor forte|convuls\w*|acidente)\b/;
const URGENCIA_EMOCIONAL =
  /\b(me matar|suicid\w*|tirar minha vida|nao quero mais viver|acabar com tudo|me machucar)\b/;
const DESMARCAR =
  /\b(desmarcar|desmarca|cancelar (o |meu |minha )?(horario|agendamento|marcacao|atendimento)|remarcar|nao vou poder ir|nao vou conseguir ir|mudar (o|meu) horario|trocar (o|meu) horario)\b/;
const RECLAMACAO =
  /\b(reclam\w*|pessim\w*|horrivel|absurdo|decepcion\w*|nao gostei|estragou|mal atendid\w*|falta de respeito|quero meu dinheiro|reembolso|procon)\b/;
const FUNCIONAMENTO_DIRETO =
  /\b(que horas (voces )?(abre|fecha|abrem|fecham)|horario de (funcionamento|atendimento)|funcionamento|ate que horas|abre (hoje|amanha|domingo|sabado|feriado)|abrem|voces abrem|esta aberto|estao abertos|ta aberto|fecha que horas)\b/;
const HORARIO =
  /\b(horario|horarios|vaga|vagas|agenda|agendar|agendo|agendamento|marcar|encaixe|encaixar|encaixa|disponivel|disponibilidade|consigo ir|tem hora|atende hoje|atendem hoje|da pra (ir|passar|fazer|cortar)|posso ir)\b/;
const PRECO = /\b(quanto (custa|e|fica|sai|ta|esta|cobra|cobram)|preco|precos|valor|valores|tabela|cobram)\b/;
const ENDERECO = /\b(endereco|localizacao|onde fica|onde ficam|onde voces ficam|onde e|como chegar|qual a rua|fica onde|ponto de referencia)\b/;
const PAGAMENTO =
  /\b(pix|cartao|credito|debito|parcel\w*|formas? de pagamento|aceitam|aceita|como pago|como pagar|pagamento)\b/;
const AGRADECIMENTO = /^(muito )?(obrigad\w*|valeu|vlw|brigad\w*|agradeco|obg|grato|grata)\b/;
const CONFIRMA = /^(sim|s|quero|pode|pode ser|claro|bora|ok|okay|isso|por favor|opa|manda|vamos|quero sim|sim quero|sim por favor)\b/;
const NEGA = /^(nao|n|agora nao|depois|talvez|deixa|deixa pra la)\b/;
const ORDINAIS: [RegExp, number][] = [
  [/\bprimeir[oa]\b/, 1],
  [/\bsegund[oa] (opcao|horario|opção)\b/, 2],
  [/\bterceir[oa]\b/, 3],
  [/\bultim[oa]\b/, -1],
];

/** Palavra solta casa inteira; frase casa por dentro. "atendente virtual" não é pedir pessoa. */
function contemTermo(texto: string, termo: string): boolean {
  const t = normalizarTexto(termo);
  if (!t) return false;
  if (t.includes(" ")) return texto.includes(t);
  return new RegExp(`\\b${t.replace(/[.*+?^${}()|[\]\\]/g, "\\$&")}\\b`).test(texto);
}

const QUEM_ELE_E = /\batendente virtual\b|\batendimento virtual\b/;

function pediuPessoa(texto: string, palavrasDoDono: string[]): boolean {
  const semIdentidade = texto.replace(QUEM_ELE_E, " ");
  return [...DEFAULT_HANDOFF_TERMS, ...palavrasDoDono].some((termo) => contemTermo(semIdentidade, termo));
}

/**
 * O serviço que o cliente citou. Cada palavra do nome conta pelo começo
 * ("cort" acha "cortar"), e vence o serviço com mais palavras encontradas —
 * "corte e barba" é "Corte + Barba", não "Corte".
 */
export function acharServico(texto: string, servicos: { id: string; nome: string }[]): string | undefined {
  const t = normalizarTexto(texto);
  let melhor: { id: string; pontos: number; tamanho: number } | undefined;
  for (const s of servicos) {
    const palavras = normalizarTexto(s.nome)
      .split(/[^a-z0-9]+/)
      .filter((p) => p.length >= 3);
    if (palavras.length === 0) continue;
    const pontos = palavras.filter((p) => new RegExp(`\\b${p.slice(0, Math.max(3, p.length - 1))}`).test(t)).length;
    if (pontos === 0) continue;
    if (
      !melhor ||
      pontos > melhor.pontos ||
      (pontos === melhor.pontos && palavras.length < melhor.tamanho)
    ) {
      melhor = { id: s.id, pontos, tamanho: palavras.length };
    }
  }
  return melhor?.id;
}

function acharProfissional(texto: string, profissionais: string[]): string | undefined {
  const t = normalizarTexto(texto);
  return profissionais.find((p) => {
    const primeiro = normalizarTexto(p).split(" ")[0];
    return primeiro.length >= 3 && new RegExp(`\\b${primeiro}\\b`).test(t);
  });
}

/**
 * Qual das opções o cliente escolheu: "2", "a 2", "opção 2", "o das 11", "11h",
 * "16h40", "quero a primeira". null quando não dá para ter certeza.
 */
export function lerEscolha(texto: string, opcoes: { n: number; minutos: number }[]): number | null {
  const t = normalizarTexto(texto);
  const existe = (n: number) => opcoes.some((o) => o.n === n);

  const numero = t.match(
    /^(?:a |o |opcao |opção |numero |nº |n |quero (?:a |o )?|pode ser (?:a |o )?|fico com (?:a |o )?)?(\d)(?:\b|$)(?!\s*(?:h|:|\/))/,
  );
  if (numero && existe(Number(numero[1]))) return Number(numero[1]);

  for (const [padrao, n] of ORDINAIS) {
    if (padrao.test(t)) {
      const alvo = n === -1 ? opcoes.at(-1)?.n : n;
      return alvo !== undefined && existe(alvo) ? alvo : null;
    }
  }

  const hora = t.match(/\b(\d{1,2})\s*(?:h|:)\s*(\d{2})?\b|\b(?:as|das|a das|o das)\s+(\d{1,2})(?:\s*(?:h|:)\s*(\d{2}))?\b/);
  if (hora) {
    const h = Number(hora[1] ?? hora[3]);
    const m = hora[2] ?? hora[4];
    const comHora = opcoes.filter((o) => o.minutos >= 0 && Math.floor(o.minutos / 60) === h);
    if (m !== undefined) {
      const exata = comHora.find((o) => o.minutos % 60 === Number(m));
      return exata ? exata.n : null;
    }
    return comHora.length === 1 ? comHora[0].n : null;
  }

  return null;
}

export function detectarIntencao(texto: string, ctx: ContextoDaIntencao): Intencao {
  const t = normalizarTexto(texto);
  const pedido = lerPedidoDeDia(texto, ctx.agora);
  const servicoId = acharServico(texto, ctx.servicos);
  const profissional = acharProfissional(texto, ctx.profissionais);
  const base = { pedido, servicoId, profissional };

  if (URGENCIA_EMOCIONAL.test(t)) return { ...base, tipo: "URGENCIA", emocional: true };
  if (URGENCIA.test(t)) return { ...base, tipo: "URGENCIA" };
  if (DESMARCAR.test(t)) return { ...base, tipo: "DESMARCAR" };
  if (pediuPessoa(t, ctx.palavrasDoDono)) return { ...base, tipo: "PESSOA" };
  if (RECLAMACAO.test(t)) return { ...base, tipo: "RECLAMACAO" };

  // Uma escolha só existe quando há opção na mesa.
  if ((ctx.estado === "HORARIO" || ctx.estado === "SERVICO") && ctx.opcoes?.length) {
    const escolha = lerEscolha(texto, ctx.opcoes);
    if (escolha !== null) return { ...base, tipo: "ESCOLHA", escolha };
    if (ctx.estado === "SERVICO" && servicoId) {
      const indice = ctx.servicos.findIndex((s) => s.id === servicoId);
      if (indice >= 0 && ctx.opcoes.some((o) => o.n === indice + 1)) {
        return { ...base, tipo: "ESCOLHA", escolha: indice + 1 };
      }
    }
  }

  if (ctx.estado === "CONVITE") {
    if (NEGA.test(t)) return { ...base, tipo: "NEGA" };
    if (CONFIRMA.test(t)) return { ...base, tipo: "CONFIRMA" };
  }

  const pedeLivre = /\b(livre|vago|vaga|disponivel|marcar|agendar)\b/.test(t);
  if (FUNCIONAMENTO_DIRETO.test(t) && !pedeLivre) return { ...base, tipo: "FUNCIONAMENTO" };
  if (/\b(qual|quais) (e |sao )?(o |os )?horarios? de voces\b|\bhorario de voces\b/.test(t) && !pedeLivre) {
    return { ...base, tipo: "FUNCIONAMENTO" };
  }

  const citouDia = Boolean(pedido.dia || pedido.periodo || pedido.aPartirDe !== undefined);
  if (HORARIO.test(t) || (citouDia && (servicoId || profissional)) || (citouDia && t.split(" ").length <= 3)) {
    return { ...base, tipo: "HORARIO" };
  }

  if (PRECO.test(t)) return { ...base, tipo: "PRECO" };
  if (ENDERECO.test(t)) return { ...base, tipo: "ENDERECO" };
  if (PAGAMENTO.test(t)) return { ...base, tipo: "PAGAMENTO" };
  if (AGRADECIMENTO.test(t) && t.split(" ").length <= 6) return { ...base, tipo: "AGRADECIMENTO" };
  if (isPureGreeting(texto) || /^(oi+|ola+|opa|e ai|eae|oie)\W*$/.test(t)) return { ...base, tipo: "SAUDACAO" };

  return { ...base, tipo: "LIVRE" };
}
