import type { ConfiguracaoNexa, InformacaoNexa, ServicoNexa } from "./configuracao-schema";
import type { EstadoConversaConfiguracao, PerguntaDeConfiguracao } from "./conversa-schema";
import { fontesDoDialogoConfiguracao, type FonteDialogoConfiguracao } from "./conversa-dialogo";
import { lacunasDoDialogoConfiguracao, proximaPerguntaDaConfiguracao } from "./conversa-motor";
import { estadoParaPerguntas } from "./conversa-conducao";
import { TOPICOS_CONFIGURACAO, type TopicoConfiguracao } from "./configuracao-topicos";

const PREFERIDO = 8000;
const MAXIMO = 10000;
const normalizar = (v: string) => v.normalize("NFD").replace(/\p{M}/gu, "").toLowerCase().replace(/\s+/g, " ").trim();
const VAZIAS = new Set("a ao aos as com como da das de do dos e ela ele em entre essa esse esta este eu isso ja mais me meu minha na nas nao no nos o os ou para pela pelo por qual quais quando que quem quero saber se sem seu sua tem ter um uma voces voce sobre empresa atendente pode posso preciso gostaria favor aqui muito nosso nossa desse dessa fazer funciona funcionamento informacao informacoes".split(" "));
function termos(v: string): Set<string> {
  return new Set((normalizar(v).match(/[a-z0-9]{2,}/g) ?? []).filter(t => !VAZIAS.has(t)).map(t =>
    /^(?:precos?|valores?|custa|custam)$/.test(t) ? "preco"
      : /^(?:agendar|agendamento|agendamentos|reservar|reservas?)$/.test(t) ? "agenda"
      : /^(?:cancelar|cancelamento|cancelamentos)$/.test(t) ? "cancelar"
      : /^(?:pagamentos?|pagar)$/.test(t) ? "pagamento"
      : t.replace(/s$/, "")));
}
function coincidencias(v: string, consulta: Set<string>): number {
  let pontos = 0;
  for (const termo of termos(v)) if (consulta.has(termo)) pontos++;
  return pontos;
}
const tamanho = (v: unknown) => JSON.stringify(v).length;
const clonar = <T>(v: T): T => structuredClone(v);
type ServicoDoContexto = Pick<ServicoNexa, "id" | "nome" | "precoModo" | "precoCents" | "duracaoMin" | "situacao"> & { descricao?: string };
type CadastroDoContexto = {
  negocio: Pick<ConfiguracaoNexa["negocio"], "nome" | "segmento" | "modalidade" | "objetivo"> & { descricao?: InformacaoNexa };
  servicos: ServicoDoContexto[];
  regras: Array<{ id: string; pergunta: string; situacao: string }>;
  atendimento: Omit<ConfiguracaoNexa["atendimento"], "handoffKeywords"> & { handoffKeywords?: string[] };
  endereco?: InformacaoNexa; regiao?: InformacaoNexa; pagamento?: InformacaoNexa;
  horarios?: ConfiguracaoNexa["informacoes"]["horarios"];
  horariosSituacao?: ConfiguracaoNexa["informacoes"]["horariosSituacao"];
  diasFechados?: string[];
};
type ContextoDoDialogo = {
  PERGUNTA_ATUAL: PerguntaDeConfiguracao | null;
  TOPICO_ATUAL: typeof TOPICOS_CONFIGURACAO[number] | null;
  CADASTRO: CadastroDoContexto;
  HISTORICO_RECENTE: Array<{ de: "dono" | "atendente"; texto: string }>;
  MENSAGEM_ATUAL: string;
  FONTES_DIALOGO: FonteDialogoConfiguracao[];
  LACUNA_PRIORITARIA?: PerguntaDeConfiguracao;
  LACUNAS?: PerguntaDeConfiguracao[];
  MEMORIA_CONVERSA: {
    camposAdiados: string[]; assunto: TopicoConfiguracao | null; servicoEmFocoId: string | null;
    categorias: string[]; listaServicosConcluida: boolean;
  };
};

type MemoriaSemantica = { servicoEmFocoId: string | null; categorias: string[]; listaServicosConcluida: boolean };

