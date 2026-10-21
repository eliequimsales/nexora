import { randomUUID } from "node:crypto";
import { Prisma } from "@nexora/recepcionista-prisma";
import { z } from "zod";
import { prisma } from "@/lib/db";
import { horarioCadastrado, lerDiasFechados } from "@/lib/agenda/horario";
import { lerJeito } from "./jeitos";
import type { CenarioNexa, ConfiguracaoNexa, InformacaoNexa, PendenciaNexa, TelaConfiguracaoNexa, TesteNexa } from "./configuracao-schema";

export { aplicarConfiguracaoAosFatos as fatosDoRascunho } from "./configuracao-fatos";

const situacao = z.enum(["CONFIRMADO", "REVISAR", "NAO_INFORMADO", "NAO_APLICA"]);
const origem = z.enum(["CADASTRO", "MANUAL", "ASSISTENTE"]);
const texto = (max: number) => z.string().trim().max(max);
const info = z.object({ valor: texto(3000), situacao, origem }).strict();
const id = texto(120).min(1);
export const configuracaoNexaSchema: z.ZodType<ConfiguracaoNexa> = z.object({
  negocio: z.object({
    nome: texto(140), segmento: texto(140), modalidade: z.enum(["PRESENCIAL", "ONLINE", "DOMICILIO", "HIBRIDO"]),
    objetivo: z.enum(["DUVIDAS", "SOLICITACOES", "AGENDAMENTOS"]), regiao: info, descricao: info,
  }).strict(),
  informacoes: z.object({
    endereco: info, pagamento: info,
    horarios: z.array(z.object({ day: z.number().int().min(0).max(6), open: texto(5), close: texto(5), closed: z.boolean() }).strict()).max(7),
    horariosSituacao: situacao,
    diasFechados: z.array(z.string().regex(/^\d{4}-\d{2}-\d{2}$/).refine((v) => {
      const data = new Date(`${v}T12:00:00.000Z`);
      return !Number.isNaN(data.getTime()) && data.toISOString().slice(0, 10) === v;
    })).max(366),
    servicos: z.array(z.object({
      id, nome: texto(140), descricao: texto(1500), precoModo: z.enum(["FIXO", "SOB_CONSULTA"]),
      precoCents: z.number().int().min(0).max(100000000).nullable(),
      duracaoMin: z.number().int().min(1).max(1440).nullable(), situacao, origem,
    }).strict()).max(100),
  }).strict(),
  atendimento: z.object({
    nome: texto(80), jeito: z.enum(["ACOLHEDOR", "DIRETO", "DESCONTRAIDO"]),
    quando: z.enum(["FORA_EXPEDIENTE", "APOIO_EXPEDIENTE"]), agendamento: z.enum(["DESLIGADO", "LINK", "DIRETO"]),
    handoffKeywords: z.array(texto(80).min(1)).max(30),
  }).strict(),
  conhecimento: z.object({ itens: z.array(z.object({ id, pergunta: texto(500), resposta: texto(3000), situacao, origem }).strict()).max(150) }).strict(),
}).strict();

export const salvarConfiguracaoSchema = z.object({
  revisao: z.number().int().min(0), rascunho: configuracaoNexaSchema,
  etapa: z.number().int().min(0).max(5), concluirEtapa: z.boolean().optional(),
  concluirEtapas: z.array(z.number().int().min(0).max(3)).min(1).max(4)
    .refine((etapas) => new Set(etapas).size === etapas.length, "Informe cada etapa uma única vez.").optional(),
}).strict().refine((input) => !input.concluirEtapa || input.concluirEtapas === undefined, {
  message: "Conclua uma etapa ou um grupo de etapas por vez.", path: ["concluirEtapas"],
});
const cenarioSchema = z.enum(["INFORMACOES", "HORARIO", "HUMANO", "DESCONHECIDA", "MULTIPLA", "CANCELAMENTO", "MIDIA"]);
const testeSchema = z.object({ id, cenario: cenarioSchema, revisao: z.number().int().min(0), em: z.string(),
  pergunta: texto(3000), respostas: z.array(texto(5000)).min(1).max(12), correto: z.boolean().nullable() });
const envelopeSchema = z.object({
  versao: z.literal(1), revisao: z.number().int().min(0), rascunho: configuracaoNexaSchema,
  etapa: z.number().int().min(0).max(5), revisadas: z.array(z.number().int().min(0).max(5)), testes: z.array(testeSchema).max(40),
  publicado: z.object({ revisao: z.number().int().min(0), em: z.string(), rascunho: configuracaoNexaSchema }).nullable(),
  // Somente o servidor grava a base importada. Permite revisar um cadastro
  // externo sem confundir a importação com autorização para sobrescrever outro.
  cadastroBase: z.string().optional(),
});
export type EnvelopeConfiguracaoNexa = z.infer<typeof envelopeSchema>;

