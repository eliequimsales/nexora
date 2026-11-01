import { randomUUID } from "node:crypto";
import { z } from "zod";
import type { ConfiguracaoNexa, HorarioNexa, InformacaoNexa, ServicoNexa } from "./configuracao-schema";
import type { EstadoConversaConfiguracao, PerguntaDeConfiguracao } from "./conversa-schema";
import { centavosInformados, duracaoInformada, proporPreenchimento } from "./preenchimento";
import { campoPertenceAoTopico, type TopicoConfiguracao } from "./configuracao-topicos";
import { aplicarHorariosDaConversa, horariosDaConversaSchema, FORMATO_HORARIOS_DA_CONVERSA } from "./conversa-horarios";
import { aplicarSemanticaDosServicos, semanticaDoServicoSchema, conducaoDaConversaSchema, FORMATO_SEMANTICA_DO_SERVICO, FORMATO_CONDUCAO_DA_CONVERSA } from "./conversa-semantica";

const normalizar = (v: string) => v.normalize("NFD").replace(/\p{M}/gu, "").toLowerCase().replace(/\s+/g, " ").trim();
const info = (valor: string): InformacaoNexa => ({ valor: valor.trim(), situacao: "CONFIRMADO", origem: "ASSISTENTE" });
const sim = (v: string) => /^(?:sim|isso|isso mesmo|correto|correta|estao corretos|estao corretas|esta correto|esta correta|confirmo|pode confirmar|pode usar|pode manter|esta certo|tudo certo|exatamente|ok)[.!\s]*$/.test(normalizar(v));
const naoSei = (v: string) => /^(?:nao sei|ainda nao sei|definir depois|depois|pular|pule|nao tenho essa informacao|nao informado|nao informar)[.!\s]*$/.test(normalizar(v));
const ajuda = (v: string) => /^(?:oi|ola|bom dia|boa tarde|boa noite|ajuda|me ajude|me ajuda|como funciona|o que eu preciso fazer|nao entendi)[?!.\s]*$/.test(normalizar(v));
const pergunta = (chave: string, texto: string, sugestoes: string[] = []): PerguntaDeConfiguracao => ({ chave, texto, sugestoes });
const VALOR = /(?:R\$\s*|\bpor\s+|\bcust(?:a|am)\s+|\bvalor\s*:?\s*)((?:\d{1,3}(?:\.\d{3})+|\d+)(?:,\d{1,2})?)(?!\d|[.,]\d)/i;
const DINHEIRO = /R\$|\breais?\b|\b(?:custa|valor|pre[cç]o)\b/i;
const CONDICIONAL = /\b(?:a partir|depende|vari[aá]vel|aproximad[oa]|cerca de|talvez|exemplo|hipot[eé]tico|desconto|promo[cç][aã]o)\b/i;
const INSTRUCAO = /\b(?:ignore (?:as|suas|todas)|invente|finja|fingir|prompt|system prompt|companyId|senha|token|api key)\b/i;
const encurtar = (s: string) => s.length > 360 ? `${s.slice(0, 357)}…` : s;

function horarioTexto(horarios: HorarioNexa[]) {
  const dias = ["domingo", "segunda", "terça", "quarta", "quinta", "sexta", "sábado"];
  const grupos = new Map<string, number[]>();
  for (const h of horarios.filter(h => !h.closed).sort((a, b) => a.day - b.day)) {
    const chave = `${h.open}–${h.close}`; grupos.set(chave, [...(grupos.get(chave) ?? []), h.day]);
  }
  return [...grupos].map(([horario, semana]) => {
    const consecutivos = semana.every((d, i) => i === 0 || d === semana[i - 1] + 1);
    const quando = semana.length === 7 ? "todos os dias" : semana.length > 2 && consecutivos ? `${dias[semana[0]]} a ${dias[semana.at(-1)!]}` : semana.map(d => dias[d]).join(" e ");
    return `${quando}, ${horario}`;
  }).join("; ");
}

/** Sinais gerais de apresentação/categoria; não deduz procedimentos por segmento. */
function nomeDeServicoAmplo(texto: string): boolean {
  const n = normalizar(texto);
  if (/^(?:s[oó]|s[oó] (?:esses?|estes?|isso)|so (?:esses?|estes?|isso)|apenas (?:esses?|estes?|isso)|[eé] s[oó]|fechou|acabou|nada mais)$/.test(n)) return false;
  return /^(?:todos|todas|ambos|ambas|eles|elas|ele|ela|os dois|as duas|os outros|as outras|o primeiro|a primeira|o segundo|a segunda)\b/.test(n)
    || /\b(?:etc|em geral|servicos gerais|produtos gerais|entre outros|entre outras|todo tipo|todos os tipos|de tudo|varios|varias|diversos|diversas|variados|variadas|ampla variedade)\b/.test(n)
    || /\b(?:servicos?|produtos?|solucoes?|atendimentos?)\s+(?:em|na area|nas areas|do ramo|do segmento)\b/.test(n)
    || /\b(?:somos|oferecemos|trabalhamos|realizamos|atendemos)\b/.test(n);
}

function detalharServicos(evidencia: string): PerguntaDeConfiguracao {
  return pergunta("esclarecimento:informacoes.servicos", "Quais serviços vocês fazem nessa área?");
}

/** A evidência precisa estar numa declaração, mesmo quando outra oração faz uma pergunta. */
function evidenciaDeclarativa(texto: string, evidencia: string): boolean {
  const equivalente = (s: string) => s.normalize("NFD").replace(/\p{M}/gu, "").toLowerCase().replace(/[ \t]+/g, " ");
  texto = equivalente(texto); evidencia = equivalente(evidencia);
  const oracoes: Array<{ inicio: number; fim: number; declarativa: boolean }> = [];
  const separadores = /[?!;]\s*|\.(?=\s|$)\s*|\n+|,(?=\s*(?:como|qual|quais|quanto|posso|podemos|pode|poderia|voce pode|você pode)\b)\s*/giu;
  let inicio = 0;
  const adicionar = (fim: number) => {
    const trecho = normalizar(texto.slice(inicio, fim));
    const retomada = /^como (?:(?:eu )?ja |eu )?(?:disse|falei|expliquei|comentei)\b/.test(trecho);
    const interrogativa = /\?/.test(trecho) || !retomada && /^(?:quanto|qual|quais|como|posso|podemos|poderia|voce pode|voce sabe|o que|por que|sera|gostaria de saber|quero saber|preciso saber|me explique|explique|me diga)\b/.test(trecho);
    oracoes.push({ inicio, fim, declarativa: Boolean(trecho) && !interrogativa });
  };
  for (const m of texto.matchAll(separadores)) {
    adicionar((m.index ?? 0) + (/^[?!;]/.test(m[0]) ? 1 : 0));
    inicio = (m.index ?? 0) + m[0].length;
  }
  adicionar(texto.length);
  let posicao = texto.indexOf(evidencia);
  while (posicao >= 0) {
    const trechos = oracoes.filter(o => o.fim > posicao && o.inicio < posicao + evidencia.length);
    if (trechos.length && trechos.every(o => o.declarativa)) return true;
    posicao = texto.indexOf(evidencia, posicao + 1);
  }
  return false;
}

function nomeLiteralPlausivel(valor: string, evidencia = valor): boolean {
  const n = normalizar(valor); const e = normalizar(evidencia);
  if (/[?;\n]/.test(valor) || /^(?:nao|sim|um|uma|sou|somos|ofereco|oferecemos|atendo|atendemos|trabalho|trabalhamos|tenho|temos|aceito|aceitamos|quero|prefiro|pode|chame|chamar|meu nome|o nome|nome da)\b/.test(n)
    || /\b(?:explique|entender|funciona|pode chamar|quero chamar|pode usar)\b/.test(n)) return false;
  if (/^(?:trabalhamos|atendemos|oferecemos)\b/.test(e) && !/\b(?:nome|chama|chamar|chame)\b/.test(e)) return false;
  if (/^(?:sou|somos)\s+(?:um|uma)\b/.test(e) && !/\b(?:nome|chama|chamar|chame)\b/.test(e)) return false;
  return true;
}