/** Contexto de uma única empresa, selecionado antes da chamada ao modelo. Não grava nem consulta serviços externos. */
export function contextoParaDialogoConfiguracao(c: ConfiguracaoNexa, conversa: EstadoConversaConfiguracao,
  texto: string, pergunta: PerguntaDeConfiguracao | null, topico?: TopicoConfiguracao | null): ContextoDoDialogo {
  if (texto.length > 6000) throw new RangeError("A mensagem de configuração excedeu o limite de 6.000 caracteres.");
  const recentes = conversa.mensagens.slice(-80);
  const consulta = termos(texto);
  const contextoRecente = [pergunta?.texto ?? "", ...recentes.slice(-4).map(m => m.texto.slice(0, 400))].join(" ");
  const consultaRecente = termos(contextoRecente);
  const textoNormal = normalizar(texto);
  const memoriaSemantica = (conversa as EstadoConversaConfiguracao & { memoriaSemantica?: MemoriaSemantica }).memoriaSemantica;
  const chaves = [pergunta?.chave, conversa.perguntaPendente?.chave, conversa.ultimaPergunta].filter((v): v is string => Boolean(v));
  const alvoDaPergunta = chaves.map(chave => c.informacoes.servicos.find(s => {
    const campo = chave.replace(/^esclarecimento:/, "");
    return campo === `servico:${s.id}` || campo.startsWith(`servico:${s.id}:`);
  })).find((s): s is ServicoNexa => Boolean(s));
  const alvoDaMemoria = c.informacoes.servicos.find(s => s.id === memoriaSemantica?.servicoEmFocoId);
  const citado = (s: ServicoNexa) => normalizar(s.nome).length >= 2 && textoNormal.includes(normalizar(s.nome));
  const citados = c.informacoes.servicos.filter(citado);
  // Uma referência explícita nova pode trocar o assunto da pergunta anterior.
  // Para respostas curtas, a pergunta em aberto prevalece sobre a memória antiga.
  const alvo = (citados.length === 1 ? citados[0] : undefined) ?? alvoDaPergunta ?? alvoDaMemoria;
  const servicos = c.informacoes.servicos.map((s, i) => ({ s, i, pontos: (s.id === alvo?.id ? 10000 : 0) + (citado(s) ? 3000 : 0)
    + coincidencias(`${s.nome} ${s.descricao}`, consulta) * 100 + coincidencias(s.nome, consultaRecente) * 10 }))
    .sort((a, b) => b.pontos - a.pontos || a.i - b.i);
  const principal = alvo ?? servicos.find(({ s }) => citado(s))?.s;
  const resumoServico = (s: ServicoNexa): ServicoDoContexto => ({ id: s.id, nome: s.nome, precoModo: s.precoModo,
    precoCents: s.precoCents, duracaoMin: s.duracaoMin, situacao: s.situacao });
  const { handoffKeywords: _assuntos, ...atendimento } = c.atendimento;
  const contexto: ContextoDoDialogo = {
    PERGUNTA_ATUAL: pergunta ? clonar(pergunta) : null,
    TOPICO_ATUAL: TOPICOS_CONFIGURACAO.find(t => t.id === topico) ?? null,
    CADASTRO: { negocio: { nome: c.negocio.nome, segmento: c.negocio.segmento, modalidade: c.negocio.modalidade, objetivo: c.negocio.objetivo },
      servicos: principal ? [resumoServico(principal)] : [], regras: [], atendimento: clonar(atendimento) },
    HISTORICO_RECENTE: [], MENSAGEM_ATUAL: texto, FONTES_DIALOGO: [],
    MEMORIA_CONVERSA: {
      camposAdiados: [...(conversa.camposAdiados ?? [])], assunto: topico ?? conversa.topicoAtual ?? null,
      servicoEmFocoId: principal?.id ?? null,
      categorias: Array.isArray(memoriaSemantica?.categorias) ? [...memoriaSemantica.categorias] : [],
      listaServicosConcluida: memoriaSemantica?.listaServicosConcluida === true,
    },
  };
  // Conteúdo obrigatório não é cortado silenciosamente para cumprir o orçamento.
  if (tamanho(contexto) > MAXIMO) throw new RangeError("O contexto obrigatório da configuração excedeu o orçamento seguro.");
  const adicionar = (aplicar: () => void, desfazer: () => void, prioritario = false) => {
    aplicar();
    if (tamanho(contexto) > (prioritario ? MAXIMO : Math.max(PREFERIDO, tamanhoMinimo))) { desfazer(); return false; }
    return true;
  };
  const tamanhoMinimo = tamanho(contexto);
  // A fala recente é o contexto da correção, não um apêndice que sobra depois
  // dos documentos. Conservamos turnos inteiros e pares dono/resposta.
  type EntradaDeHistoria = { m: typeof recentes[number]; i: number };
  const blocos: EntradaDeHistoria[][] = [];
  for (let i = 0; i < recentes.length; i++) {
    const atual = { m: recentes[i], i };
    if (atual.m.de === "dono" && recentes[i + 1]?.de === "atendente") {
      blocos.push([atual, { m: recentes[i + 1], i: i + 1 }]); i++;
    } else blocos.push([atual]);
  }
  const historiaIncluida = new Map<number, EntradaDeHistoria>();
  const incluirBloco = (bloco: EntradaDeHistoria[]) => {
    const novos = bloco.filter(e => !historiaIncluida.has(e.i));
    if (!novos.length) return true;
    if (historiaIncluida.size + novos.length > 10) return false;
    const previa = contexto.HISTORICO_RECENTE;
    return adicionar(() => {
      for (const e of novos) historiaIncluida.set(e.i, e);
      contexto.HISTORICO_RECENTE = [...historiaIncluida.values()].sort((a, b) => a.i - b.i).map(({ m }) => ({ de: m.de, texto: m.texto }));
    }, () => {
      for (const e of novos) historiaIncluida.delete(e.i);
      contexto.HISTORICO_RECENTE = previa;
    }, true);
  };
  const ultimosBlocos = blocos.slice(-4).reverse();
  for (const [i, bloco] of ultimosBlocos.entries()) {
    // Se o último par inteiro não cabe, a última mensagem ainda pode orientar
    // a resposta. O texto permanece inteiro, inclusive suas ressalvas.
    if (!incluirBloco(bloco) && i === 0) incluirBloco(bloco.slice(-1));
  }
  const indiceAntigo = blocos.length - 4;
  const blocoAntigoPertinente = blocos.slice(0, Math.max(0, indiceAntigo)).map((bloco, i) => ({ bloco, i,
    pontos: bloco.reduce((total, { m }) => total + coincidencias(m.texto, consulta) * (m.de === "dono" ? 80 : 25), 0) }))
    .filter(b => b.pontos > 0).sort((a, b) => b.pontos - a.pontos || b.i - a.i)[0];
  if (blocoAntigoPertinente) incluirBloco(blocoAntigoPertinente.bloco);
  for (const bloco of blocos.slice().reverse()) {
    if (historiaIncluida.size >= 10) break;
    incluirBloco(bloco);
  }
  const estadoDasPerguntas = estadoParaPerguntas(c, conversa);
  const lacunas = lacunasDoDialogoConfiguracao(c, estadoDasPerguntas, topico);
  adicionar(() => { contexto.LACUNAS = clonar(lacunas); }, () => { delete contexto.LACUNAS; });
  const produto = (id: string): number => {
    const mensagem = textoNormal;
    const duvida = /\?/.test(mensagem) || /^(?:como|qual|quais|quando|quanto|nao entendi|ajuda|me ajude|oi|ola|por onde)\b/.test(mensagem);
    if (!duvida) return 0;
    const bate = (re: RegExp) => re.test(mensagem) ? 1500 : 0;
    if (id === "produto:objetivo") return bate(/\b(?:pedidos?|solicitacoes?|objetivos?|vs|versus)\b/) + (pergunta?.chave === "atendimento.objetivo" ? 800 : 0);
    if (id === "produto:teste") return bate(/\b(?:teste|testar|testes|simular|simulador|simulacao|experimente|experimentar)\b/);
    if (id === "produto:conexao") return bate(/\b(?:whatsapp|conectar|conexao|aparelhos?|codigo|qr)\b/);
    if (id === "produto:agenda") return bate(/\b(?:agenda|agendar|agendamento|agendamentos|reserva|reservar|remarcar|cancelar)\b/) + (topico === "ATENDIMENTO" ? 100 : 0);
    if (id === "produto:humano") return bate(/\b(?:humano|pessoa|equipe|assumir|transferir|transbordo)\b/);
    if (id === "produto:servicos") return /\b(?:configurar|configuro|configuracao|cadastrar|cadastro|informar|ensinar|preencher)\b/.test(mensagem)
      ? bate(/\b(?:servicos?|produtos?|precos?|valores?|duracao)\b/) : 0;
    if (id === "produto:topicos") return bate(/\b(?:ajuda|ajude|configurar|configuracao|comecar|continuar|entendi)\b|^(?:oi|ola|como funciona|por onde)/)
      || (!consulta.size ? 1500 : 0);
    return 0;
  };
  const itensPorFonte = new Map(c.conhecimento.itens.map(item => [`regra:${item.id}`, item]));
  const servicosPorFonte = new Map(c.informacoes.servicos.map(item => [`servico:${item.id}`, item]));
  const fontes = fontesDoDialogoConfiguracao(c).map((fonte, i) => {
    const item = itensPorFonte.get(fonte.id);
    const servico = servicosPorFonte.get(fonte.id);
    const alvoRegra = item && chaves.some(chave => chave.replace(/^esclarecimento:/, "").startsWith(`pergunta:${item.id}:`));
    const produtoScore = fonte.id.startsWith("produto:") ? produto(fonte.id) : 0;
    const pontos = fonte.id.startsWith("produto:") ? produtoScore : (alvoRegra ? 5000 : 0) + (servico && servico.id === alvo?.id ? 5000 : 0) + (servico && citado(servico) ? 4000 : 0)
      + coincidencias(item?.pergunta ?? (servico ? `${servico.nome} ${servico.descricao}` : fonte.texto), consulta) * (item || servico ? 180 : 40)
      + coincidencias(fonte.texto, consulta) * 20 + coincidencias(item?.pergunta ?? fonte.texto, consultaRecente) * 5;
    return { fonte, i, pontos, prioritario: produtoScore >= 1000 || Boolean(alvoRegra) || Boolean(servico && (citado(servico) || servico.id === alvo?.id)) };
  }).filter(f => f.pontos > 0).sort((a, b) => b.pontos - a.pontos || a.i - b.i);
  for (const { fonte, prioritario } of fontes) {
    if (contexto.FONTES_DIALOGO.length >= 6) break;
    // Fontes autorizam fatos: mantemos o texto completo, inclusive a última restrição.
    adicionar(() => contexto.FONTES_DIALOGO.push(clonar(fonte)), () => { contexto.FONTES_DIALOGO.pop(); }, prioritario);
  }
  const infoInteira = (campo: "endereco" | "pagamento" | "regiao", valor: InformacaoNexa) => {
    adicionar(() => { contexto.CADASTRO[campo] = clonar(valor); }, () => { delete contexto.CADASTRO[campo]; });
  };
  infoInteira("endereco", c.informacoes.endereco);
  infoInteira("pagamento", c.informacoes.pagamento);
  infoInteira("regiao", c.negocio.regiao);
  adicionar(() => { contexto.CADASTRO.horarios = clonar(c.informacoes.horarios); contexto.CADASTRO.horariosSituacao = c.informacoes.horariosSituacao; },
    () => { delete contexto.CADASTRO.horarios; delete contexto.CADASTRO.horariosSituacao; });
  if (c.informacoes.diasFechados.length) adicionar(() => { contexto.CADASTRO.diasFechados = [...c.informacoes.diasFechados]; }, () => { delete contexto.CADASTRO.diasFechados; });
  // O cadastro é a fotografia atual. A conversa preservada acima permite à IA
  // interpretar a correção nova, inclusive de um rótulo cadastrado errado.
  for (const { s } of servicos) {
    if (contexto.CADASTRO.servicos.length >= 12) break;
    if (s.id === principal?.id) continue;
    adicionar(() => contexto.CADASTRO.servicos.push(resumoServico(s)), () => { contexto.CADASTRO.servicos.pop(); });
  }
  const regras = c.conhecimento.itens.map((item, i) => ({ item, i,
    pontos: coincidencias(item.pergunta, consulta) * 10 + coincidencias(item.pergunta, consultaRecente) }))
    .sort((a, b) => b.pontos - a.pontos || a.i - b.i).slice(0, 8);
  for (const { item } of regras) adicionar(() => contexto.CADASTRO.regras.push({ id: item.id, pergunta: item.pergunta.slice(0, 120), situacao: item.situacao }), () => { contexto.CADASTRO.regras.pop(); });
  for (const s of contexto.CADASTRO.servicos) {
    const original = c.informacoes.servicos.find(item => item.id === s.id)!;
    if (original.descricao && original.descricao.length <= 160) adicionar(() => { s.descricao = original.descricao; }, () => { delete s.descricao; });
  }
  if (c.negocio.descricao.valor.length <= 300) adicionar(() => { contexto.CADASTRO.negocio.descricao = clonar(c.negocio.descricao); }, () => { delete contexto.CADASTRO.negocio.descricao; });
  if (c.atendimento.handoffKeywords.length) adicionar(() => { contexto.CADASTRO.atendimento.handoffKeywords = [...c.atendimento.handoffKeywords]; }, () => { delete contexto.CADASTRO.atendimento.handoffKeywords; });
  const lacuna = proximaPerguntaDaConfiguracao(c, { ...estadoDasPerguntas, perguntaPendente: null, perguntaSuspensa: false }, topico);
  if (lacuna && lacuna.chave !== pergunta?.chave) adicionar(() => { contexto.LACUNA_PRIORITARIA = clonar(lacuna); }, () => { delete contexto.LACUNA_PRIORITARIA; });
  return contexto;
}