export class ConfiguracaoErro extends Error {
  constructor(message: string, public status = 409, public pendencias?: PendenciaNexa[]) { super(message); this.name = "ConfiguracaoErro"; }
}

/** A leitura inválida falha fechada; um JSON danificado não pode aprovar o cadastro legado. */
export function lerEnvelopeConfiguracao(valor: unknown): EnvelopeConfiguracaoNexa | null {
  if (valor == null) return null;
  const parsed = envelopeSchema.safeParse(valor);
  if (!parsed.success) throw new ConfiguracaoErro("A configuração salva precisa de revisão técnica. Nenhuma alteração foi aplicada.", 409);
  return parsed.data;
}

export function lerConfiguracaoPublicada(valor: unknown): ConfiguracaoNexa | null {
  return lerEnvelopeConfiguracao(valor)?.publicado?.rascunho ?? null;
}

function informacao(valor: unknown): InformacaoNexa {
  const v = typeof valor === "string" ? valor.trim() : "";
  return { valor: v, situacao: v ? "REVISAR" : "NAO_INFORMADO", origem: "CADASTRO" };
}
function ordenado(valor: unknown): unknown {
  if (Array.isArray(valor)) return valor.map(ordenado);
  if (valor && typeof valor === "object") return Object.fromEntries(Object.entries(valor).sort(([a], [b]) => a.localeCompare(b)).map(([k, v]) => [k, ordenado(v)]));
  return valor;
}
const mesmo = (a: unknown, b: unknown) => JSON.stringify(ordenado(a)) === JSON.stringify(ordenado(b));
const json = (v: unknown) => JSON.parse(JSON.stringify(v)) as Prisma.InputJsonValue;

export type CadastroParaConferencia = {
  empresa: string;
  perfil: {
    description?: unknown; address?: unknown; paymentMethods?: unknown; businessHours?: unknown; faqs?: unknown;
    atendenteNome?: unknown; atendenteJeito?: unknown; atendenteMarca?: unknown; atendenteExpediente?: unknown; handoffKeywords?: unknown;
  };
  servicos?: { id: string; name: string; priceCents: number; durationMin: number; suggested?: boolean }[];
};

function normalizarCadastro(atual: CadastroParaConferencia) {
  const p = atual.perfil;
  return { empresa: atual.empresa, perfil: {
    description: p.description ?? "", address: p.address ?? "", paymentMethods: p.paymentMethods ?? "",
    businessHours: horarioCadastrado(p.businessHours).sort((a, b) => a.day - b.day), faqs: p.faqs ?? [],
    atendenteNome: p.atendenteNome ?? "", atendenteJeito: p.atendenteJeito ?? "ACOLHEDOR",
    atendenteMarca: p.atendenteMarca === true, atendenteExpediente: p.atendenteExpediente === true, handoffKeywords: p.handoffKeywords ?? [],
  }, ...(atual.servicos ? { servicos: atual.servicos.map((s) => ({ id: s.id, name: s.name, priceCents: s.priceCents,
    durationMin: s.durationMin, suggested: s.suggested === true })).sort((a, b) => a.id.localeCompare(b.id)) } : {}) };
}
function cadastroDaPublicacao(c: ConfiguracaoNexa): CadastroParaConferencia {
  const confirmado = (i: InformacaoNexa) => i.situacao === "CONFIRMADO" ? i.valor : "";
  return { empresa: c.negocio.nome, perfil: {
    description: confirmado(c.negocio.descricao), address: confirmado(c.informacoes.endereco), paymentMethods: confirmado(c.informacoes.pagamento),
    businessHours: c.informacoes.horariosSituacao === "CONFIRMADO" ? c.informacoes.horarios : [],
    faqs: c.conhecimento.itens.filter((i) => i.situacao === "CONFIRMADO").map((i) => ({ question: i.pergunta, answer: i.resposta })),
    atendenteNome: c.atendimento.nome, atendenteJeito: c.atendimento.jeito, atendenteMarca: c.atendimento.agendamento === "DIRETO",
    atendenteExpediente: c.atendimento.quando === "APOIO_EXPEDIENTE", handoffKeywords: c.atendimento.handoffKeywords,
  }, servicos: c.informacoes.servicos.filter((s) => s.situacao === "CONFIRMADO").map((s) => ({ id: s.id, name: s.nome,
    priceCents: s.precoModo === "FIXO" ? s.precoCents ?? 0 : 0, durationMin: s.duracaoMin ?? 0, suggested: false })) };
}
/** Pura e sem diasFechados: bloqueios pontuais são estado operacional. */
export function cadastroDivergeDaPublicacao(config: ConfiguracaoNexa, atual: CadastroParaConferencia): boolean {
  const esperado = cadastroDaPublicacao(config);
  if (!atual.servicos) delete esperado.servicos;
  return !mesmo(normalizarCadastro(atual), normalizarCadastro(esperado));
}
function assinaturaCadastro(atual: CadastroParaConferencia): string { return JSON.stringify(ordenado(normalizarCadastro(atual))); }