/** Próxima lacuna concreta; nenhuma chamada de IA, escrita ou pergunta inventada. */
export function proximaPerguntaDaConfiguracao(c: ConfiguracaoNexa, estado: Pick<EstadoConversaConfiguracao, "ignoradas" | "perguntaPendente" | "perguntaSuspensa"> = { ignoradas: [] }, topico?: TopicoConfiguracao | null): PerguntaDeConfiguracao | null {
  if (estado.perguntaSuspensa) return null;
  const pertence = (chave: string) => campoPertenceAoTopico(chave, topico);
  if (estado.perguntaPendente && pertence(estado.perguntaPendente.chave)) return estado.perguntaPendente;
  const ignorada = (chave: string) => estado.ignoradas.includes(chave);
  if (pertence("negocio.nome") && !ignorada("negocio.nome") && (c.negocio.nome.trim().length < 2 || normalizar(c.negocio.nome) === "minha empresa")) return pergunta("negocio.nome", "Qual é o nome da sua empresa?");
  if (pertence("negocio.segmento") && !ignorada("negocio.segmento") && c.negocio.segmento.trim().length < 2) return pergunta("negocio.segmento", "Com o que a sua empresa trabalha?");
  if (pertence("informacoes.servicos") && !c.informacoes.servicos.length && !ignorada("informacoes.servicos")) {
    return pergunta("informacoes.servicos", "O que você vende ou quais serviços faz? Pode me contar do seu jeito.");
  }
  for (const s of c.informacoes.servicos) {
    if (!pertence(`servico:${s.id}`)) continue;
    if (ignorada(`servico:${s.id}`)) continue;
    if (s.situacao === "NAO_APLICA" || s.situacao === "NAO_INFORMADO") continue;
    if (nomeDeServicoAmplo(s.nome)) return detalharServicos(s.nome);
    if (s.situacao === "REVISAR" && !ignorada(`servico:${s.id}`)) {
      const preco = s.precoModo === "FIXO" && s.precoCents !== null ? `, ${(s.precoCents / 100).toLocaleString("pt-BR", { style: "currency", currency: "BRL" })}` : s.precoModo === "SOB_CONSULTA" ? ", valor sob consulta" : "";
      return pergunta(`servico:${s.id}:revisar`, `Tenho ${s.nome}${preco}${s.duracaoMin ? ` e duração de ${s.duracaoMin} minutos` : ""}. Essas informações estão corretas?`, ["Estão corretas", "Quero corrigir"]);
    }
    if (s.precoModo === "FIXO" && s.precoCents === null && !ignorada(`servico:${s.id}:preco`)) return pergunta(`servico:${s.id}:preco`, `Qual é o valor de ${s.nome}? Se variar, pode explicar como funciona.`, ["Valor sob consulta"]);
    if (!s.duracaoMin && !ignorada(`servico:${s.id}:duracao`)) return pergunta(`servico:${s.id}:duracao`, `Quanto tempo dura ${s.nome}?`, ["Não tem duração fixa"]);
  }
  if (pertence("atendimento.objetivo") && c.negocio.objetivo === "DUVIDAS" && c.atendimento.agendamento === "DESLIGADO" && !ignorada("atendimento.objetivo")) {
    return pergunta("atendimento.objetivo", "Além de tirar dúvidas, você quer que seu atendente ajude com pedidos ou agendamentos?", ["Só responder dúvidas", "Receber pedidos para minha equipe", "Ajudar com agendamentos"]);
  }
  if (pertence("negocio.descricao") && c.negocio.descricao.situacao === "REVISAR" && !ignorada("negocio.descricao")) return pergunta("negocio.descricao:revisar", `Tenho esta apresentação: “${encurtar(c.negocio.descricao.valor)}”. Ela está correta?`, ["Está correta", "Quero corrigir"]);
  // O cadastro antigo sugeria ONLINE quando faltava endereço. Ausência de
  // endereço não comprova atendimento online; a conversa esclarece a modalidade.
  if (pertence("negocio.modalidade") && c.negocio.modalidade === "ONLINE" && c.informacoes.endereco.situacao !== "NAO_APLICA" && !ignorada("negocio.modalidade")) {
    return pergunta("negocio.modalidade", "Você atende em um endereço, online ou vai até o cliente?", ["Em um endereço", "Atendo online", "Vou até o cliente"]);
  }
  if (pertence("informacoes.endereco") && ["PRESENCIAL", "HIBRIDO"].includes(c.negocio.modalidade) && (c.informacoes.endereco.situacao !== "CONFIRMADO" || !c.informacoes.endereco.valor.trim()) && !ignorada("informacoes.endereco")) {
    if (c.informacoes.endereco.valor.trim()) return pergunta("informacoes.endereco:revisar", `O endereço que posso informar é ${encurtar(c.informacoes.endereco.valor)}. Está correto?`, ["Está correto", "Atendo online"]);
    return pergunta("informacoes.endereco", "Qual endereço devo informar aos clientes?", ["Atendo online", "Vou até o cliente"]);
  }
  if (pertence("negocio.regiao") && c.negocio.modalidade === "DOMICILIO" && (c.negocio.regiao.situacao !== "CONFIRMADO" || !c.negocio.regiao.valor.trim()) && !ignorada("negocio.regiao")) return pergunta("negocio.regiao", "Em quais bairros ou cidades você atende?");
  if (pertence("informacoes.horarios") && c.informacoes.horariosSituacao !== "CONFIRMADO" && !ignorada("informacoes.horarios")) {
    if (c.informacoes.horarios.length === 7) return pergunta("informacoes.horarios:revisar", `Tenho estes horários: ${encurtar(horarioTexto(c.informacoes.horarios))}. Estão corretos?`, ["Estão corretos", "Quero corrigir"]);
    if (c.informacoes.horarios.length) return pergunta("informacoes.horarios:restantes", `Anotei ${encurtar(horarioTexto(c.informacoes.horarios))}. Nos outros dias a empresa fica fechada?`, ["Sim, fica fechada", "Atendo em outros dias também"]);
    return pergunta("informacoes.horarios", "Quais dias e horários a empresa atende?");
  }
  if (pertence("informacoes.pagamento") && (c.informacoes.pagamento.situacao !== "CONFIRMADO" || !c.informacoes.pagamento.valor.trim()) && !ignorada("informacoes.pagamento")) {
    if (c.informacoes.pagamento.valor.trim()) return pergunta("informacoes.pagamento:revisar", `As formas de pagamento são: ${encurtar(c.informacoes.pagamento.valor)}. Está correto?`, ["Está correto", "Quero corrigir"]);
    return pergunta("informacoes.pagamento", "Quais formas de pagamento vocês aceitam?", ["Pix e cartão", "Pix, cartão e dinheiro", "Definir depois"]);
  }
  if (pertence("atendimento.nome") && c.atendimento.nome.trim().length < 2) return pergunta("atendimento.nome", "Como você quer apresentar seu atendente aos clientes?", ["Atendente virtual"]);
  if (pertence("atendimento.agendamento") && c.negocio.objetivo === "AGENDAMENTOS" && c.atendimento.agendamento === "DESLIGADO" && !ignorada("atendimento.agendamento")) return pergunta("atendimento.agendamento", "Nos agendamentos, o atendente pode confirmar um horário livre ou deve enviar o link para o cliente escolher?", ["Pode confirmar horários livres", "Enviar o link", "Por enquanto, só tirar dúvidas"]);
  const regra = c.conhecimento.itens.find(i => pertence(`pergunta:${i.id}`) && i.situacao === "REVISAR" && !ignorada(`pergunta:${i.id}`));
  if (pertence("atendimento.gestaoReservas") && c.atendimento.agendamento === "DIRETO" && !c.atendimento.gestaoReservas && !ignorada("atendimento.gestaoReservas")) return pergunta("atendimento.gestaoReservas", "Seu atendente também pode alterar ou cancelar uma reserva quando o próprio cliente pedir?", ["Pode remarcar e cancelar", "Só pode remarcar", "Só pode cancelar", "Minha equipe cuida disso"]);
  if (pertence("atendimento.antecedenciaHoras") && c.atendimento.agendamento === "DIRETO" && (c.atendimento.gestaoReservas?.cancelar || c.atendimento.gestaoReservas?.remarcar) && c.atendimento.gestaoReservas.antecedenciaHoras === null && !ignorada("atendimento.antecedenciaHoras")) return pergunta("atendimento.antecedenciaHoras", "Com quantas horas de antecedência o cliente pode alterar ou cancelar? Escreva 0 se não houver prazo mínimo.", ["24 horas", "12 horas", "0 horas"]);
  if (regra) return pergunta(`pergunta:${regra.id}:revisar`, `Para “${encurtar(regra.pergunta)}”, tenho: “${encurtar(regra.resposta)}”. Essa resposta está correta?`, ["Está correta", "Quero corrigir"]);
  if (pertence("conhecimento") && !c.conhecimento.itens.some(i => i.situacao === "CONFIRMADO") && !ignorada("conhecimento")) return pergunta("conhecimento", "Tem alguma regra importante que seu cliente precisa saber?", ["Não tenho regra extra", "Definir depois"]);
  return null;
}

function minutos(texto: string): number | null {
  const t = normalizar(texto);
  if (/\b(?:abrimos|fechamos|funcionamos|expediente|abertura|fechamento|entre|varia|depende|aproximadamente)\b/.test(t) || /\d{1,2}(?:h(?:\d{2})?|:\d{2})?\s*(?:as|ate|a|ou|-)\s*\d{1,2}(?:h|:|\b)/.test(t)) return null;
  return duracaoInformada(texto);
}

/** Uma evidência pode conter vários serviços: cada valor precisa do seu próprio sujeito. */
function trechosDoServico(evidencia: string, nome: string, nomes: string[]): string[] {
  const t = normalizar(evidencia);
  const alvo = normalizar(nome);
  const catalogo = [...new Set(nomes.map(normalizar))];
  const escapar = (v: string) => v.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
  const mencoes: Array<{ nome: string; inicio: number; fim: number }> = [];
  for (const servico of catalogo) {
    const padroes = [new RegExp(`(?<![a-z0-9])${escapar(servico)}(?![a-z0-9])`, "g")];
    for (const palavra of servico.match(/[a-z]{4,}/g) ?? []) {
      if (catalogo.filter(outro => outro.split(/\s+/).includes(palavra)).length === 1) {
        padroes.push(new RegExp(`\\b(?:o|a|do|da|esse|essa|este|esta)\\s+${escapar(palavra)}\\b`, "g"));
      }
    }
    for (const padrao of padroes) for (const m of t.matchAll(padrao)) {
      mencoes.push({ nome: servico, inicio: m.index!, fim: m.index! + m[0].length });
    }
  }
  const ordenadas = mencoes.sort((a, b) => a.inicio - b.inicio || b.fim - a.fim);
  const unicas: typeof mencoes = [];
  for (const m of ordenadas) if (!unicas.some(outra => m.inicio < outra.fim && m.fim > outra.inicio)) unicas.push(m);
  if (!unicas.length || unicas.every(m => m.nome === alvo)) return [t];
  return unicas.flatMap((m, i) => m.nome === alvo ? [t.slice(m.inicio, unicas[i + 1]?.inicio ?? t.length)] : []);
}

function minutosDoServico(evidencia: string, nome: string, nomes: string[]): number | null {
  const t = normalizar(evidencia);
  const unica = (trecho: string) => {
    const valores = [...trecho.matchAll(/\b(\d{1,4})\s*(?:minutos?|min)\b/g)].map(m => Number(m[1]));
    if (new Set(valores).size > 1) return null;
    return minutos(trecho);
  };
  const grupo = /\b(?:as duas|os dois|ambos|ambas|cada uma|cada um)\b[^.;!?]{0,45}\b(?:duram?|levam?|demoram?|duracao|tempo)\b/.test(t);
  const comum = grupo ? unica(t) : null;
  if (comum !== null) return comum;
  const duracoes = trechosDoServico(evidencia, nome, nomes).flatMap(trecho => {
    const valor = unica(trecho);
    return valor === null ? [] : [valor];
  });
  return duracoes.length && new Set(duracoes).size === 1 ? duracoes[0] : null;
}

