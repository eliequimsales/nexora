import { randomUUID } from "node:crypto";
import { z } from "zod";
import type { ConfiguracaoNexa, HorarioNexa, InformacaoNexa, ServicoNexa } from "./configuracao-schema";

/** Extração conservadora, sem chamadas externas e sem qualquer escrita no cadastro real. */
const texto = z.string().trim().min(1).max(1500);
const propostaSchema = z.object({
  endereco: texto.optional(),
  descricao: texto.optional(),
  pagamento: texto.optional(),
  servicos: z.array(z.object({
    nome: z.string().trim().min(2).max(100),
    precoCents: z.number().int().min(0).max(99_999_999).nullable(),
    duracaoMin: z.number().int().min(1).max(1440).nullable(),
    precoModo: z.enum(["FIXO", "SOB_CONSULTA"]),
  }).strict()).max(30),
  horarios: z.array(z.object({
    day: z.number().int().min(0).max(6),
    open: z.string().regex(/^(?:[01]\d|2[0-3]):[0-5]\d$/),
    close: z.string().regex(/^(?:[01]\d|2[0-3]):[0-5]\d$/),
    closed: z.boolean(),
  }).strict()).max(7),
  perguntas: z.array(z.object({ pergunta: texto, resposta: texto }).strict()).max(20),
}).strict();

const normalizar = (s: string) => s.normalize("NFD").replace(/[\u0300-\u036f]/g, "").toLowerCase().trim();
const revisar = (valor: string): InformacaoNexa => ({ valor, origem: "ASSISTENTE", situacao: "REVISAR" });
const AJUDA = "Descreva uma informação por linha: serviço com preço, endereço, formas de pagamento ou dias e horários. Para ensinar uma resposta, use ‘Quando perguntarem sobre ..., responda ...’. Vou organizar uma proposta para você revisar antes de aplicar.";

export function centavosInformados(valor: string): number | null {
  // Formato brasileiro: separador de milhar opcional e vírgula para centavos.
  if (!/^(?:\d{1,3}(?:\.\d{3})+|\d+)(?:,\d{1,2})?$/.test(valor)) return null;
  const [inteiro, decimal = ""] = valor.replace(/\./g, "").split(",");
  const cents = Number(inteiro) * 100 + Number(decimal.padEnd(2, "0"));
  return Number.isSafeInteger(cents) && cents <= 99_999_999 ? cents : null;
}

const DIA = "(?:domingo|dom|segunda(?:-feira)?|seg|terça(?:-feira)?|ter|quarta(?:-feira)?|qua|quinta(?:-feira)?|qui|sexta(?:-feira)?|sex|sábado|sab)";
const diaNumero = (dia: string): number => {
  const t = normalizar(dia);
  return ["dom", "seg", "ter", "qua", "qui", "sex", "sab"].findIndex((prefixo) => t.startsWith(prefixo));
};

function diasInformados(linha: string): number[] {
  if (/todos os dias|diariamente|domingo a domingo/i.test(linha)) return [0, 1, 2, 3, 4, 5, 6];
  const intervalo = linha.match(new RegExp(`\\b(${DIA})\\s+(?:a|à|até)\\s+(${DIA})\\b`, "i"));
  if (intervalo) {
    const inicio = diaNumero(intervalo[1]);
    const fim = diaNumero(intervalo[2]);
    const dias: number[] = [];
    for (let d = inicio; dias.length < 7; d = (d + 1) % 7) { dias.push(d); if (d === fim) break; }
    return dias;
  }
  return [...new Set(Array.from(linha.matchAll(new RegExp(`\\b${DIA}\\b`, "gi")), (m) => diaNumero(m[0])))];
}

function extrairHorarios(linha: string): HorarioNexa[] {
  const dias = diasInformados(linha);
  if (!dias.length) return []; // Nunca assumir segunda a sexta.
  if (/\b(?:nao|não|exceto|menos|mas|exce[cç][aã]o)\b/i.test(linha)) return []; // Exceções ou negações exigem edição explícita.
  const horas = linha.match(/(?:das|de)?\s*(\d{1,2})(?:h(?:(\d{2}))?|:(\d{2}))?\s*(?:às|as|até|ate)\s*(\d{1,2})(?:h(?:(\d{2}))?|:(\d{2}))?/i);
  if (!horas) return [];
  const hora = (h: string, m: string | undefined) => `${h.padStart(2, "0")}:${m || "00"}`;
  const open = hora(horas[1], horas[2] || horas[3]);
  const close = hora(horas[4], horas[5] || horas[6]);
  if (!/^(?:[01]\d|2[0-3]):[0-5]\d$/.test(open) || !/^(?:[01]\d|2[0-3]):[0-5]\d$/.test(close) || open >= close) return [];
  // Um único intervalo por dia no contrato. Intervalos de almoço são ajustados no formulário.
  if ((linha.match(/(?:^|\s)(?:às|as|até|ate)\s*\d/gi) || []).length !== 1) return [];
  return dias.map((day) => ({ day, open, close, closed: false }));
}