async function carregar(companyId: string, db: Prisma.TransactionClient = prisma) {
  const empresa = await db.company.findUnique({ where: { id: companyId }, include: { profile: true } });
  if (!empresa?.profile) throw new ConfiguracaoErro("Cadastro da empresa não encontrado.", 404);
  const perfil = empresa.profile;
  const salvo = lerEnvelopeConfiguracao(perfil.atendenteConfiguracao);
  const servicos = await db.service.findMany({ where: { companyId, active: true }, orderBy: { order: "asc" } });
  if (salvo) return { empresa, perfil, servicos, envelope: salvo, original: perfil.atendenteConfiguracao };
  const conhecimento = await db.knowledgeItem.findMany({ where: { companyId, status: "APPROVED" }, orderBy: { approvedAt: "desc" }, take: 100 });
  const faqs = Array.isArray(perfil.faqs) ? perfil.faqs.filter((f): f is { question: string; answer: string } =>
    !!f && typeof f === "object" && "question" in f && "answer" in f && typeof f.question === "string" && typeof f.answer === "string") : [];
  const horarios = horarioCadastrado(perfil.businessHours);
  const segmentos = Array.isArray(perfil.segments) ? perfil.segments.filter((s): s is string => typeof s === "string") : [];
  const perguntas = [
    ...faqs.map((f, i) => ({ id: `faq:${i}`, pergunta: f.question, resposta: f.answer })),
    ...conhecimento.map((f) => ({ id: `conhecimento:${f.id}`, pergunta: f.question, resposta: f.answer })),
    ...(perfil.pricingInfo.trim() ? [{ id: "legado:precos", pergunta: "Quais são os preços e condições?", resposta: perfil.pricingInfo }] : []),
    ...(perfil.productsServices.trim() ? [{ id: "legado:produtos", pergunta: "Quais produtos e serviços vocês oferecem?", resposta: perfil.productsServices }] : []),
    // serviceRules também guarda a equipe da agenda. JSON de equipe nunca vira resposta.
    ...(perfil.serviceRules.trim() && !/^[\[{]/.test(perfil.serviceRules.trim()) ? [{ id: "legado:regras", pergunta: "Quais são as regras do atendimento?", resposta: perfil.serviceRules }] : []),
  ];
  const rascunho: ConfiguracaoNexa = {
    negocio: { nome: empresa.name, segmento: segmentos.join(", "), modalidade: perfil.address.trim() ? "PRESENCIAL" : "ONLINE",
      objetivo: servicos.length ? "AGENDAMENTOS" : "DUVIDAS", regiao: informacao(""), descricao: informacao(perfil.description) },
    informacoes: { endereco: informacao(perfil.address), pagamento: informacao(perfil.paymentMethods), horarios,
      horariosSituacao: horarios.length ? "REVISAR" : "NAO_INFORMADO", diasFechados: lerDiasFechados(perfil.diasFechados),
      servicos: servicos.map((s) => ({ id: s.id, nome: s.name, descricao: "", precoModo: s.priceCents > 0 ? "FIXO" : "SOB_CONSULTA",
        precoCents: s.priceCents > 0 ? s.priceCents : null, duracaoMin: s.durationMin > 0 ? s.durationMin : null, situacao: "REVISAR", origem: "CADASTRO" })) },
    atendimento: { nome: perfil.atendenteNome, jeito: lerJeito(perfil.atendenteJeito), quando: perfil.atendenteExpediente ? "APOIO_EXPEDIENTE" : "FORA_EXPEDIENTE",
      agendamento: servicos.length ? perfil.atendenteMarca ? "DIRETO" : "LINK" : "DESLIGADO",
      handoffKeywords: Array.isArray(perfil.handoffKeywords) ? perfil.handoffKeywords.filter((s): s is string => typeof s === "string") : [] },
    conhecimento: { itens: perguntas.map((f) => ({ ...f, situacao: "REVISAR", origem: "CADASTRO" })) },
  };
  return { empresa, perfil, servicos, original: perfil.atendenteConfiguracao,
    envelope: { versao: 1, revisao: 0, rascunho, etapa: 0, revisadas: [], testes: [], publicado: null,
      cadastroBase: assinaturaCadastro({ empresa: empresa.name, perfil, servicos }) } as EnvelopeConfiguracaoNexa };
}

/** Pendências verificáveis, sem porcentagem fictícia de inteligência. */
export function pendenciasDaConfiguracao(e: EnvelopeConfiguracaoNexa): PendenciaNexa[] {
  const c = e.rascunho;
  const p: PendenciaNexa[] = [];
  const falta = (campo: string, mensagem: string, etapa: number, bloqueia = true) => p.push({ campo, mensagem, etapa, bloqueia });
  if (c.negocio.nome.length < 2) falta("negocio.nome", "Informe o nome do negócio.", 0);
  if (c.negocio.segmento.length < 2) falta("negocio.segmento", "Informe a área de atuação.", 0);
  if (c.atendimento.nome.length < 2) falta("atendimento.nome", "Escolha o nome da atendente.", 2);
  const conferir = (i: InformacaoNexa, campo: string, label: string, etapa: number, obrigatorio = false) => {
    if (i.situacao === "REVISAR") falta(campo, `Revise ${label}.`, etapa);
    else if (i.situacao === "CONFIRMADO" && !i.valor) falta(campo, `Preencha ${label} ou indique que não foi informado.`, etapa);
    else if (obrigatorio && (i.situacao !== "CONFIRMADO" || !i.valor)) falta(campo, `Confirme ${label} para este tipo de atendimento.`, etapa);
  };
  conferir(c.negocio.descricao, "negocio.descricao", "a descrição do negócio", 0);
  conferir(c.negocio.regiao, "negocio.regiao", "a região atendida", 0, c.negocio.modalidade === "DOMICILIO");
  conferir(c.informacoes.endereco, "informacoes.endereco", "o endereço", 1, ["PRESENCIAL", "HIBRIDO"].includes(c.negocio.modalidade));
  conferir(c.informacoes.pagamento, "informacoes.pagamento", "as formas de pagamento", 1);
  const agenda = c.negocio.objetivo === "AGENDAMENTOS" || c.atendimento.agendamento !== "DESLIGADO";
  if (c.negocio.objetivo !== "AGENDAMENTOS" && c.atendimento.agendamento !== "DESLIGADO") falta("atendimento.agendamento", "Escolha o objetivo de agendamentos para autorizar a agenda.", 2);
  if (c.negocio.objetivo === "AGENDAMENTOS" && c.atendimento.agendamento === "DESLIGADO") falta("atendimento.agendamento", "Defina se o atendente envia o link ou confirma na agenda.", 2);
  const h = c.informacoes.horarios;
  const hora = /^([01]\d|2[0-3]):[0-5]\d$/;
  const horariosValidos = h.length === 7 && new Set(h.map((d) => d.day)).size === 7 && h.every((d) => d.closed || hora.test(d.open) && hora.test(d.close) && d.open < d.close);
  if (c.informacoes.horariosSituacao === "REVISAR") falta("informacoes.horarios", "Revise os horários de funcionamento.", 1);
  else if (c.informacoes.horariosSituacao === "CONFIRMADO" && !horariosValidos) falta("informacoes.horarios", "Confira os sete dias e os horários de abertura e fechamento.", 1);
  else if (c.informacoes.horariosSituacao !== "CONFIRMADO" || !horariosValidos || !h.some((d) => !d.closed)) falta("informacoes.horarios", "Informe e confirme o expediente para definir quando o atendente deve responder.", 1);
  const ativos = c.informacoes.servicos.filter((s) => s.situacao === "CONFIRMADO");
  for (const s of c.informacoes.servicos) {
    if (s.situacao === "REVISAR") falta(`servico:${s.id}`, `Revise o serviço ${s.nome || "sem nome"}.`, 1);
    if (s.situacao !== "CONFIRMADO") continue;
    if (s.nome.length < 2) falta(`servico:${s.id}:nome`, "Informe o nome do serviço.", 1);
    if (s.precoModo === "FIXO" && s.precoCents === null) falta(`servico:${s.id}:preco`, `Informe o preço de ${s.nome} ou selecione sob consulta.`, 1);
    if (agenda && !s.duracaoMin) falta(`servico:${s.id}:duracao`, `Informe a duração de ${s.nome} para oferecer horários.`, 1);
  }
  if (agenda && !ativos.length) falta("informacoes.servicos", "Cadastre e confirme ao menos um serviço para agendar.", 1);
  for (const f of c.conhecimento.itens) {
    if (f.situacao === "REVISAR") falta(`pergunta:${f.id}`, `Revise a resposta: ${f.pergunta || "pergunta sem título"}.`, 3);
    if (f.situacao === "CONFIRMADO" && (!f.pergunta || !f.resposta)) falta(`pergunta:${f.id}`, "Preencha a pergunta e a resposta antes de confirmar.", 3);
  }
  const chave = (v: string) => v.toLocaleLowerCase("pt-BR").normalize("NFD").replace(/\p{M}/gu, "").replace(/[^a-z0-9]+/g, " ").trim();
  const respostas = new Map<string, string>();
  for (const f of c.conhecimento.itens.filter((i) => i.situacao === "CONFIRMADO")) {
    const k = chave(f.pergunta); const anterior = respostas.get(k);
    if (anterior !== undefined && anterior !== f.resposta.trim()) falta(`pergunta:${f.id}`, "Há respostas diferentes para a mesma pergunta. Mantenha uma resposta ou esclareça a condição de cada pergunta.", 3);
    respostas.set(k, f.resposta.trim());
  }
  const nomes = new Set<string>();
  for (const s of ativos) {
    const k = chave(s.nome);
    if (nomes.has(k)) falta(`servico:${s.id}:nome`, "Diferencie os nomes dos serviços para evitar uma escolha ambígua.", 1);
    nomes.add(k);
  }
  if (!ativos.length && !(c.negocio.descricao.situacao === "CONFIRMADO" && c.negocio.descricao.valor) && !c.conhecimento.itens.some((i) => i.situacao === "CONFIRMADO" && i.pergunta && i.resposta)) falta("conhecimento", "Cadastre uma descrição, serviço ou resposta confirmada para o atendente utilizar.", 3);
  for (let etapa = 0; etapa < 4; etapa++) if (!e.revisadas.includes(etapa)) falta(`etapa:${etapa}`, "Conclua a revisão desta etapa.", etapa);
  const cenarios: CenarioNexa[] = ["INFORMACOES", "HUMANO", "DESCONHECIDA", ...(agenda ? ["HORARIO" as const] : [])];
  for (const cenario of cenarios) if ([...e.testes].reverse().find((t) => t.cenario === cenario && t.revisao === e.revisao)?.correto !== true) falta(`teste:${cenario}`, `Teste e aprove o cenário ${cenario === "INFORMACOES" ? "Informações do negócio" : cenario === "HUMANO" ? "Pedir uma pessoa" : cenario === "HORARIO" ? "Consultar um horário" : "Informação não cadastrada"}.`, 4);
  return p;
}

function cadastroAtual(l: Awaited<ReturnType<typeof carregar>>): CadastroParaConferencia {
  return { empresa: l.empresa.name, perfil: l.perfil, servicos: l.servicos };
}
function cadastroMudou(l: Awaited<ReturnType<typeof carregar>>): boolean {
  const e = l.envelope; const atual = cadastroAtual(l);
  if (e.cadastroBase !== undefined) return e.cadastroBase !== assinaturaCadastro(atual);
  return !!e.publicado && cadastroDivergeDaPublicacao(e.publicado.rascunho, atual);
}
function tela(carregado: Awaited<ReturnType<typeof carregar>>): TelaConfiguracaoNexa {
  const { perfil, envelope: e } = carregado;
  const divergente = cadastroMudou(carregado);
  const pendencias = pendenciasDaConfiguracao(e);
  if (divergente) pendencias.push({ campo: "cadastro", mensagem: "O cadastro foi alterado em outra área. Importe os dados atuais para revisar.", etapa: 0, bloqueia: true });
  return { rascunho: e.rascunho, revisao: e.revisao, etapa: e.etapa, revisadas: e.revisadas, testes: e.testes,
    pendencias, publicadoEm: e.publicado?.em ?? null,
    haAlteracoes: divergente || !e.publicado || e.publicado.revisao !== e.revisao || !mesmo(e.publicado.rascunho, e.rascunho),
    conexao: { conectado: perfil.whatsappStatus === "CONNECTED" && !!perfil.whatsappInstance, telefone: carregado.empresa.phone, ligado: perfil.plantaoAtivo } };
}

export async function getConfiguracao(companyId: string): Promise<TelaConfiguracaoNexa> { return tela(await carregar(companyId)); }

function conferirRevisao(e: EnvelopeConfiguracaoNexa, revisao: number) {
  if (e.revisao !== revisao) throw new ConfiguracaoErro("A configuração foi alterada em outra tela. Recarregue para revisar a versão mais recente.");
}
function conferirIds(c: ConfiguracaoNexa, anterior: ConfiguracaoNexa) {
  for (const [lista, previa] of [[c.informacoes.servicos, anterior.informacoes.servicos], [c.conhecimento.itens, anterior.conhecimento.itens]] as const) {
    const existentes = new Set(previa.map((s) => s.id));
    const vistos = new Set<string>();
    for (const item of lista) {
      if (vistos.has(item.id)) throw new ConfiguracaoErro("Há itens repetidos na configuração.", 400);
      if (!existentes.has(item.id) && !item.id.startsWith("novo:")) throw new ConfiguracaoErro("Um item não pertence a esta configuração. Recarregue antes de continuar.", 400);
      vistos.add(item.id);
    }
  }
}
async function gravar(companyId: string, original: unknown, e: EnvelopeConfiguracaoNexa, db: Prisma.TransactionClient = prisma, extra: Prisma.CompanyProfileUpdateManyMutationInput = {}) {
  const escrita = await db.companyProfile.updateMany({ where: { companyId,
    atendenteConfiguracao: { equals: original == null ? Prisma.DbNull : json(original) } }, data: { ...extra, atendenteConfiguracao: json(e) } });
  if (escrita.count !== 1) throw new ConfiguracaoErro("A configuração mudou enquanto você salvava. Recarregue para continuar.");
}

export async function salvarConfiguracao(companyId: string, entrada: z.infer<typeof salvarConfiguracaoSchema>): Promise<TelaConfiguracaoNexa> {
  const input = salvarConfiguracaoSchema.parse(entrada);
  const l = await carregar(companyId); const e = l.envelope;
  conferirRevisao(e, input.revisao); conferirIds(input.rascunho, e.rascunho);
  const alterado = !mesmo(e.rascunho, input.rascunho);
  const blocos = ["negocio", "informacoes", "atendimento", "conhecimento"] as const;
  const alteradas = new Set(blocos.flatMap((bloco, etapa) => mesmo(e.rascunho[bloco], input.rascunho[bloco]) ? [] : [etapa]));
  const novo: EnvelopeConfiguracaoNexa = { ...e, rascunho: input.rascunho, etapa: input.concluirEtapa ? Math.min(5, input.etapa + 1) : input.etapa,
    revisao: e.revisao + (alterado ? 1 : 0), revisadas: e.revisadas.filter((etapa) => etapa < 4 ? !alteradas.has(etapa) : !alterado), testes: alterado ? [] : e.testes };
  const concluidas = input.concluirEtapas ?? (input.concluirEtapa ? [input.etapa] : []);
  if (concluidas.length) novo.revisadas = [...new Set([...novo.revisadas, ...concluidas])].sort();
  const grupo = input.concluirEtapas;
  if (grupo && pendenciasDaConfiguracao(novo).some((p) =>
    p.bloqueia && grupo.includes(p.etapa) && !p.campo.startsWith("etapa:"))) {
    novo.etapa = Math.min(...grupo);
  }
  await gravar(companyId, l.original, novo);
  return tela({ ...l, envelope: novo });
}

export async function registrarTesteConfiguracao(companyId: string, input: { revisao: number; cenario: CenarioNexa; pergunta: string; respostas: string[] }): Promise<TesteNexa> {
  const l = await carregar(companyId); conferirRevisao(l.envelope, input.revisao);
  const teste: TesteNexa = testeSchema.parse({ ...input, id: `teste:${randomUUID()}`, em: new Date().toISOString(), correto: null });
  const novo = { ...l.envelope, testes: [...l.envelope.testes, teste].slice(-40) };
  await gravar(companyId, l.original, novo); return teste;
}

export async function confirmarTesteConfiguracao(companyId: string, input: { revisao: number; testeId: string; correto: boolean }): Promise<TelaConfiguracaoNexa> {
  const l = await carregar(companyId); conferirRevisao(l.envelope, input.revisao);
  if (!l.envelope.testes.some((t) => t.id === input.testeId && t.revisao === input.revisao)) throw new ConfiguracaoErro("Este teste não pertence à versão atual da configuração.");
  const novo = { ...l.envelope, testes: l.envelope.testes.map((t) => t.id === input.testeId ? { ...t, correto: input.correto } : t) };
  await gravar(companyId, l.original, novo); return tela({ ...l, envelope: novo });
}

/** Importação explícita substitui o rascunho, preservando a publicação anterior. */
export async function importarCadastroConfiguracao(companyId: string, revisao: number): Promise<TelaConfiguracaoNexa> {
  const l = await carregar(companyId); const e = l.envelope; conferirRevisao(e, revisao);
  const p = l.perfil; const anterior = e.rascunho;
  const faqs = Array.isArray(p.faqs) ? p.faqs.filter((f): f is { question: string; answer: string } =>
    !!f && typeof f === "object" && "question" in f && "answer" in f && typeof f.question === "string" && typeof f.answer === "string") : [];
  // Após uma publicação, as FAQs canônicas já são a fonte revisada. Conhecimento
  // aprovado antigo não é reintroduzido na importação.
  const treinamento = e.publicado ? [] : await prisma.knowledgeItem.findMany({
    where: { companyId, status: "APPROVED" }, orderBy: { approvedAt: "desc" }, take: 100,
  });
  const segmentos = Array.isArray(p.segments) ? p.segments.filter((s): s is string => typeof s === "string") : [];
  const horarios = horarioCadastrado(p.businessHours);
  const rascunho: ConfiguracaoNexa = {
    negocio: { ...anterior.negocio, nome: l.empresa.name, segmento: segmentos.join(", ") || anterior.negocio.segmento, descricao: informacao(p.description) },
    informacoes: { endereco: informacao(p.address), pagamento: informacao(p.paymentMethods), horarios,
      horariosSituacao: horarios.length ? "REVISAR" : "NAO_INFORMADO", diasFechados: lerDiasFechados(p.diasFechados),
      servicos: l.servicos.map((s) => {
        const publicado = e.publicado?.rascunho.informacoes.servicos.find((v) => v.id === s.id);
        const modo = s.priceCents > 0 || publicado?.precoModo === "FIXO" && publicado.precoCents === s.priceCents ? "FIXO" as const : "SOB_CONSULTA" as const;
        return { id: s.id, nome: s.name, descricao: publicado?.descricao ?? "", precoModo: modo,
          precoCents: modo === "FIXO" ? s.priceCents : null, duracaoMin: s.durationMin > 0 ? s.durationMin : null,
          situacao: "REVISAR" as const, origem: "CADASTRO" as const };
      }) },
    atendimento: structuredClone(anterior.atendimento),
    conhecimento: { itens: [
      ...faqs.map((f, i) => ({ id: `faq:${i}`, pergunta: f.question, resposta: f.answer })),
      ...treinamento.map((f) => ({ id: `conhecimento:${f.id}`, pergunta: f.question, resposta: f.answer })),
      ...(!e.publicado && p.pricingInfo.trim() ? [{ id: "legado:precos", pergunta: "Quais são os preços e condições?", resposta: p.pricingInfo }] : []),
      ...(!e.publicado && p.productsServices.trim() ? [{ id: "legado:produtos", pergunta: "Quais produtos e serviços vocês oferecem?", resposta: p.productsServices }] : []),
      ...(!e.publicado && p.serviceRules.trim() && !/^[\[{]/.test(p.serviceRules.trim()) ? [{ id: "legado:regras", pergunta: "Quais são as regras do atendimento?", resposta: p.serviceRules }] : []),
    ].map((f) => ({ ...f, situacao: "REVISAR" as const, origem: "CADASTRO" as const })) },
  };
  const novo: EnvelopeConfiguracaoNexa = { ...e, rascunho: configuracaoNexaSchema.parse(rascunho), revisao: e.revisao + 1,
    etapa: 0, revisadas: [], testes: [], cadastroBase: assinaturaCadastro(cadastroAtual(l)) };
  await gravar(companyId, l.original, novo); return tela({ ...l, envelope: novo });
}

export async function publicarConfiguracao(companyId: string, revisao: number): Promise<TelaConfiguracaoNexa> {
  return prisma.$transaction(async (tx) => {
    const l = await carregar(companyId, tx); const e = l.envelope; conferirRevisao(e, revisao);
    const pendencias = tela(l).pendencias.filter((p) => p.bloqueia);
    if (pendencias.length) throw new ConfiguracaoErro("Revise as pendências antes de publicar a configuração.", 409, pendencias);
    const c: ConfiguracaoNexa = structuredClone(e.rascunho);
    // Bloqueios pontuais são estado operacional da agenda. Ao republicar, só
    // aplicamos inclusões/remoções que o dono fez no rascunho em relação à
    // publicação anterior. Alterações posteriores na Agenda são preservadas.
    const atuais = lerDiasFechados(l.perfil.diasFechados);
    const anteriores = e.publicado?.rascunho.informacoes.diasFechados;
    const propostos = c.informacoes.diasFechados;
    if (anteriores) {
      const removidos = new Set(anteriores.filter((dia) => !propostos.includes(dia)));
      const adicionados = propostos.filter((dia) => !anteriores.includes(dia));
      c.informacoes.diasFechados = [...new Set([...atuais.filter((dia) => !removidos.has(dia)), ...adicionados])].sort();
    } else {
      // Primeira publicação não possui uma base histórica para provar remoção.
      c.informacoes.diasFechados = [...new Set([...atuais, ...propostos])].sort();
    }
    const existentes = c.informacoes.servicos.filter((s) => !s.id.startsWith("novo:"));
    if (existentes.length) {
      const doTenant = await tx.service.findMany({ where: { companyId, id: { in: existentes.map((s) => s.id) } }, select: { id: true } });
      if (doTenant.length !== existentes.length) throw new ConfiguracaoErro("Um serviço foi removido ou não pertence à empresa. Revise a configuração.");
    }
    // Reserva histórica continua referenciando o serviço; nenhum Appointment é apagado.
    const idsAtivos: string[] = [];
    for (let order = 0; order < c.informacoes.servicos.length; order++) {
      const s = c.informacoes.servicos[order];
      if (s.situacao !== "CONFIRMADO") continue;
      const data = { name: s.nome, priceCents: s.precoModo === "FIXO" ? s.precoCents ?? 0 : 0,
        durationMin: s.duracaoMin ?? 0, active: true, suggested: false, order };
      if (s.id.startsWith("novo:")) s.id = (await tx.service.create({ data: { companyId, ...data }, select: { id: true } })).id;
      else await tx.service.updateMany({ where: { companyId, id: s.id }, data });
      idsAtivos.push(s.id);
    }
    await tx.service.updateMany({ where: { companyId, ...(idsAtivos.length ? { id: { notIn: idsAtivos } } : {}) }, data: { active: false } });
    const em = new Date().toISOString();
    const novo: EnvelopeConfiguracaoNexa = { ...e, cadastroBase: undefined, rascunho: c, publicado: { revisao, em, rascunho: structuredClone(c) } };
    const valor = (i: InformacaoNexa) => i.situacao === "CONFIRMADO" ? i.valor : "";
    await tx.company.update({ where: { id: companyId }, data: { name: c.negocio.nome } });
    await gravar(companyId, l.original, novo, tx, {
      description: valor(c.negocio.descricao), address: valor(c.informacoes.endereco), paymentMethods: valor(c.informacoes.pagamento),
      segments: [c.negocio.segmento], businessHours: c.informacoes.horariosSituacao === "CONFIRMADO" ? json(c.informacoes.horarios) : [],
      diasFechados: c.informacoes.diasFechados, faqs: json(c.conhecimento.itens.filter((i) => i.situacao === "CONFIRMADO").map((i) => ({ question: i.pergunta, answer: i.resposta }))),
      atendenteNome: c.atendimento.nome, atendenteJeito: c.atendimento.jeito, atendenteMarca: c.atendimento.agendamento === "DIRETO",
      atendenteExpediente: c.atendimento.quando === "APOIO_EXPEDIENTE", handoffKeywords: c.atendimento.handoffKeywords,
      // Não há escrita em serviceRules: a equipe da agenda permanece intacta.
    });
    return tela(await carregar(companyId, tx));
  }, { isolationLevel: Prisma.TransactionIsolationLevel.Serializable });
}

/** Não liga atendimento; a rota de ativação confere esta lista antes da escrita. */
export async function validarAtivacaoConfiguracao(companyId: string): Promise<PendenciaNexa[]> {
  const l = await carregar(companyId); const t = tela(l); const p = [...t.pendencias];
  if (t.haAlteracoes) p.push({ campo: "publicacao", mensagem: "Publique a versão revisada antes de ativar.", etapa: 5, bloqueia: true });
  if (!t.conexao.conectado) p.push({ campo: "conexao", mensagem: "Conecte o WhatsApp antes de ativar.", etapa: 5, bloqueia: true });
  return p;
}