function precoDoServico(evidencia: string, nome: string, nomes: string[], contextual: boolean): number | null {
  const t = normalizar(evidencia);
  const unico = (trecho: string) => {
    const valores = trecho.match(new RegExp(VALOR.source, "gi")) ?? trecho.match(/\b\d+(?:,\d{1,2})?\s*reais?\b/gi) ?? [];
    return valores.length <= 1 ? preco(trecho, contextual) : null;
  };
  const grupo = /\b(?:as duas|os dois|ambos|ambas|cada uma|cada um)\b[^.;!?]{0,45}\b(?:custam?|cobram?|precos?|valores?)\b|\b(?:custam?|cobram?)\b[^.;!?]{0,25}\bcada\b/.test(t);
  const comum = grupo ? unico(t) : null;
  if (comum !== null) return comum;
  const valores = trechosDoServico(evidencia, nome, nomes).flatMap(trecho => {
    const valor = unico(trecho);
    return valor === null ? [] : [valor];
  });
  return valores.length && new Set(valores).size === 1 ? valores[0] : null;
}
function preco(texto: string, contextual = false): number | null {
  if (CONDICIONAL.test(texto) || /\b(?:n[aã]o|nunca|exceto|parcelas?|parcelad[oa])\b|\b\d{1,2}\s*x\b/i.test(texto)) return null;
  const m = texto.match(VALOR) ?? texto.match(/\b(\d+(?:,\d{1,2})?)\s*reais?\b/i) ?? (contextual ? texto.trim().match(/^(\d+(?:,\d{1,2})?)[.!]?$/) : null);
  return m ? centavosInformados(m[1]) : null;
}
function servicoDaChave(c: ConfiguracaoNexa, chave: string): ServicoNexa | undefined {
  return c.informacoes.servicos.find(s => chave.startsWith(`servico:${s.id}:`));
}
function servicosDeclarados(texto: string): Array<{ nome: string; precoCents: number | null; duracaoMin: number | null; sobConsulta: boolean }> {
  const achados: Array<{ nome: string; precoCents: number | null; duracaoMin: number | null; sobConsulta: boolean }> = [];
  const linhas: string[] = [];
  for (const frase of texto.split(/[;\n]|,\s*(?=[\p{L}])|(?<=[.!])\s+(?=[A-ZÀ-Ý])/u)) {
    let prefixo = "";
    for (const parte of frase.split(/\s+e\s+(?!(?:meia\b|(?:dez|quinze|vinte|trinta|quarenta|cinquenta)\s+minutos?\b))(?=[\p{L}])/u)) {
      const combinada = prefixo ? `${prefixo} e ${parte}` : parte;
      if (VALOR.test(parte) || /(?:pre[cç]o|valor)\s+sob consulta/i.test(parte)) { linhas.push(combinada); prefixo = ""; }
      else prefixo = combinada;
    }
    if (prefixo) linhas.push(prefixo);
  }
  for (const linha of linhas) {
    if (linha.includes("?") || CONDICIONAL.test(linha) || /\b(?:n[aã]o|nunca|aceit[oa]|aceitamos|pagamento|endere[cç]o|abrimos|fechamos|funcionamos|expediente)\b/i.test(linha)) continue;
    const moeda = linha.match(VALOR); const sobConsulta = /(?:pre[cç]o|valor)\s+sob consulta/i.test(linha);
    if (!moeda && !sobConsulta) continue;
    const duracao = linha.search(/\b(?:\d{1,4}|uma|meia)\s*(?:minutos?|min|horas?|h)\b/i);
    const fim = Math.min(...[moeda?.index ?? -1, duracao, linha.search(/(?:pre[cç]o|valor)\s+sob consulta/i)].filter(i => i >= 0));
    const nome = linha.slice(0, fim).trim().replace(/^(?:fa[cç]o|ofere[cç]o|oferecemos|temos|trabalhamos com|servi[cç]os?\s*:)\s*/i, "").replace(/\s+(?:de|com|por|custa|valor|pre[cç]o)\s*:?\s*$/i, "").trim();
    if (!/^[\p{L}][\p{L}\s()/-]{1,139}$/u.test(nome) || /^(?:a |o |nossa |nosso )?(?:empresa|atendente|consulta da agenda|horario)/i.test(nome)) continue;
    const v = sobConsulta ? null : preco(linha); if (!sobConsulta && v === null) continue;
    achados.push({ nome, precoCents: v, duracaoMin: minutos(linha), sobConsulta });
  }
  return achados;
}
function confirmarCampo(c: ConfiguracaoNexa, chave: string): string | null {
  const s = servicoDaChave(c, chave);
  if (s && chave.endsWith(":revisar")) { s.situacao = "CONFIRMADO"; return s.nome; }
  const campos: Record<string, InformacaoNexa> = { "negocio.descricao": c.negocio.descricao, "negocio.regiao": c.negocio.regiao, "informacoes.endereco": c.informacoes.endereco, "informacoes.pagamento": c.informacoes.pagamento };
  const campo = campos[chave.replace(/:revisar$/, "")];
  if (campo?.valor.trim()) { campo.situacao = "CONFIRMADO"; return "informação confirmada"; }
  if (chave === "informacoes.horarios:revisar") { c.informacoes.horariosSituacao = "CONFIRMADO"; return "horários"; }
  const item = c.conhecimento.itens.find(i => chave === `pergunta:${i.id}:revisar`);
  if (item) { item.situacao = "CONFIRMADO"; return "resposta confirmada"; }
  return null;
}

const literal = z.string().trim().min(1).max(3000);
const campoTexto = z.object({ valor: literal, evidencia: literal }).strict();
const campoEnum = <T extends [string, ...string[]]>(valores: T) => z.object({ valor: z.enum(valores), evidencia: literal }).strict();
const CAMPOS_ESCLARECIMENTO = [
  "negocio.nome", "negocio.segmento", "negocio.descricao", "negocio.modalidade", "negocio.regiao", "negocio.objetivo",
  "informacoes.servicos", "informacoes.endereco", "informacoes.horarios", "informacoes.pagamento",
  "atendimento.nome", "atendimento.jeito", "atendimento.quando", "atendimento.agendamento",
  "atendimento.gestaoReservas", "atendimento.antecedenciaHoras", "conhecimento",
] as const;
const esclarecimentoSchema = z.object({
  campo: z.enum(CAMPOS_ESCLARECIMENTO), evidencia: literal, pergunta: z.string().trim().min(5).max(500),
  sugestoes: z.array(z.string().trim().min(1).max(140)).max(4).optional(),
}).strict();
const continuacaoSchema = z.object({
  campo: z.string().trim().min(2).max(300), pergunta: z.string().trim().min(5).max(360),
  sugestoes: z.array(z.string().trim().min(1).max(140)).max(4),
}).strict();
export const extracaoDeConversaSchema = z.object({
  nome: campoTexto.nullable(), segmento: campoTexto.nullable(), descricao: campoTexto.nullable(), endereco: campoTexto.nullable(), regiao: campoTexto.nullable(), pagamento: campoTexto.nullable(), nomeAtendente: campoTexto.nullable(),
  modalidade: campoEnum(["PRESENCIAL", "ONLINE", "DOMICILIO", "HIBRIDO"]).nullable(),
  objetivo: campoEnum(["DUVIDAS", "SOLICITACOES", "AGENDAMENTOS"]).nullable(),
  jeito: campoEnum(["ACOLHEDOR", "DIRETO", "DESCONTRAIDO"]).nullable(),
  quando: campoEnum(["FORA_EXPEDIENTE", "APOIO_EXPEDIENTE"]).nullable(),
  agendamento: campoEnum(["DESLIGADO", "LINK", "DIRETO"]).nullable(),
  horarios: horariosDaConversaSchema,
  servicos: z.array(z.object({ nome: z.string().trim().min(2).max(140), evidencia: literal, precoCents: z.number().int().min(0).max(100000000).nullable(), duracaoMin: z.number().int().min(1).max(1440).nullable(), sobConsulta: z.boolean(), descricao: z.string().trim().max(1500).nullable(), ...semanticaDoServicoSchema.shape }).strict()).max(30),
  conducao: conducaoDaConversaSchema,
  perguntas: z.array(z.object({ pergunta: z.string().trim().min(2).max(500), resposta: literal, evidencia: literal }).strict()).max(12),
  esclarecimento: esclarecimentoSchema.nullable().default(null),
  continuacao: continuacaoSchema.nullable().default(null),
  dialogo: z.object({ intencao: z.enum(["INFORMAR", "PERGUNTAR", "CORRIGIR", "MISTO"]),
    resposta: z.string().trim().min(1).max(2500).nullable(), fontesIds: z.array(z.string().trim().min(1).max(180)).max(20),
  }).strict().nullable().default(null),
}).strict();
export type ExtracaoDeConversa = z.infer<typeof extracaoDeConversaSchema>;

const jsonTexto = { type: "object", properties: { valor: { type: "string" }, evidencia: { type: "string" } }, required: ["valor", "evidencia"], additionalProperties: false };
const enumJson = (valores: string[]) => ({ type: "object", properties: { valor: { type: "string", enum: valores }, evidencia: { type: "string" } }, required: ["valor", "evidencia"], additionalProperties: false });
const nullable = (schema: unknown) => ({ anyOf: [schema, { type: "null" }] });
export const FORMATO_EXTRACAO_CONVERSA = {
  name: "configuracao_por_conversa",
  schema: {
    type: "object", additionalProperties: false,
    properties: {
      ...Object.fromEntries(["nome", "segmento", "descricao", "endereco", "regiao", "pagamento", "nomeAtendente"].map(k => [k, nullable(jsonTexto)])),
      modalidade: nullable(enumJson(["PRESENCIAL", "ONLINE", "DOMICILIO", "HIBRIDO"])), objetivo: nullable(enumJson(["DUVIDAS", "SOLICITACOES", "AGENDAMENTOS"])),
      jeito: nullable(enumJson(["ACOLHEDOR", "DIRETO", "DESCONTRAIDO"])), quando: nullable(enumJson(["FORA_EXPEDIENTE", "APOIO_EXPEDIENTE"])), agendamento: nullable(enumJson(["DESLIGADO", "LINK", "DIRETO"])),
      servicos: { type: "array", items: { type: "object", additionalProperties: false, properties: { nome: { type: "string" }, evidencia: { type: "string" }, precoCents: { type: ["integer", "null"] }, duracaoMin: { type: ["integer", "null"] }, sobConsulta: { type: "boolean" }, descricao: { type: ["string", "null"] }, ...FORMATO_SEMANTICA_DO_SERVICO }, required: ["nome", "evidencia", "precoCents", "duracaoMin", "sobConsulta", "descricao", "operacao", "servicoId", "categoria", "condicaoPreco"] } },
      conducao: FORMATO_CONDUCAO_DA_CONVERSA,
      horarios: FORMATO_HORARIOS_DA_CONVERSA,
      perguntas: { type: "array", items: { type: "object", additionalProperties: false, properties: { pergunta: { type: "string" }, resposta: { type: "string" }, evidencia: { type: "string" } }, required: ["pergunta", "resposta", "evidencia"] } },
      esclarecimento: nullable({ type: "object", additionalProperties: false, properties: {
        campo: { type: "string", enum: [...CAMPOS_ESCLARECIMENTO] }, evidencia: { type: "string" }, pergunta: { type: "string" },
        sugestoes: { type: "array", items: { type: "string" } },
      }, required: ["campo", "evidencia", "pergunta", "sugestoes"] }),
      continuacao: nullable({ type: "object", additionalProperties: false, properties: {
        campo: { type: "string" }, pergunta: { type: "string" }, sugestoes: { type: "array", items: { type: "string" } },
      }, required: ["campo", "pergunta", "sugestoes"] }),
      dialogo: { type: "object", additionalProperties: false, properties: {
        intencao: { type: "string", enum: ["INFORMAR", "PERGUNTAR", "CORRIGIR", "MISTO"] },
        resposta: { type: ["string", "null"] }, fontesIds: { type: "array", items: { type: "string" } },
      }, required: ["intencao", "resposta", "fontesIds"] },
    },
    required: ["nome", "segmento", "descricao", "endereco", "regiao", "pagamento", "nomeAtendente", "modalidade", "objetivo", "jeito", "quando", "agendamento", "servicos", "horarios", "perguntas", "esclarecimento", "continuacao", "dialogo", "conducao"],
  },
};

export { PROMPT_EXTRACAO_CONVERSA } from "./conversa-instrucoes";

