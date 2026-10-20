import { isPureGreeting, pedeAtendimentoHumano } from "@/lib/ai/quick-reply";
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
  | "DURACAO"
  | "IDENTIDADE"
  | "ENDERECO"
  | "PAGAMENTO"
  | "AGRADECIMENTO"
  | "SAUDACAO"
  | "LIVRE";

export type Intencao = {
  tipo: TipoDeIntencao;
  /** Trecho correspondente, disponível em detectarIntencoes para preservar perguntas distintas. */
  texto?: string;
  pedido: PedidoDeDia;
  escolha?: number;
  servicoId?: string;
  /** Serviços explicitamente identificados; nunca são fatos extraídos da fala da IA. */
  servicoIds?: string[];
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
  historico?: { role: string; content: string }[];
  /** Serviço já escolhido por uma operação determinística da conversa. */
  servicoAtualId?: string;
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
const DURACAO = /\b(duracao|quanto tempo|quanto dura|quantos minutos|quantas horas|demora quanto|tempo (?:do|da|de) (?:servico|atendimento|procedimento))\b/;
const IDENTIDADE = /\b(?:voce|vc|voces|vcs|tu) (?:e|eh|sao) (?:um |uma |o |a )?(?:robo|bot|ia|inteligencia artificial|humano|humana|pessoa|atendente virtual)\b|\b(?:estou|to) (?:falando|conversando) com (?:um |uma )?(?:robo|bot|ia|pessoa|humano|humana|atendente virtual)\b|\bquem (?:esta|ta) (?:falando|respondendo|me atendendo)\b|\b(?:e|eh) (?:uma )?inteligencia artificial\b/;
const ENDERECO = /\b(endereco|localizacao|onde fica|onde ficam|onde voces ficam|onde e|como chegar|qual a rua|fica onde|ponto de referencia)\b/;
const PAGAMENTO =
  /\b(pix|cartao|credito|debito|parcel\w*|formas? de pagamento|como pago|como pagar|pagamento)\b/;
const AGRADECIMENTO = /^(muito )?(obrigad\w*|valeu|vlw|brigad\w*|agradeco|obg|grato|grata)\b/;
const CONFIRMA = /^(sim|s|quero|pode|pode ser|claro|bora|ok|okay|isso|por favor|opa|manda|vamos|quero sim|sim quero|sim por favor)\b/;
const NEGA = /^(nao|n|agora nao|depois|talvez|deixa|deixa pra la)\b/;
const ORDINAIS: [RegExp, number][] = [
  [/\bprimeir[oa]\b/, 1],
  [/\bsegund[oa] (opcao|horario|opção)\b/, 2],
  [/\bterceir[oa]\b/, 3],
  [/\bultim[oa]\b/, -1],
];

/**
 * Só resolve nomes completos, aceitando flexões simples. Se "corte" pode ser
 * masculino ou feminino, não escolhe o primeiro cadastro por acidente.
 */
export function acharServicos(texto: string, servicos: { id: string; nome: string }[]): string[] {
  const t = normalizarTexto(texto);
  const candidatos = servicos.flatMap((s) => {
    const palavras = normalizarTexto(s.nome)
      .split(/[^a-z0-9]+/)
      .filter((p) => (p.length >= 2 || /^\d+$/.test(p)) && !["de", "do", "da", "em", "no", "na", "um", "uma", "com", "para", "dos", "das", "por"].includes(p));
    if (!palavras.length) return [];
    const padraoDePalavra = (palavra: string) => {
      if (palavra === "corte") return "(?:cortes?|cortar|corto|cortam)";
      if (palavra === "barba") return "(?:barbas?|barbear)";
      if (/^\d+$/.test(palavra)) return palavra;
      if (palavra.endsWith("m")) return `(?:${palavra}|${palavra.slice(0, -1)}ns)`;
      return `${palavra}s?`;
    };
    // Conectores entre partes do nome são permitidos; outra pergunta não vira combo.
    const padrao = palavras.map((p) => `\\b${padraoDePalavra(p)}\\b`).join("(?:[\\s+&-]|\\b(?:e|a|o|de|do|da|com|para)\\b)*");
    const match = t.match(new RegExp(padrao));
    return match ? [{ id: s.id, palavras, inicio: match.index ?? 0, fim: (match.index ?? 0) + match[0].length }] : [];
  });
  return candidatos.filter((candidate) => !candidatos.some((outro) =>
    outro.palavras.length > candidate.palavras.length && outro.inicio <= candidate.inicio && outro.fim >= candidate.fim,
  )).map((s) => s.id);
}

export function acharServico(texto: string, servicos: { id: string; nome: string }[]): string | undefined {
  const ids = acharServicos(texto, servicos);
  return ids.length === 1 ? ids[0] : undefined;
}

function acharProfissional(texto: string, profissionais: string[]): string | undefined {
  const t = normalizarTexto(texto);
  return profissionais.find((p) => {
    const primeiro = normalizarTexto(p).split(" ")[0];
    return primeiro.length >= 3 && new RegExp(`\\b${primeiro}\\b`).test(t);
  });
}

/** Correções explícitas substituem a parte rejeitada; não transformam uma reserva em cancelamento. */
function textoComCorrecao(texto: string): string {
  let t = normalizarTexto(texto);
  const correcao = t.split(/\b(?:na verdade|corrigindo|quis dizer|melhor dizendo|em vez disso)\b/);
  if (correcao.length > 1) t = correcao.at(-1)!;
  t = t.replace(/\bem vez de\b.*$/, "");
  t = t.replace(/^.*?\bnao\s*[,;]\s*/, "");
  t = t.replace(/\bnao (?:quero |era |e |eh )?[^,;]+[,;]\s*(?:mas |e sim )?/, "");
  t = t.replace(/\bnao (?:quero |era |e |eh )?[^,;]+?\s+(?:e sim|mas sim|mas)\s+/, "");
  t = t.replace(/[,;]\s*nao\b.*$/, "");
  return t.trim();
}

function servicosDoContexto(texto: string, ctx: ContextoDaIntencao): string[] {
  const atual = textoComCorrecao(texto);
  const explicitos = acharServicos(atual, ctx.servicos);
  if (explicitos.length) return explicitos;
  const referencia = /\b(?:(?:esse|este|desse|deste|nesse|neste|aquele|daquele|o mesmo) (?:servico|procedimento|atendimento)|dele|dela|disso|isso)\b/.test(atual);
  const perguntaCurta = /^(?:e )?(?:qual (?:e )?(?:o )?(?:preco|valor|duracao)|quanto (?:custa|fica|sai|dura)|quanto tempo(?: (?:leva|demora|dura))?)[?! .]*$/;
  const pedidoCurtoDeAgenda = /^(?:e )?(?:tem (?:algum )?(?:horario|vaga)|(?:quero|posso) (?:agendar|marcar))(?:(?: para| pra| na| no| de| a)? (?:hoje|amanha|depois de amanha|segunda(?:-feira)?|terca(?:-feira)?|quarta(?:-feira)?|quinta(?:-feira)?|sexta(?:-feira)?|sabado|domingo|manha|tarde|noite))*[?! .]*$/;
  if (!referencia && !perguntaCurta.test(atual) && !pedidoCurtoDeAgenda.test(atual)) return [];
  const atualConfiavel = ctx.servicoAtualId && ctx.servicos.some((s) => s.id === ctx.servicoAtualId) ? [ctx.servicoAtualId] : [];

  const historico = [...(ctx.historico ?? [])];
  if (historico.at(-1) && normalizarTexto(historico.at(-1)!.content) === normalizarTexto(texto)) historico.pop();
  // Não reutiliza preços, afirmações ou nomes de serviços introduzidos pela IA.
  // Apenas as últimas falas do cliente podem resolver uma referência inequívoca.
  const recentes = historico.slice(-6).filter((m) => m.role === "CUSTOMER" || m.role === "user").reverse();
  for (const mensagem of recentes) {
    const t = textoComCorrecao(mensagem.content);
    if (/\b(?:esquece|esqueca|outro assunto|nao quero|desisti)\b/.test(t)) return [];
    const ids = acharServicos(t, ctx.servicos);
    if (ids.length) return ids.length === 1 ? ids : [];
    // Uma escolha numérica mais recente é a evidência que originou o estado;
    // não volta a um serviço citado antes dela. Fora disso, a última fala
    // explícita do cliente prevalece sobre uma oferta antiga ainda aberta.
    if (atualConfiavel.length && /^(?:(?:a|o|opcao|numero|quero|quero a|quero o|pode ser|pode ser a|pode ser o) )?\d{1,2}(?:h\d{0,2})?[.! ]*$/.test(t)) return atualConfiavel;
    // Só fragmentos reconhecidos continuam o assunto. "E depilação?" não
    // herda corte por ser curto ou por não constar no cadastro.
    const fragmento = /^(?:e )?(?:hoje|amanha|depois de amanha|segunda(?:-feira)?|terca(?:-feira)?|quarta(?:-feira)?|quinta(?:-feira)?|sexta(?:-feira)?|sabado|domingo|(?:de |a )?(?:manha|tarde|noite)|sim|ok|obrigad[oa])[?! .]*$/;
    if (!perguntaCurta.test(t) && !pedidoCurtoDeAgenda.test(t) && !fragmento.test(t)) return [];
  }
  return atualConfiavel;
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
  const atualizado = textoComCorrecao(texto);
  const pedido = lerPedidoDeDia(atualizado, ctx.agora);
  const servicoIds = servicosDoContexto(texto, ctx);
  const servicoId = servicoIds.length === 1 ? servicoIds[0] : undefined;
  const profissional = acharProfissional(atualizado, ctx.profissionais);
  const base = { pedido, servicoId, servicoIds, profissional };

  if (URGENCIA_EMOCIONAL.test(t)) return { ...base, tipo: "URGENCIA", emocional: true };
  if (URGENCIA.test(t)) return { ...base, tipo: "URGENCIA" };
  if (DESMARCAR.test(t)) return { ...base, tipo: "DESMARCAR" };
  if (pedeAtendimentoHumano(texto, ctx.palavrasDoDono)) return { ...base, tipo: "PESSOA" };
  if (RECLAMACAO.test(t)) return { ...base, tipo: "RECLAMACAO" };

  // Perguntas durante uma escolha não confirmam uma operação por acidente.
  const informativa = PRECO.test(t) || DURACAO.test(t) || ENDERECO.test(t) || PAGAMENTO.test(t) || IDENTIDADE.test(t) || FUNCIONAMENTO_DIRETO.test(t)
    || /\b(?:qual|quais|como|onde|quem|quanto|quando|por que|tem|aceita|aceitam|faz|fazem)\b/.test(t)
    || texto.includes("?");

  if (!informativa && ctx.estado && NEGA.test(atualizado)) return { ...base, tipo: "NEGA" };

  // Uma escolha só existe quando há opção na mesa.
  if (!informativa && (ctx.estado === "HORARIO" || ctx.estado === "SERVICO") && ctx.opcoes?.length) {
    const escolha = lerEscolha(atualizado, ctx.opcoes);
    if (escolha !== null) return { ...base, tipo: "ESCOLHA", escolha };
    if (ctx.estado === "SERVICO" && servicoId && acharServico(atualizado, ctx.servicos)) {
      const indice = ctx.servicos.findIndex((s) => s.id === servicoId);
      if (indice >= 0 && ctx.opcoes.some((o) => o.n === indice + 1)) {
        return { ...base, tipo: "ESCOLHA", escolha: indice + 1 };
      }
    }
  }

  if (ctx.estado === "CONVITE" && !informativa && !HORARIO.test(t)) {
    if (NEGA.test(t)) return { ...base, tipo: "NEGA" };
    if (CONFIRMA.test(t)) return { ...base, tipo: "CONFIRMA" };
  }

  const pedeLivre = /\b(livre|vago|vaga|disponivel|marcar|agendar)\b/.test(t);
  if (FUNCIONAMENTO_DIRETO.test(t) && !pedeLivre) return { ...base, tipo: "FUNCIONAMENTO" };
  if (/\b(qual|quais) (e |sao )?(o |os )?horarios? de voces\b|\bhorario de voces\b/.test(t) && !pedeLivre) {
    return { ...base, tipo: "FUNCIONAMENTO" };
  }

  const citouDia = Boolean(pedido.dia || pedido.periodo || pedido.aPartirDe !== undefined);
  const pedidoPositivo = t.replace(/\bnao (?:quero|preciso|vou|desejo) (?:agendar|marcar)(?: agora)?\b/g, "");
  if (HORARIO.test(pedidoPositivo) || (citouDia && (servicoId || profissional)) || (citouDia && atualizado.split(" ").length <= 3)) {
    return { ...base, tipo: "HORARIO" };
  }

  if (PRECO.test(t)) return { ...base, tipo: "PRECO" };
  if (DURACAO.test(t)) return { ...base, tipo: "DURACAO" };
  if (IDENTIDADE.test(t)) return { ...base, tipo: "IDENTIDADE" };
  if (ENDERECO.test(t)) return { ...base, tipo: "ENDERECO" };
  if (PAGAMENTO.test(t)) return { ...base, tipo: "PAGAMENTO" };
  if (AGRADECIMENTO.test(t) && t.split(" ").length <= 6) return { ...base, tipo: "AGRADECIMENTO" };
  if (isPureGreeting(texto) || /^(oi+|ola+|opa|e ai|eae|oie)\W*$/.test(t)) return { ...base, tipo: "SAUDACAO" };

  return { ...base, tipo: "LIVRE" };
}

/** Perguntas compostas preservam todas as partes; ações sensíveis têm prioridade. */
export function detectarIntencoes(texto: string, ctx: ContextoDaIntencao): Intencao[] {
  const principal = detectarIntencao(texto, ctx);
  if (["URGENCIA", "DESMARCAR", "PESSOA", "RECLAMACAO", "ESCOLHA", "CONFIRMA", "NEGA"].includes(principal.tipo)) return [{ ...principal, texto }];
  // Separa perguntas, preservando nomes como "Corte e Barba" e "Pix e cartão".
  const partes = texto.split(/[?;\n]+|(?:,\s*|\s+e\s+)(?=(?:quanto|qual|quais|que horas|onde|como|tem|voc[eê]s|aceita|aceitam|faz|fazem|dura|demora)\b)/i)
    .map((parte) => parte.trim().replace(/^e\s+/i, "")).filter(Boolean);
  const itens: Intencao[] = [];
  let servicoDaParteAnterior = ctx.servicoAtualId;
  const historicoDasPartes = [...(ctx.historico ?? [])];
  for (const parte of partes) {
    const intencao = detectarIntencao(parte, { ...ctx, servicoAtualId: servicoDaParteAnterior, historico: historicoDasPartes });
    if (intencao.servicoId) servicoDaParteAnterior = intencao.servicoId;
    else if ((intencao.servicoIds?.length ?? 0) > 1) servicoDaParteAnterior = undefined;
    const t = normalizarTexto(parte);
    if (partes.length > 1 && /^(?:na verdade|corrigindo|quis dizer|melhor dizendo|em vez disso)$/.test(t)) continue;
    const reconhecidas: TipoDeIntencao[] = [];
    for (const [padrao, tipo] of [
      [PRECO, "PRECO"], [DURACAO, "DURACAO"], [ENDERECO, "ENDERECO"],
      [PAGAMENTO, "PAGAMENTO"], [IDENTIDADE, "IDENTIDADE"],
      [FUNCIONAMENTO_DIRETO, "FUNCIONAMENTO"],
    ] as const) {
      if (padrao.test(t)) reconhecidas.push(tipo);
    }
    if (intencao.tipo === "HORARIO" || intencao.tipo === "FUNCIONAMENTO") reconhecidas.push(intencao.tipo);
    if (/\b(?:vaga|vagas|livre|livres|agendar|marcar|encaixe|disponibilidade)\b/.test(t.replace(/\bnao (?:quero|preciso|vou|desejo) (?:agendar|marcar)(?: agora)?\b/g, ""))) reconhecidas.push("HORARIO");
    const tipos = [...new Set(reconhecidas)];
    for (const tipo of tipos.length ? tipos : [intencao.tipo]) {
      if (partes.length > 1 && ["SAUDACAO", "AGRADECIMENTO"].includes(tipo)) continue;
      itens.push({ ...intencao, tipo, texto: partes.length === 1 ? texto : parte });
    }
    historicoDasPartes.push({ role: "CUSTOMER", content: parte });
  }
  return itens.length ? itens : [{ ...principal, texto }];
}