function duracaoInformada(trecho: string): number | null {
  if (/\d+[,.]\d+\s*(?:horas?|h|minutos?|min)\b/i.test(trecho)) return null;
  const minutos = trecho.match(/(?<![\d,.:])\b(\d{1,4})\s*(?:minutos?|min)\b/i);
  if (minutos) { const n = Number(minutos[1]); return n >= 1 && n <= 1440 ? n : null; }
  const horas = trecho.match(/(?<![\d,.:])\b(\d{1,2})\s*(?:horas?|h)\b(?:\s*(\d{1,2})\s*(?:minutos?|min))?/i);
  if (horas) { const n = Number(horas[1]) * 60 + Number(horas[2] || 0); return n >= 1 && n <= 1440 ? n : null; }
  return null;
}

export function proporPreenchimento(
  atual: ConfiguracaoNexa,
  mensagem: string,
  novoId: () => string = () => `novo:${randomUUID()}`,
): { rascunho: ConfiguracaoNexa; mensagem: string; alterou: boolean } {
  const limpo = mensagem.trim();
  if (!limpo || limpo.length > 6000) throw new Error("Escreva entre 1 e 6.000 caracteres.");
  const rascunho = structuredClone(atual);
  const extraido: z.infer<typeof propostaSchema> = { servicos: [], horarios: [], perguntas: [] };
  const avisos: string[] = [];
  // Linhas e ponto e vírgula são limites explícitos. Não converter conversa solta em regra.
  for (const linha of limpo.split(/[\n;]+/).map((s) => s.trim()).filter(Boolean)) {
    const faq = linha.match(/^(?:quando|se)\s+(?:o cliente\s+)?(?:perguntarem|perguntar)\s+(?:sobre\s+)?(.+?)[,:]\s*(?:responda|diga|informe)\s+(.+)$/i);
    if (faq) { extraido.perguntas.push({ pergunta: faq[1].trim(), resposta: faq[2].trim() }); continue; }
    if (linha.includes("?") || /^(?:oi|olá|ola|bom dia|boa tarde|boa noite|ajuda|me ajuda|como |o que |oq |qual |quais )\b/i.test(linha)) continue;

    const endereco = linha.match(/^(?:endereço\s*:\s*|endere[cç]o\s+(?:é|e)\s+|(?:ficamos|fica)\s+(?:na|no|em)\s+)(.+)$/i);
    if (endereco) { extraido.endereco = endereco[1].trim(); continue; }
    const descricao = linha.match(/^(?:descrição|descricao|sobre o negócio|sobre o negocio)\s*:\s*(.+)$/i);
    if (descricao) { extraido.descricao = descricao[1].trim(); continue; }
    // Guardar a declaração inteira preserva ‘não aceito Pix’ e condições de parcelamento.
    if (/^(?:(?:formas? de )?pagamento\s*:|(?:n[aã]o\s+)?aceit(?:o|amos)\b|recebemos\b)/i.test(linha) && /pix|cart[aã]o|dinheiro|boleto|cr[eé]dito|d[eé]bito|cheque|transfer[eê]ncia/i.test(linha)) {
      extraido.pagamento = [extraido.pagamento, linha].filter(Boolean).join("\n");
      continue;
    }
    const horarios = extrairHorarios(linha);
    if (horarios.length) { extraido.horarios.push(...horarios); continue; }
    if (diasInformados(linha).length || /\b(?:das|de)\s+\d{1,2}(?:h|:)?.*(?:às|as|até|ate)\s+\d/i.test(linha)) {
      avisos.push("Confira os dias e intervalos de funcionamento no formulário; não completei horários ambíguos.");
      continue;
    }
    if (/\b(?:não|nao|talvez|acho|poderia|exemplo|hipot[eé]tico)\b/i.test(linha)) continue;
    const segmentos = linha.split(/,\s*(?=[A-Za-zÀ-ÿ])/);
    for (const segmento of segmentos) {
      const re = /(?:^|\s+e\s+)([A-Za-zÀ-ÿ][A-Za-zÀ-ÿ \-()]{1,99}?)\s*(?:custa|por|:)?\s*R\$\s*((?:\d{1,3}(?:\.\d{3})+|\d+)(?:,\d{1,2})?)(?![\d.,])/gi;
      const correspondencias = Array.from(segmento.matchAll(re));
      for (let i = 0; i < correspondencias.length; i++) {
        const m = correspondencias[i];
        const nome = m[1].trim().replace(/^(?:faço|ofereço|oferecemos|temos|serviço\s*:)\s+/i, "");
        const precoCents = centavosInformados(m[2]);
        const restante = segmento.slice((m.index || 0) + m[0].length, correspondencias[i + 1]?.index);
        // ‘a partir de’, valores variáveis e descontos não viram preço fixo.
        if (!nome || precoCents === null || /a partir|desconto|promo[cç][aã]o|parcel/i.test(nome + restante)) continue;
        extraido.servicos.push({ nome, precoCents, duracaoMin: duracaoInformada(restante), precoModo: "FIXO" });
      }
      const consulta = segmento.match(/^(?:serviço\s*:\s*)?([A-Za-zÀ-ÿ][A-Za-zÀ-ÿ \-()]{1,99}?)\s*[:—-]?\s+(?:preço|valor)\s+sob consulta\.?$/i);
      if (consulta) extraido.servicos.push({ nome: consulta[1].trim(), precoCents: null, duracaoMin: null, precoModo: "SOB_CONSULTA" });
    }
  }
  const dados = propostaSchema.parse(extraido);
  const campos: string[] = [];
  if (dados.endereco) { rascunho.informacoes.endereco = revisar(dados.endereco); campos.push("endereço"); }
  if (dados.descricao) { rascunho.negocio.descricao = revisar(dados.descricao); campos.push("descrição"); }
  if (dados.pagamento) { rascunho.informacoes.pagamento = revisar(dados.pagamento); campos.push("pagamento"); }
  for (const servico of dados.servicos) {
    const i = rascunho.informacoes.servicos.findIndex((s) => normalizar(s.nome) === normalizar(servico.nome));
    const anterior = rascunho.informacoes.servicos[i];
    const proposta: ServicoNexa = { ...servico, duracaoMin: servico.duracaoMin ?? anterior?.duracaoMin ?? null, id: anterior?.id || novoId(), descricao: anterior?.descricao || "", situacao: "REVISAR", origem: "ASSISTENTE" };
    if (i >= 0) rascunho.informacoes.servicos[i] = proposta; else rascunho.informacoes.servicos.push(proposta);
  }
  if (dados.servicos.length) campos.push(`${dados.servicos.length} serviço(s)`);
  if (dados.horarios.length) {
    const porDia = new Map(rascunho.informacoes.horarios.map((h) => [h.day, h]));
    for (const h of dados.horarios) porDia.set(h.day, h);
    rascunho.informacoes.horarios = [...porDia.values()].sort((a, b) => a.day - b.day);
    rascunho.informacoes.horariosSituacao = "REVISAR";
    campos.push("horários dos dias informados");
  }
  for (const pergunta of dados.perguntas) {
    const i = rascunho.conhecimento.itens.findIndex((p) => normalizar(p.pergunta) === normalizar(pergunta.pergunta));
    const item = { ...pergunta, id: rascunho.conhecimento.itens[i]?.id || novoId(), situacao: "REVISAR" as const, origem: "ASSISTENTE" as const };
    if (i >= 0) rascunho.conhecimento.itens[i] = item; else rascunho.conhecimento.itens.push(item);
  }
  if (dados.perguntas.length) campos.push(`${dados.perguntas.length} pergunta(s) e resposta(s)`);
  const alterou = campos.length > 0;
  let resposta = alterou
    ? `Preparei uma proposta no rascunho: ${campos.join(", ")}. Confira os itens marcados ‘Aguardando revisão’. As informações de atendimento só mudam depois de você confirmar e aplicar a configuração.`
    : AJUDA;
  if (dados.servicos.some((s) => rascunho.informacoes.servicos.find((p) => normalizar(p.nome) === normalizar(s.nome))?.duracaoMin === null)) resposta += " A duração dos serviços não informada ficou em branco; preencha se quiser agendar.";
  if (avisos.length) resposta += ` ${[...new Set(avisos)].join(" ")}`;
  return { rascunho, mensagem: resposta, alterou };
}