/** Lacunas reais que o modelo pode escolher ou reformular; não acrescentam fatos ao cadastro. */
export function lacunasDoDialogoConfiguracao(c: ConfiguracaoNexa,
  estado: Pick<EstadoConversaConfiguracao, "ignoradas" | "perguntaPendente" | "perguntaSuspensa"> = { ignoradas: [] },
  topico?: TopicoConfiguracao | null): PerguntaDeConfiguracao[] {
  const ignoradas = [...estado.ignoradas];
  const lacunas: PerguntaDeConfiguracao[] = [];
  for (let tentativa = 0; tentativa < 8 && lacunas.length < 5; tentativa++) {
    const q = proximaPerguntaDaConfiguracao(c, { ignoradas, perguntaPendente: null, perguntaSuspensa: false }, topico);
    if (!q || lacunas.some(item => item.chave === q.chave)) break;
    lacunas.push(q);
    const chave = q.chave.replace(/^esclarecimento:/, "");
    ignoradas.push(chave);
    if (/^servico:.+:revisar$/.test(chave)) ignoradas.push(chave.replace(/:revisar$/, ""));
    if (chave === "informacoes.servicos") {
      for (const s of c.informacoes.servicos.filter(s => nomeDeServicoAmplo(s.nome))) ignoradas.push(`servico:${s.id}`);
    }
  }
  // Continuar uma lista não significa cadastrar um serviço fictício nem exigir outro item.
  if ((!topico || topico === "SERVICOS") && c.informacoes.servicos.length && !estado.ignoradas.includes("informacoes.servicos") && !lacunas.some(q => q.chave === "informacoes.servicos")) {
    lacunas.unshift(pergunta("informacoes.servicos", "Quais outros serviços você quer incluir na lista?"));
    if (lacunas.length > 5) lacunas.pop();
  }
  return lacunas;
}


/** A IA pode formular a pergunta; seu alvo precisa continuar sendo uma lacuna do estado real. */
export function perguntaDeContinuacaoConfiguracao(extracao: unknown, c: ConfiguracaoNexa,
  estado: Pick<EstadoConversaConfiguracao, "ignoradas" | "perguntaPendente" | "perguntaSuspensa"> = { ignoradas: [] },
  topico?: TopicoConfiguracao | null): PerguntaDeConfiguracao | null {
  if (!extracao || typeof extracao !== "object") return null;
  const valor = (extracao as Record<string, unknown>).continuacao;
  if (!valor) return null;
  const parsed = continuacaoSchema.safeParse(valor);
  if (!parsed.success) return null;
  const pedido = parsed.data;
  let alvo = lacunasDoDialogoConfiguracao(c, estado, topico).find(q => q.chave === pedido.campo);
  const condicao = pedido.campo.match(/^servico:(.+):(condicaoPreco|preco)$/);
  const servicoCondicional = condicao && c.informacoes.servicos.find(s => s.id === condicao[1] && s.precoModo === "SOB_CONSULTA" && /condi[cç][aã]o de pre[cç]o:/i.test(s.descricao));
  if (!alvo && servicoCondicional && (!topico || topico === "SERVICOS") && !estado.ignoradas.includes(pedido.campo)) {
    alvo = pergunta(`servico:${servicoCondicional.id}:condicaoPreco`, `${servicoCondicional.nome}. ${servicoCondicional.descricao}`);
  }
  if (!alvo) return null;
  const texto = pedido.pergunta; const n = normalizar(texto);
  if (INSTRUCAO.test(texto) || /https?:\/\/|\b(?:credenciais?|segredos?|secret|password|bearer)\b|[\r\n\u0000-\u001f<>]/i.test(texto)
    || (texto.match(/\?/g)?.length ?? 0) !== 1 || !texto.endsWith("?")
    || /\b(?:salvei|registrei|anotei|conectei|ativei|publiquei|reservei|agendei|cancelei|remarquei|enviei|conclui|finalizei)\b/.test(n)
    || (texto.match(/\d+(?:[.,:]\d+)*/g) ?? []).some(numero => !alvo.texto.includes(numero))) return null;
  // O alvo vem do contrato e do estado da empresa. A redação não precisa usar
  // um dicionário fechado de palavras ou copiar uma pergunta do formulário.
  const sugestoes = pedido.sugestoes.filter(s => !INSTRUCAO.test(s) && !/https?:\/\/|senha|token|password/i.test(s)
    && (s.match(/\d+(?:[.,:]\d+)*/g) ?? []).every(numero => alvo!.texto.includes(numero)));
  return pergunta(alvo.chave, texto, sugestoes);
}

export type ResultadoDoPreenchimentoConversa = { rascunho: ConfiguracaoNexa; ignoradas: string[]; alteracoes: string[]; remapeamentosIds?: Record<string, string>; aviso?: string; resposta?: string; esclarecimento?: PerguntaDeConfiguracao };

/** Aplica somente evidências da fala do responsável; preço/duração e permissões são conferidos novamente. */
export function preencherPorConversa(atual: ConfiguracaoNexa, texto: string, estado: Pick<EstadoConversaConfiguracao, "ignoradas" | "perguntaPendente" | "perguntaSuspensa" | "memoriaSemantica">,
  extracao?: unknown, novoId = () => `novo:${randomUUID()}`): ResultadoDoPreenchimentoConversa {
  let c = structuredClone(atual); const ignoradas = [...estado.ignoradas]; const alteracoes: string[] = [];
  const q = proximaPerguntaDaConfiguracao(atual, estado); const chave = (q?.chave ?? "").replace(/^esclarecimento:/, "");
  const t = texto.trim(); const n = normalizar(t);
  const semPergunta = evidenciaDeclarativa(t, t);
  const parsed = extracaoDeConversaSchema.safeParse(extracao);
  // Só a proposta fechada que está visível pode ser confirmada por um 'sim'.
  // A pergunta aberta e as mensagens antigas não autorizam fatos novos.
  const propostaConfirmada = q?.chave.startsWith("esclarecimento:") && sim(t)
    ? q.texto.match(/^Voc[eê] quis dizer (?:que )?([^?\r\n]+)\?$/i)?.[1]?.trim() : undefined;
  const partes = (evidencia: string) => evidencia.split(/(?<=[.!?;])\s+|\n+/u).map(p => p.trim().replace(/[.!?;]+$/, "")).filter(Boolean);
  const contem = (fonte: string, evidencia: string) => { const trechos = partes(evidencia); return trechos.length > 0 && trechos.every(p => normalizar(fonte).includes(normalizar(p))); };
  const provado = (evidencia: string) => (contem(t, evidencia) || Boolean(propostaConfirmada && contem(propostaConfirmada, evidencia)))
    && !INSTRUCAO.test(evidencia) && !/\b(?:talvez|exemplo|hipot[eé]tico)\b/i.test(evidencia);
  const declarado = (evidencia: string) => provado(evidencia) && partes(evidencia).every(p => evidenciaDeclarativa(t, p)
    || Boolean(propostaConfirmada && evidenciaDeclarativa(propostaConfirmada, p)));
  const ressalvaOmitida = (evidencia: string) => {
    const e = normalizar(evidencia);
    const oracoes = (propostaConfirmada ?? t).split(/(?<=[.!?;])\s+|\n+|\b(?:mas|por[eé]m)\b/iu).map(normalizar).filter(Boolean);
    const ressalvas = /\b(?:nao|nunca|exceto|somente|apenas|depende|se|quando|ate|varia|variavel|parcelas?|parcelad[oa])\b|\ba partir\b/g;
    return partes(evidencia).some(p => {
      const trecho = normalizar(p);
      return oracoes.some(oracao => oracao.includes(trecho) && [...oracao.matchAll(ressalvas)].some(m => !e.includes(m[0])));
    });
  };
  const semantica = parsed.success ? aplicarSemanticaDosServicos(c, parsed.data.servicos, t, { propostaConfirmada }) : null;
  if (semantica) { c = semantica.rascunho; alteracoes.push(...semantica.alteracoes); }
  const focoId = estado.memoriaSemantica?.servicoEmFocoId;
  const alvo = servicoDaChave(c, chave) ?? (focoId && !q ? c.informacoes.servicos.find(s => s.id === (semantica?.remapeamentosIds[focoId] ?? focoId)) : undefined);
  const servicosInterpretados = parsed.success ? parsed.data.servicos.map(s => {
    const id = s.servicoId ? semantica?.remapeamentosIds[s.servicoId] ?? s.servicoId : null;
    const existente = id ? c.informacoes.servicos.find(v => v.id === id) : null;
    return existente ? { ...s, servicoId: existente.id, nome: existente.nome } : s;
  }).filter(s => {
    const existente = c.informacoes.servicos.find(v => s.servicoId ? v.id === (semantica?.remapeamentosIds[s.servicoId] ?? s.servicoId) : normalizar(v.nome) === normalizar(s.nome));
    // A IA pode resolver referências ao cadastro; elas nunca autorizam criar um nome novo.
    const referenciaContextual = Boolean(existente) && /\b(?:todos|todas|ambos|ambas|ele|ela|eles|elas|os dois|as duas|os outros|as outras|os demais|as demais|o primeiro|a primeira|o segundo|a segunda|o terceiro|a terceira|o ultimo|a ultima|esse servico|este servico|aquele servico|esses servicos|estes servicos)\b/.test(normalizar(s.evidencia));
    const nomes = normalizar(existente?.nome ?? "").match(/[a-z]{4,}/g) ?? [];
    const referenciaCurta = Boolean(existente) && nomes.some(parte => new RegExp(`\\b(?:o|a|do|da) ${parte}\\b`).test(normalizar(s.evidencia))
      && atual.informacoes.servicos.filter(v => normalizar(v.nome).split(/\s+/).includes(parte)).length === 1);
    return declarado(s.evidencia) && !ressalvaOmitida(s.evidencia) && !/\b(?:nao|nunca|exceto|menos)\b/.test(normalizar(s.evidencia))
      && !nomeDeServicoAmplo(s.nome) && (normalizar(s.evidencia).includes(normalizar(s.nome)) || Boolean(s.servicoId && existente) || referenciaContextual || referenciaCurta || alvo?.id === existente?.id && Boolean(alvo));
  }) : [];
  let campoAmbiguo: string | undefined = semantica?.esclarecimento ? "informacoes.servicos" : undefined;
  let esclarecimento: PerguntaDeConfiguracao | undefined = semantica?.esclarecimento;
  const pedido = parsed.success ? parsed.data.esclarecimento : null;
  const perguntaSegura = (valor: string) => !INSTRUCAO.test(valor) && !/\b(?:credenciais?|segredo|secret|password)\b|https?:\/\//i.test(valor)
    && (valor.match(/\?/g)?.length ?? 0) === 1 && valor.endsWith("?") && !/[\r\n]/.test(valor)
    && (valor.match(/\d+(?:[.,]\d+)*/g) ?? []).every(numero => t.includes(numero));
  if (!esclarecimento && pedido && provado(pedido.evidencia) && perguntaSegura(pedido.pergunta)) {
    campoAmbiguo = pedido.campo;
    const chaveDaPergunta = pedido.campo === "informacoes.servicos" && chave.startsWith("servico:") ? chave : pedido.campo;
    esclarecimento = pergunta(`esclarecimento:${chaveDaPergunta}`, pedido.pergunta,
      (pedido.sugestoes ?? []).filter(s => provado(s)));
  }
  const perguntaDeAlvoNoDialogo = parsed.success ? parsed.data.dialogo?.resposta : null;
  if (!esclarecimento && !servicosInterpretados.length && perguntaDeAlvoNoDialogo && perguntaSegura(perguntaDeAlvoNoDialogo)
    && /^(?:por favor[, ]+)?(?:muda|mude|altera|altere|atualiza|atualize|corrija|corrige|troca|troque|renomeie|remova|quero (?:mudar|alterar|atualizar|corrigir))\b/.test(n)
    && /\b(?:preco|valor|duracao|servicos?|produtos?)\b/.test(n) && !alvo
    && atual.informacoes.servicos.length > 1 && atual.informacoes.servicos.filter(s => n.includes(normalizar(s.nome))).length !== 1) {
    // O modelo pode formular a dúvida no diálogo em vez do campo estruturado.
    // Recuperamos só a escolha de alvo, sem aproveitar preços nem fatos novos.
    const citados = atual.informacoes.servicos.filter(s => normalizar(perguntaDeAlvoNoDialogo).includes(normalizar(s.nome)));
    campoAmbiguo = "informacoes.servicos";
    esclarecimento = pergunta("esclarecimento:informacoes.servicos", "Qual serviço você quer alterar?",
      (citados.length ? citados : atual.informacoes.servicos).slice(0, 4).map(s => s.nome));
  }
  if (!parsed.success && !esclarecimento && semPergunta && !servicosInterpretados.length && nomeDeServicoAmplo(t.replace(/^(?:ofere[cç]o|oferecemos|temos|trabalhamos com|fazemos|realizamos)\s+/i, ""))
    && (chave === "informacoes.servicos" || /\b(?:servicos?|produtos?|ofereco|oferecemos|trabalhamos)\b/.test(n))) {
    campoAmbiguo = "informacoes.servicos"; esclarecimento = detalharServicos(t);
  }
  const bloqueado = (campo: string) => campoAmbiguo === campo;
  const anotarInformacao = (campo: string, destino: InformacaoNexa, valor: string, evidencia: string): boolean => {
    if (campo === "informacoes.endereco" && /\b(?:complemento|no mesmo endereco|acrescente|inclua)\b/.test(normalizar(evidencia))) {
      const anterior = atual.informacoes.endereco;
      if (!anterior.valor.trim() || anterior.situacao !== "CONFIRMADO") {
        esclarecimento = pergunta("esclarecimento:informacoes.endereco", "Qual é o endereço completo para eu acrescentar esse complemento?");
        return false;
      }
      if (!normalizar(valor).includes(normalizar(anterior.valor))) {
        const partes = anterior.valor.split(/,\s*/);
        const prefixo = valor.match(/^(?:sala|apartamento|apto|bloco|andar|loja|fundos)\b/i)?.[0];
        const indice = prefixo ? partes.findIndex(p => normalizar(p).startsWith(`${normalizar(prefixo)} `)) : -1;
        if (indice >= 0) partes[indice] = valor;
        else if (!normalizar(anterior.valor).includes(normalizar(valor))) partes.push(valor);
        valor = partes.join(", ");
      }
    }
    Object.assign(destino, info(valor)); return true;
  };
  // Um contrato válido também pode concluir que nenhum serviço foi declarado.
  // Não substituímos essa interpretação por um catálogo criado por regex.
  const usarFallbackServicos = semPergunta && !parsed.success && !bloqueado("informacoes.servicos");
  const usarDeclaracoesObjetivas = usarFallbackServicos;
  const ignorar = (k: string) => { if (!ignoradas.includes(k)) ignoradas.push(k); };
  const resultado = (extras: Partial<ResultadoDoPreenchimentoConversa> = {}): ResultadoDoPreenchimentoConversa => ({ rascunho: c, ignoradas: ignoradas.slice(-150), alteracoes: [...new Set(alteracoes)], ...(semantica ? { remapeamentosIds: semantica.remapeamentosIds } : {}), ...(esclarecimento ? { esclarecimento } : {}), ...extras });
  const conducao = parsed.success ? parsed.data.conducao : null;
  const conducaoValida = Boolean(conducao && semPergunta && provado(conducao.evidencia));
  const encerrouLista = conducaoValida && conducao?.listaServicos === "CONCLUIDA" && c.informacoes.servicos.length > 0;
  if (encerrouLista) ignorar("informacoes.servicos");
  if (conducaoValida && conducao?.listaServicos === "REABRIR") { const i = ignoradas.indexOf("informacoes.servicos"); if (i >= 0) ignoradas.splice(i, 1); }
  const fimDaLista = n.replace(/[.,;!]+/g, " ").replace(/\s+/g, " ").trim();
  const padraoFimDaLista = /^(?:(?:por enquanto )?nao (?:tenho|temos|ha) (?:outros?|mais)(?: servicos?| produtos?)?(?: (?:sao )?(?:so|apenas) (?:esses|estes))?|(?:sao|esses sao|estes sao) (?:(?:so|apenas) )?(?:esses|estes|todos)(?: os servicos?)?|(?:esses|estes) sao (?:todos )?os (?:meus |nossos )?servicos|(?:a )?lista(?: de servicos)? (?:esta )?(?:completa|finalizada)|(?:ja )?(?:passei|informei|listei) todos(?: os servicos?)?|s[oó]|s[oó] (?:esses?|estes?|isso)(?: mesmo)?|so (?:esses?|estes?|isso)(?: mesmo)?|apenas (?:esses?|estes?|isso)|[eé] s[oó](?: (?:esses?|estes?|isso))?|fechou|acabou|nada mais|(?:por enquanto )?s[oó](?: (?:esses?|estes?|isso))?|(?:por enquanto )?nao tem mais(?: nada)?)$/i;
  const listaEncerrada = semPergunta && c.informacoes.servicos.some(s => !nomeDeServicoAmplo(s.nome))
    && padraoFimDaLista.test(fimDaLista);
  if (listaEncerrada && (chave === "informacoes.servicos" || chave.startsWith("servico:") || chave.startsWith("esclarecimento:informacoes.servicos") || /\b(?:servicos?|lista|esses?|isso|so|apenas|fechou|acabou)\b/.test(n))) {
    ignorar("informacoes.servicos");
    return resultado({ esclarecimento: undefined, resposta: "Perfeito, vamos seguir com os serviços que você informou." });
  }
  if (ajuda(t)) return resultado({ resposta: "Pode responder com suas palavras. Vou organizar as informações e perguntar só o que ainda faltar." });
  if (INSTRUCAO.test(t)) return resultado({ esclarecimento: undefined, resposta: "Aqui você pode me ensinar serviços, valores, horários e regras da empresa. Informações não confirmadas continuam em branco." });
  if (/\b(?:cliente|paciente|fulano) (?:disse|falou|acha|achou)|\b(?:me disseram|ouvi dizer|suponha|hipoteticamente)\b/.test(n)) return resultado({ resposta: "Entendi o relato. Qual é a informação ou regra confirmada pela sua empresa que devo usar no atendimento?" });
  if (/^nao tenho regra extra[.!]*$/.test(n) && chave === "conhecimento") {
    ignorar("conhecimento"); return resultado({ resposta: "Tudo certo, sem regras adicionais por enquanto." });
  }
  if (naoSei(t) || /^nao tem duracao fixa[.!]*$/.test(n)) {
    if (chave.startsWith("negocio.nome") || chave.startsWith("negocio.segmento") || !chave) return resultado({ resposta: "Tudo bem. Essa informação é necessária para identificar o negócio; pode me contar quando souber." });
    ignorar(chave.replace(/:(?:revisar|restantes)$/, ""));
    if (chave.includes(":duracao")) ignorar(chave);
    return resultado({ resposta: "Deixei esse ponto para depois. Ele não será completado por suposição." });
  }
  if (!propostaConfirmada && (sim(t) || n === "sim, fica fechada" || n === "estao corretas")) {
    if (chave === "informacoes.horarios:restantes") {
      const existentes = new Map(c.informacoes.horarios.map(h => [h.day, h]));
      c.informacoes.horarios = Array.from({ length: 7 }, (_, day) => existentes.get(day) ?? { day, open: "", close: "", closed: true });
      c.informacoes.horariosSituacao = "CONFIRMADO"; alteracoes.push("Horários de funcionamento");
    } else { const confirmado = confirmarCampo(c, chave); if (confirmado) alteracoes.push(confirmado); }
    return resultado({ ...(alteracoes.length ? {} : { resposta: "Para evitar uma configuração errada, preciso que você escreva a informação ou escolha uma das opções da pergunta." }) });
  }
  if (propostaConfirmada && alvo && chave.endsWith(":preco")) {
    // Aprovação de uma proposta escalar exata não depende de o modelo repetir
    // o número. Campo, serviço e valor já foram mostrados juntos ao responsável.
    const nome = normalizar(alvo.nome).replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
    const proposta = normalizar(propostaConfirmada);
    if (new RegExp(`^(?:o |a )?${nome} custa (?:r\\$\\s*)?\\d+(?:[.,]\\d+)*$`).test(proposta)) {
      const valor = preco(proposta);
      if (valor !== null) { alvo.precoModo = "FIXO"; alvo.precoCents = valor; alteracoes.push(`Preço: ${alvo.nome}`); }
    }
  }
  if (/^quero corrigir[.!]*$/.test(n)) return resultado({ resposta: "Sem problema. Escreva a informação correta e eu atualizo o rascunho." });

  // Um contrato válido da IA governa quais campos foram informados nesta fala.
  // O parser legado só atua quando não houve essa interpretação estruturada.
  const proposta = semPergunta && !parsed.success ? proporPreenchimento(c, t, novoId).rascunho : structuredClone(c);
  for (const [a, b, label, campo] of [[c.negocio.descricao, proposta.negocio.descricao, "Apresentação", "negocio.descricao"], [c.informacoes.endereco, proposta.informacoes.endereco, "Endereço", "informacoes.endereco"], [c.informacoes.pagamento, proposta.informacoes.pagamento, "Formas de pagamento", "informacoes.pagamento"]] as const) {
    if (!bloqueado(campo) && a.valor !== b.valor && anotarInformacao(campo, a, b.valor, t)) alteracoes.push(label);
  }
  for (const p of usarDeclaracoesObjetivas ? servicosDeclarados(t).filter(s => !nomeDeServicoAmplo(s.nome)) : []) {
    const anterior = c.informacoes.servicos.find(s => normalizar(s.nome) === normalizar(p.nome));
    const s: ServicoNexa = { id: anterior?.id ?? novoId(), nome: p.nome, descricao: anterior?.descricao ?? "", precoModo: p.sobConsulta ? "SOB_CONSULTA" : "FIXO",
      precoCents: p.precoCents, duracaoMin: p.duracaoMin ?? anterior?.duracaoMin ?? null, situacao: anterior?.situacao === "REVISAR" ? "REVISAR" : "CONFIRMADO", origem: "ASSISTENTE" };
    if (anterior) Object.assign(anterior, s); else c.informacoes.servicos.push(s);
    alteracoes.push(`Serviço: ${s.nome}`);
  }
  if (!parsed.success && !bloqueado("informacoes.horarios") && JSON.stringify(c.informacoes.horarios) !== JSON.stringify(proposta.informacoes.horarios)) {
    c.informacoes.horarios = proposta.informacoes.horarios; c.informacoes.horariosSituacao = "REVISAR"; alteracoes.push("Horários informados");
  }
  for (const p of parsed.success || bloqueado("conhecimento") ? [] : proposta.conhecimento.itens) if (!c.conhecimento.itens.some(i => i.id === p.id && i.resposta === p.resposta)) {
    const i = c.conhecimento.itens.findIndex(i => i.id === p.id); const item = { ...p, situacao: "CONFIRMADO" as const };
    if (i >= 0) c.conhecimento.itens[i] = item; else c.conhecimento.itens.push(item); alteracoes.push("Resposta ensinada");
  }

  if (!parsed.success && semPergunta && !CONDICIONAL.test(t)) {
    if (!parsed.success && chave === "negocio.nome" && !bloqueado("negocio.nome") && campoAmbiguo !== "informacoes.servicos" && !alteracoes.length && t.length <= 140 && nomeLiteralPlausivel(t)) { c.negocio.nome = t; alteracoes.push("Nome da empresa"); }
    if (!parsed.success && chave === "negocio.segmento" && !bloqueado("negocio.segmento") && campoAmbiguo !== "informacoes.servicos" && !alteracoes.length && t.length <= 140) { c.negocio.segmento = t; alteracoes.push("Área de atuação"); }
    if (!parsed.success && chave === "atendimento.nome" && !bloqueado("atendimento.nome") && !alteracoes.length && nomeLiteralPlausivel(t)
      && !/\b(?:aceito|aceitamos|temos|ofereco|oferecemos|servicos?|pagamento|pix|cartao|endereco|funcionamos|atendemos)\b/.test(n)) {
      c.atendimento.nome = t.slice(0, 80); alteracoes.push("Apresentação do atendente");
    }
    if (/^(?:negocio.descricao|informacoes.endereco|informacoes.pagamento|negocio.regiao)(?::revisar)?$/.test(chave)) {
      const k = chave.replace(/:revisar$/, "");
      const tabela: Record<string, InformacaoNexa> = { "negocio.descricao": c.negocio.descricao, "informacoes.endereco": c.informacoes.endereco, "informacoes.pagamento": c.informacoes.pagamento, "negocio.regiao": c.negocio.regiao };
      // Uma resposta à pergunta atual descreve o campo, mas não absorve outra declaração já extraída.
      const compativel = k === "informacoes.pagamento" ? /\b(?:pix|cartao|dinheiro|boleto|credito|debito|cheque|transferencia)\b/.test(n)
        : k === "informacoes.endereco" ? !/\b(?:online|on-line|presencial|domicilio|pix|cartao|aceito|aceitamos)\b/.test(n) : true;
      if (!bloqueado(k) && compativel && !alteracoes.length && !/\b(?:temos|ofereco|oferecemos|servico|custa|duracao)\b/.test(n)
        && anotarInformacao(k, tabela[k], t, t)) alteracoes.push(k === "informacoes.pagamento" ? "Formas de pagamento" : "Informação do negócio");
    }
  }
  if (semPergunta && !bloqueado("negocio.modalidade") && /\b(?:atendo|atendemos|atendimento|somos)\b.*\b(?:online|on-line|virtual)\b/.test(n) && /\bpresencial\b/.test(n) && !/\bnao\b/.test(n)) {
    c.negocio.modalidade = "HIBRIDO"; alteracoes.push("Atendimento presencial e online");
  } else if (semPergunta && !bloqueado("negocio.modalidade") && /\b(?:atendo|atendemos|atendimento|somos)\b.*\b(?:online|on-line|virtual)\b/.test(n) && !/\bnao\b/.test(n)) {
    c.negocio.modalidade = "ONLINE"; c.informacoes.endereco = { valor: "", situacao: "NAO_APLICA", origem: "ASSISTENTE" }; alteracoes.push("Atendimento online");
  }
  if (semPergunta && !bloqueado("negocio.modalidade") && /^(?:em um endereco|tenho um endereco|atendimento presencial|atend(?:o|emos) (?:somente |so )?presencial(?:mente)?)[.!]*$/.test(n)) {
    c.negocio.modalidade = "PRESENCIAL";
    if (c.informacoes.endereco.situacao === "NAO_APLICA") c.informacoes.endereco = { valor: "", situacao: "NAO_INFORMADO", origem: "ASSISTENTE" };
    alteracoes.push("Atendimento presencial");
  }
  if (semPergunta && !bloqueado("negocio.modalidade") && (/^(?:vou|vamos) ate o cliente[.!]*$/.test(n) || /^atend(?:o|emos) a domicilio[.!]*$/.test(n))) { c.negocio.modalidade = "DOMICILIO"; c.informacoes.endereco = { valor: "", situacao: "NAO_APLICA", origem: "ASSISTENTE" }; alteracoes.push("Atendimento a domicílio"); }
  const outrosCitados = c.informacoes.servicos.some(s => s.id !== alvo?.id && normalizar(t).includes(normalizar(s.nome)));
  if (!parsed.success && !bloqueado("informacoes.servicos") && alvo && semPergunta && !outrosCitados) {
    if (chave.endsWith(":preco")) {
      if (/^(?:valor |preco )?sob consulta[.!]*$/.test(n)) { alvo.precoModo = "SOB_CONSULTA"; alvo.precoCents = null; alteracoes.push(`Preço: ${alvo.nome}`); }
      else if (CONDICIONAL.test(t) && DINHEIRO.test(t) && semPergunta && !/\b(?:exemplo|talvez|hipotetico)\b/.test(n)) {
        alvo.precoModo = "SOB_CONSULTA"; alvo.precoCents = null;
        const perguntaPreco = `Como é definido o valor de ${alvo.nome}?`;
        const regra = c.conhecimento.itens.find(i => i.pergunta === perguntaPreco);
        if (regra) Object.assign(regra, { resposta: t, situacao: "CONFIRMADO", origem: "ASSISTENTE" });
        else c.conhecimento.itens.push({ id: novoId(), pergunta: perguntaPreco, resposta: t, situacao: "CONFIRMADO", origem: "ASSISTENTE" });
        alteracoes.push(`Condições de preço: ${alvo.nome}`);
      }
      else { const v = preco(t, true); if (v !== null) { alvo.precoModo = "FIXO"; alvo.precoCents = v; alteracoes.push(`Preço: ${alvo.nome}`); } }
    }
    const d = minutos(t); if (d !== null && chave.endsWith(":duracao")) { alvo.duracaoMin = d; alteracoes.push(`Duração: ${alvo.nome}`); }
  }
  // Declarações nomeadas também funcionam fora da pergunta atual, com limites
  // de frase para não misturar valor/duração de um serviço com outra informação.
  if (!parsed.success && semPergunta && !bloqueado("informacoes.servicos")) for (const trecho of t.split(/[;\n]|(?<=[.!])\s+(?=[A-ZÀ-Ý])/u)) {
    if (CONDICIONAL.test(trecho) || /\b(?:n[aã]o|nunca|exceto)\b/i.test(trecho)) continue;
    const citados = c.informacoes.servicos.filter(s => normalizar(trecho).includes(normalizar(s.nome)));
    if (citados.length !== 1) continue;
    const s = citados[0]; const v = preco(trecho); const d = minutos(trecho);
    if (v !== null && DINHEIRO.test(trecho)) { s.precoModo = "FIXO"; s.precoCents = v; alteracoes.push(`Preço: ${s.nome}`); }
    if (d !== null) { s.duracaoMin = d; alteracoes.push(`Duração: ${s.nome}`); }
  }
  if (usarFallbackServicos && chave === "informacoes.servicos" && !c.informacoes.servicos.some(s => !nomeDeServicoAmplo(s.nome)) && semPergunta && !CONDICIONAL.test(t)) {
    const lista = t.replace(/^(?:ofere[cç]o|oferecemos|temos|trabalhamos com|servi[cç]os?\s*:)\s*/i, "").replace(/[.!]+$/, "");
    const nomes = lista.split(/[,;\n]|\s+e\s+/).map(v => v.trim()).filter(Boolean);
    const conjuncaoAmbigua = !/[,;\n]/.test(lista) && nomes.length > 1 && nomes[0].split(/\s+/).length === 1;
    const categoriasSemDetalhe = nomes.length > 1 && nomes.every(nome => !/\s/.test(nome));
    const termos = normalizar(lista).split(/\s+/);
    // Termos plurais justapostos não demonstram a unidade de um serviço.
    // A confirmação semântica vem da IA ou de uma lista explícita do responsável.
    const enumeracaoSolta = nomes.length === 1 && termos.length >= 3 && termos.every(termo => /^[\p{L}]+s$/u.test(termo));
    if (conjuncaoAmbigua || categoriasSemDetalhe || enumeracaoSolta || nomeDeServicoAmplo(lista) || /\b(?:nao|nunca|exceto|na verdade|corrigindo|quis dizer)\b/.test(normalizar(lista))) {
      campoAmbiguo = "informacoes.servicos"; esclarecimento = detalharServicos(t);
    } else if (nomes.length <= 12 && nomes.every(nome => /^[\p{L}][\p{L}\s()/-]{1,139}$/u.test(nome))) for (const nome of nomes) {
      c.informacoes.servicos.push({ id: novoId(), nome, descricao: "", precoModo: "FIXO", precoCents: null, duracaoMin: null, situacao: "CONFIRMADO", origem: "ASSISTENTE" }); alteracoes.push(`Serviço: ${nome}`);
    }
  }
  if (!bloqueado("atendimento.agendamento") && !bloqueado("negocio.objetivo") && /^(?:pode confirmar horarios livres|pode (?:confirmar|reservar|agendar)(?: os)? (?:horarios|agendamentos)(?: livres)?|autorizo (?:confirmar|reservar|agendar)(?: horarios)?(?: livres)?)[.!]*$/.test(n)) {
    c.atendimento.agendamento = "DIRETO"; c.negocio.objetivo = "AGENDAMENTOS"; alteracoes.push("Autorização de agendamento");
  } else if (!bloqueado("atendimento.agendamento") && !bloqueado("negocio.objetivo") && /^(?:enviar o link|mande o link|somente (?:o )?link)[.!]*$/.test(n)) { c.atendimento.agendamento = "LINK"; c.negocio.objetivo = "AGENDAMENTOS"; alteracoes.push("Agendamento por link"); }
  else if (!bloqueado("atendimento.agendamento") && !bloqueado("negocio.objetivo") && /^(?:por enquanto,? so tirar duvidas|so tirar duvidas|so responder duvidas|nao quero agendamento)[.!]*$/.test(n)) { c.atendimento.agendamento = "DESLIGADO"; c.negocio.objetivo = "DUVIDAS"; ignorar("atendimento.objetivo"); alteracoes.push("Atendimento de dúvidas"); }
  else if (!bloqueado("atendimento.agendamento") && !bloqueado("negocio.objetivo") && /^(?:receber pedidos(?: para minha equipe)?|anotar pedidos(?: para minha equipe)?)[.!]*$/.test(n)) { c.atendimento.agendamento = "DESLIGADO"; c.negocio.objetivo = "SOLICITACOES"; alteracoes.push("Recebimento de pedidos"); }
  else if (!bloqueado("negocio.objetivo") && /^(?:ajudar com agendamentos|quero (?:ajuda com )?agendamentos)[.!]*$/.test(n)) { c.negocio.objetivo = "AGENDAMENTOS"; alteracoes.push("Ajuda com agendamentos"); }
  if (!bloqueado("atendimento.gestaoReservas") && /^(?:pode remarcar e cancelar|so pode remarcar|so pode cancelar|minha equipe cuida disso)[.!]*$/.test(n)) {
    c.atendimento.gestaoReservas = { remarcar: /remarcar/.test(n), cancelar: /cancelar/.test(n), antecedenciaHoras: null };
    alteracoes.push("Permissões para alterar reservas");
  }
  if (chave === "atendimento.antecedenciaHoras" && !bloqueado("atendimento.antecedenciaHoras") && c.atendimento.gestaoReservas) {
    const horas = n.match(/^(\d{1,4})(?:\s*(?:h|horas?)(?: de antecedencia)?)?[.!]*$/);
    if (horas && Number(horas[1]) <= 8760) { c.atendimento.gestaoReservas.antecedenciaHoras = Number(horas[1]); alteracoes.push("Prazo para alterar reservas"); }
  }
  if (!parsed.success && chave === "conhecimento" && !bloqueado("conhecimento") && semPergunta && !alteracoes.length && t.length >= 5) { c.conhecimento.itens.push({ id: novoId(), pergunta: "Quais são as regras de atendimento?", resposta: t.slice(0, 3000), situacao: "CONFIRMADO", origem: "ASSISTENTE" }); alteracoes.push("Regra de atendimento"); }

  if (parsed.success) {
    const x = parsed.data;
    if (!bloqueado("informacoes.horarios")) {
      const horarios = aplicarHorariosDaConversa(atual.informacoes.horarios, x.horarios, declarado);
      if (horarios) {
        const todosDeclarados = aplicarHorariosDaConversa([], x.horarios, declarado)?.length === 7;
        c.informacoes.horarios = horarios;
        c.informacoes.horariosSituacao = todosDeclarados || atual.informacoes.horariosSituacao === "CONFIRMADO" ? "CONFIRMADO" : "REVISAR";
        if (JSON.stringify(c.informacoes.horarios) !== JSON.stringify(atual.informacoes.horarios)
          || c.informacoes.horariosSituacao !== atual.informacoes.horariosSituacao) alteracoes.push("Horários informados");
      }
    }
    const textoProvado = (campo: z.infer<typeof campoTexto> | null) => {
      if (!campo || !declarado(campo.evidencia) || !normalizar(campo.evidencia).includes(normalizar(campo.valor))) return null;
      // Uma substring positiva não pode apagar a negação, condição ou exceção
      // da oração do responsável. Nesses casos preservamos a oração completa.
      if (/\b(?:nao|nunca|exceto|somente|apenas|so|depende|se|quando|ate)\b/.test(normalizar(campo.evidencia).replace(/\bse chama\b/g, "chama")) && campo.valor.trim() !== campo.evidencia.trim()) return null;
      return campo.valor;
    };
    const nomeProvado = (campo: z.infer<typeof campoTexto> | null) => textoProvado(campo)
      ?? (campo && x.dialogo?.intencao === "CORRIGIR" && declarado(campo.evidencia) && campo.evidencia.includes(campo.valor)
        && /^(?:nao[,!]?\s*)?(?:so|apenas)\s+/.test(normalizar(campo.evidencia)) ? campo.valor : null);
    const nome = nomeProvado(x.nome); if (!bloqueado("negocio.nome") && nome && nome.length <= 140 && nomeLiteralPlausivel(nome, x.nome!.evidencia)) { c.negocio.nome = nome; alteracoes.push("Nome da empresa"); }
    const segmento = textoProvado(x.segmento); if (!bloqueado("negocio.segmento") && segmento && segmento.length <= 140) { c.negocio.segmento = segmento; alteracoes.push("Área de atuação"); }
    const nomeAtendente = nomeProvado(x.nomeAtendente); if (!bloqueado("atendimento.nome") && nomeAtendente && nomeAtendente.length <= 80 && nomeLiteralPlausivel(nomeAtendente)) { c.atendimento.nome = nomeAtendente; alteracoes.push("Apresentação do atendente"); }
    for (const [campo, destino, label, caminho] of [[x.descricao, c.negocio.descricao, "Apresentação", "negocio.descricao"], [x.endereco, c.informacoes.endereco, "Endereço", "informacoes.endereco"], [x.pagamento, c.informacoes.pagamento, "Formas de pagamento", "informacoes.pagamento"], [x.regiao, c.negocio.regiao, "Região atendida", "negocio.regiao"]] as const) {
      const v = textoProvado(campo); if (!bloqueado(caminho) && v && anotarInformacao(caminho, destino, v, campo!.evidencia)) alteracoes.push(label);
    }
    if (!bloqueado("negocio.modalidade") && x.modalidade && declarado(x.modalidade.evidencia)) {
      const e = normalizar(x.modalidade.evidencia);
      const online = /\b(?:online|on-line|virtual)\b/.test(e); const presencial = /\bpresencial\b/.test(e); const domicilio = /\bdomicilio\b|ate o cliente/.test(e);
      const modo = /\bhibrido\b/.test(e) || online && presencial ? "HIBRIDO" : online && !domicilio ? "ONLINE" : presencial && !domicilio ? "PRESENCIAL" : domicilio && !online && !presencial ? "DOMICILIO" : null;
      if (modo === x.modalidade.valor && !/\b(?:nao|nunca|exceto|menos)\b/.test(e)) {
        c.negocio.modalidade = modo; alteracoes.push("Forma de atendimento");
        if (modo === "ONLINE") c.informacoes.endereco = { valor: "", situacao: "NAO_APLICA", origem: "ASSISTENTE" };
      }
    }
    if (!bloqueado("atendimento.jeito") && x.jeito && declarado(x.jeito.evidencia)) {
      const e = normalizar(x.jeito.evidencia); const modos = [["ACOLHEDOR", /\bacolhedor\b/], ["DIRETO", /\bdireto\b/], ["DESCONTRAIDO", /\bdescontraido\b/]] as const;
      const correspondentes = modos.filter(([, re]) => re.test(e));
      if (correspondentes.length === 1 && correspondentes[0][0] === x.jeito.valor && !/\b(?:nao|nunca|exceto|menos)\b/.test(e)) { c.atendimento.jeito = x.jeito.valor; alteracoes.push("Jeito de atender"); }
    }
    if (!bloqueado("atendimento.quando") && x.quando && declarado(x.quando.evidencia)) {
      const e = normalizar(x.quando.evidencia); const fora = /fora do (?:horario|expediente)|(?:so|somente|apenas) quando .*fechad/.test(e); const sempre = /24 horas|24h|dia e noite|durante (?:o )?expediente|o tempo todo/.test(e);
      if (!/\b(?:nao|nunca|exceto|menos)\b/.test(e) && (x.quando.valor === "FORA_EXPEDIENTE" && fora || x.quando.valor === "APOIO_EXPEDIENTE" && sempre && !fora)) { c.atendimento.quando = x.quando.valor; alteracoes.push("Quando responder"); }
    }
    if (!bloqueado("negocio.objetivo") && x.objetivo && declarado(x.objetivo.evidencia)) {
      const e = normalizar(x.objetivo.evidencia);
      const intencao = /\b(?:quero|queremos|preciso|precisamos|deve|pode|para|pra|ajudar|ajude|receber|fazer)\b/.test(e)
        || chave === "atendimento.objetivo" || chave === "negocio.objetivo";
      const compativel = x.objetivo.valor === "AGENDAMENTOS" ? /\b(?:agendar|agendamentos?|marcar|reservar|reservas?)\b/.test(e)
        : x.objetivo.valor === "SOLICITACOES" ? /\b(?:pedidos?|solicitacoes|anotar)\b/.test(e)
        : /\b(?:duvidas?|perguntas?|informacoes)\b/.test(e);
      if (intencao && compativel && (x.objetivo.valor === "DUVIDAS" || x.objetivo.valor === "SOLICITACOES" || x.objetivo.valor === "AGENDAMENTOS")
        && !/\b(?:nao|nunca|exceto|menos|talvez|se|hipotetico)\b/.test(e) && c.negocio.objetivo !== x.objetivo.valor) {
        c.negocio.objetivo = x.objetivo.valor; alteracoes.push("Objetivo do atendimento");
        // A intenção de ajudar com agenda não concede permissão de reservar.
      }
    }
    const corrigindoServicos = ((x.dialogo?.intencao === "CORRIGIR" || x.dialogo?.intencao === "MISTO")
      && /\b(?:nome|chama|chamar|renomear|renomeie|troque|mude|corrigindo|corrigir|correcao)\b/.test(n))
      || /\bagora se chama\b|\b(?:corrigindo|corrigir|renomear|renomeie|troque|mude)\b.{0,45}\b(?:nome|chama|para|pra|por)\b/.test(n);
    const pedirAlvo = () => {
      campoAmbiguo = "informacoes.servicos";
      esclarecimento = pergunta("esclarecimento:informacoes.servicos", "Qual serviço cadastrado você quer alterar?", atual.informacoes.servicos.slice(0, 4).map(s => s.nome));
    };
    if (semPergunta && !bloqueado("informacoes.servicos") && /^(?:por favor[, ]+)?(?:remova|retire|exclua|apague)\b/.test(n)) {
      const candidatos = atual.informacoes.servicos.filter(s => normalizar(t).includes(normalizar(s.nome)));
      if (candidatos.length === 1 && !/\b(?:nao|nunca|talvez|se)\b/.test(n)) {
        c.informacoes.servicos = c.informacoes.servicos.filter(s => s.id !== candidatos[0].id);
        alteracoes.push(`Serviço removido: ${candidatos[0].nome}`);
      } else pedirAlvo();
    }
    for (const s of bloqueado("informacoes.servicos") ? [] : servicosInterpretados) {
      let existente = c.informacoes.servicos.find(v => s.servicoId ? v.id === (semantica?.remapeamentosIds[s.servicoId] ?? s.servicoId) : normalizar(v.nome) === normalizar(s.nome));
      if (!existente && corrigindoServicos && atual.informacoes.servicos.length) {
        const candidatos = atual.informacoes.servicos.filter(v => normalizar(s.evidencia).includes(normalizar(v.nome)));
        const referenciaUnica = atual.informacoes.servicos.length === 1 && /\b(?:esse|este|o|aquele) servi[cç]o\b/i.test(s.evidencia);
        const anterior = candidatos.length === 1 ? candidatos[0] : referenciaUnica ? atual.informacoes.servicos[0] : null;
        if (!anterior || servicosInterpretados.length !== 1 || !/\b(?:nome|chama|chamar|renomear|renomeie|troque|mude)\b/.test(normalizar(s.evidencia))) { pedirAlvo(); break; }
        existente = c.informacoes.servicos.find(v => v.id === anterior.id);
        if (!existente) { pedirAlvo(); break; }
        existente.nome = s.nome;
      }
      const contextoAlvo = alvo && existente?.id === alvo.id;
      const nomesDaEvidencia = [...c.informacoes.servicos.map(v => v.nome), ...servicosInterpretados.map(v => v.nome)];
      const precoDaEvidencia = precoDoServico(s.evidencia, s.nome, nomesDaEvidencia, Boolean(contextoAlvo && chave.endsWith(":preco")));
      // O modelo pode citar a oração da duração e propor também o preço.
      // Nesse caso, prove o preço separadamente na fala atual: o mesmo serviço
      // precisa estar nomeado, e o número deve coincidir com a proposta da IA.
      // Não completamos preços que o modelo não propôs nem consultamos histórico.
      const citaNome = (trecho: string, nome: string) => new RegExp(`(?<![a-z0-9])${normalizar(nome).replace(/[.*+?^${}()|[\]\\]/g, "\\$&")}(?![a-z0-9])`).test(normalizar(trecho));
      const provaComplementarSegura = (trecho: string) => {
        const normal = normalizar(trecho);
        return declarado(trecho) && !ressalvaOmitida(trecho) && !CONDICIONAL.test(normal)
          && !/\b(?:nao|nunca|exceto|menos|somente|apenas|se|quando|ate|varia|variavel|parcelas?|parcelad[oa]|disse|falou|acha|achou|acham|disseram|ouvi|terceiros?|concorrente|concorrencia|segundo)\b|\ba partir\b/.test(normal);
      };
      const oracoesAtuais = partes(t);
      const precosComplementares = s.precoCents === null ? [] : oracoesAtuais.flatMap(trecho => {
        if (!citaNome(trecho, s.nome) || !provaComplementarSegura(trecho)) return [];
        const valor = precoDoServico(trecho, s.nome, nomesDaEvidencia, false);
        return valor === null ? [] : [valor];
      });
      const precoDeclarado = precoDaEvidencia ?? (new Set(precosComplementares).size === 1 && precosComplementares[0] === s.precoCents ? precosComplementares[0] : null);
      const referenciaADuas = (trecho: string) => /^(?:as duas|os dois|ambos|ambas)\b/.test(normalizar(trecho));
      const duplaIncluiServico = (trecho: string, i: number) => {
          // Um grupo de dois só abrange os dois serviços nomeados nesta fala,
          // antes da referência. O restante do catálogo nunca entra por suposição.
          const anteriores = oracoesAtuais.slice(0, i);
          let nomes = [...new Set(nomesDaEvidencia.map(normalizar))].filter(nome => anteriores.some(p => citaNome(p, nome)));
          // Uma fala composta somente por "os dois" também é inequívoca quando
          // o próprio cadastro contém exatamente dois serviços conhecidos.
          if (!nomes.length && oracoesAtuais.length === 1 && c.informacoes.servicos.length === 2) nomes = c.informacoes.servicos.map(v => normalizar(v.nome));
          const grupo = nomes.map(nome => servicosInterpretados.find(p => normalizar(p.nome) === normalizar(nome)));
          const comum = minutosDoServico(trecho, s.nome, nomesDaEvidencia);
          const duracaoIndividualDivergente = nomes.some(nome => oracoesAtuais.some(p => {
            if (!citaNome(p, nome) || !provaComplementarSegura(p)) return false;
            const valor = minutosDoServico(p, nome, nomesDaEvidencia);
            return valor !== null && valor !== comum;
          }));
          return nomes.length === 2 && nomes.some(nome => normalizar(nome) === normalizar(s.nome))
            && anteriores.filter(p => nomes.some(nome => citaNome(p, nome))).every(provaComplementarSegura)
            && !duracaoIndividualDivergente && grupo.every(p => p?.duracaoMin !== null && p?.duracaoMin !== undefined && p.duracaoMin === s.duracaoMin);
      };
      const duracaoDaEvidencia = minutosDoServico(s.evidencia, s.nome, nomesDaEvidencia);
      const citaDuplaNaEvidencia = /\b(?:as duas|os dois|ambos|ambas)\b[^.;!?]{0,45}\b(?:duram?|levam?|demoram?|duracao|tempo)\b/.test(normalizar(s.evidencia));
      const duracaoExtraida = !citaDuplaNaEvidencia || oracoesAtuais.some((trecho, i) => referenciaADuas(trecho) && normalizar(s.evidencia).includes(normalizar(trecho)) && duplaIncluiServico(trecho, i)) ? duracaoDaEvidencia : null;
      const duracoesComplementares = s.duracaoMin === null ? [] : oracoesAtuais.flatMap((trecho, i) => {
        if (!provaComplementarSegura(trecho)) return [];
        const pertence = citaNome(trecho, s.nome) || referenciaADuas(trecho) && duplaIncluiServico(trecho, i);
        if (!pertence) return [];
        const valor = minutosDoServico(trecho, s.nome, nomesDaEvidencia);
        return valor === null ? [] : [valor];
      });
      // O número vem da declaração ligada ao serviço, nunca do palpite do modelo
      // ou da primeira duração de uma evidência com vários assuntos.
      const duracaoDeclarada = duracaoExtraida ?? (new Set(duracoesComplementares).size === 1 && duracoesComplementares[0] === s.duracaoMin ? duracoesComplementares[0] : null);
      const antesDoServico = existente ? JSON.stringify([existente.nome, existente.descricao, existente.precoModo, existente.precoCents, existente.duracaoMin, existente.situacao]) : null;
      const novo: ServicoNexa = existente ?? { id: novoId(), nome: s.nome, descricao: "", precoModo: "FIXO", precoCents: null, duracaoMin: null, situacao: "CONFIRMADO", origem: "ASSISTENTE" };
      if (precoDeclarado !== null) { novo.precoCents = precoDeclarado; novo.precoModo = "FIXO"; }
      if (s.sobConsulta && /sob consulta|valor varia|pre[cç]o varia/i.test(s.evidencia)) { novo.precoModo = "SOB_CONSULTA"; novo.precoCents = null; }
      if (duracaoDeclarada !== null) novo.duracaoMin = duracaoDeclarada;
      if (s.descricao && s.evidencia.includes(s.descricao) && !s.categoria && !s.condicaoPreco) {
        // A descrição livre não substitui categoria ou regra de preço aprendida.
        // Esses campos só mudam pelo contrato semântico com prova própria.
        const metadado = (linha: string) => /^(?:categoria|condicao de preco):/.test(normalizar(linha));
        const preservados = novo.descricao.split(/\r?\n/).map(linha => linha.trim()).filter(metadado);
        const livres = s.descricao.split(/\r?\n/).map(linha => linha.trim()).filter(linha => linha && !metadado(linha));
        if (livres.length) novo.descricao = [...new Map([...livres, ...preservados].map(linha => [normalizar(linha), linha])).values()].join("\n");
      }
      novo.situacao = existente?.situacao === "REVISAR" ? "REVISAR" : "CONFIRMADO";
      const mudou = antesDoServico !== JSON.stringify([novo.nome, novo.descricao, novo.precoModo, novo.precoCents, novo.duracaoMin, novo.situacao]);
      if (!existente) c.informacoes.servicos.push(novo);
      if (mudou) { novo.origem = "ASSISTENTE"; alteracoes.push(`Serviço: ${novo.nome}`); }
    }
    for (const p of bloqueado("conhecimento") ? [] : x.perguntas) {
      // Encerrar/continuar a configuração é estado da conversa, não uma nova
      // resposta da empresa para seus clientes.
      if (conducaoValida && conducao?.listaServicos !== "MANTER" && normalizar(p.evidencia) === normalizar(conducao!.evidencia)) continue;
      if (!textoProvado({ valor: p.resposta, evidencia: p.evidencia })) continue;
      const respostaEnsinada = contem(t, p.resposta) || Boolean(propostaConfirmada && contem(propostaConfirmada, p.resposta)) ? p.resposta : p.evidencia;
      const existente = c.conhecimento.itens.find(i => normalizar(i.pergunta) === normalizar(p.pergunta));
      if (existente) Object.assign(existente, { resposta: respostaEnsinada, situacao: "CONFIRMADO", origem: "ASSISTENTE" });
      else c.conhecimento.itens.push({ id: novoId(), pergunta: p.pergunta, resposta: respostaEnsinada, situacao: "CONFIRMADO", origem: "ASSISTENTE" });
      alteracoes.push("Resposta ensinada");
    }
  }
  if (semPergunta && c.informacoes.servicos.some(s => !nomeDeServicoAmplo(s.nome))
    && /(?:^|[.!;]\s*)(?:esses|estes) sao (?:todos )?os (?:meus |nossos )?servicos[.!\s]*$/.test(n)) ignorar("informacoes.servicos");
  const fatosSemMetadados = (valor: ConfiguracaoNexa) => JSON.stringify(valor, (chave, item) => chave === "origem" ? undefined : item);
  if (fatosSemMetadados(c) === fatosSemMetadados(atual)) { c = structuredClone(atual); alteracoes.length = 0; }
  let aviso: string | undefined;
  if (!bloqueado("informacoes.servicos") && alteracoes.some(a => a.startsWith("Serviço: "))) {
    for (const anterior of atual.informacoes.servicos.filter(s => nomeDeServicoAmplo(s.nome) && !estado.ignoradas.includes(`servico:${s.id}`))) {
      const preservado = c.informacoes.servicos.find(s => s.id === anterior.id);
      if (!preservado) continue;
      preservado.situacao = "REVISAR"; ignorar(`servico:${anterior.id}`);
      alteracoes.push(`Revisar descrição ampla: ${anterior.nome}`);
      aviso = "Os serviços específicos foram anotados. O cadastro amplo anterior foi preservado para revisão no resumo; ele não foi confirmado novamente.";
    }
  }
  if (c.informacoes.servicos.length > 100 || c.conhecimento.itens.length > 150) return { rascunho: structuredClone(atual), ignoradas, alteracoes: [], aviso: "O limite de informações desta configuração foi atingido. Revise os itens existentes antes de adicionar outros." };
  return resultado({ ...(aviso ? { aviso } : {}), ...(!alteracoes.length ? { resposta: esclarecimento ? "" : encerrouLista ? "Perfeito, vamos seguir com esses serviços!" : t.includes("?") ? "Estou aqui para tirar suas dúvidas e configurar seu atendimento. Pode me perguntar!" : "Não entendi muito bem. Pode me explicar de um jeito mais simples?" } : {}) });
}
