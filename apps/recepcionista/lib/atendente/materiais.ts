import { createHash } from "node:crypto";
import { z } from "zod";
import type { ConfiguracaoNexa, MaterialNexa } from "./configuracao-schema";
import { ConfiguracaoErro, configuracaoNexaSchema, getConfiguracao, salvarConfiguracao } from "./configuracao";
import { proporPreenchimento } from "./preenchimento";

export const MAX_TEXTO_MATERIAL = 6000;
export const MAX_ARQUIVO_TEXTO = 64 * 1024;
export const MAX_ARQUIVO_AUDIO = 10 * 1024 * 1024;
export const materialEntradaSchema = z.object({
  revisao: z.number().int().min(0), nome: z.string().trim().min(1).max(180),
  tipo: z.enum(["TEXTO", "ARQUIVO", "AUDIO"]), texto: z.string().trim().min(1).max(MAX_TEXTO_MATERIAL),
  validoAte: z.string().datetime().nullable().optional(),
}).strict();
export type EntradaMaterial = z.infer<typeof materialEntradaSchema>;

function validarTexto(texto: string): string {
  const limpo = texto.replace(/^\uFEFF/, "").replace(/\r\n?/g, "\n").trim();
  if (!limpo || /\u0000/.test(limpo)) throw new ConfiguracaoErro("O arquivo não contém texto legível. Use TXT, MD, CSV ou JSON em UTF-8.", 400);
  if (limpo.length > MAX_TEXTO_MATERIAL) throw new ConfiguracaoErro("O material tem mais de 6.000 caracteres. Divida-o em partes para poder conferir cada informação.", 413);
  return limpo;
}
const normalizar = (v: string) => v.normalize("NFD").replace(/[\u0300-\u036f]/g, "").trim().toLowerCase();

/** CSV com aspas, separador brasileiro e campos multilinha; não interpreta fórmulas. */
export function lerTabelaCsv(texto: string): string[][] {
  const primeiraLinha = texto.split(/\r?\n/, 1)[0];
  const separador = primeiraLinha.includes(";") ? ";" : ",";
  const linhas: string[][] = []; let linha: string[] = []; let campo = ""; let aspas = false;
  for (let i = 0; i < texto.length; i++) {
    const c = texto[i];
    if (c === '"') { if (aspas && texto[i + 1] === '"') { campo += '"'; i++; } else aspas = !aspas; }
    else if (!aspas && c === separador) { linha.push(campo.trim()); campo = ""; }
    else if (!aspas && c === "\n") { linha.push(campo.trim()); if (linha.some(Boolean)) linhas.push(linha); linha = []; campo = ""; }
    else if (c !== "\r") campo += c;
  }
  if (aspas) throw new ConfiguracaoErro("A tabela tem aspas sem fechamento. Corrija o CSV e envie novamente.", 400);
  linha.push(campo.trim()); if (linha.some(Boolean)) linhas.push(linha);
  return linhas;
}

function linhasDaTabela(linhas: string[][]): string {
  const cabecalho = (linhas[0] ?? []).map(normalizar);
  const indice = (...nomes: string[]) => cabecalho.findIndex(c => nomes.includes(c));
  const q = indice("pergunta", "question"); const a = indice("resposta", "answer");
  if (q >= 0 && a >= 0) return linhas.slice(1).map((v, n) => {
    if (!v[q]?.trim() || !v[a]?.trim()) throw new ConfiguracaoErro(`Preencha pergunta e resposta na linha ${n + 2}.`, 400);
    return `Quando perguntarem sobre ${v[q].replace(/\s+/g, " ")}, responda ${v[a].replace(/\s+/g, " ")}`;
  }).join("\n");
  const nome = indice("nome", "servico", "serviço"); const preco = indice("preco", "preço", "valor"); const duracao = indice("duracao", "duração", "duracao_minutos", "minutos");
  if (nome < 0 || preco < 0) throw new ConfiguracaoErro("Use colunas nome, preco e duracao_minutos; ou pergunta e resposta.", 400);
  return linhas.slice(1).map((v, n) => {
    if (!v[nome]?.trim() || !v[preco]?.trim()) throw new ConfiguracaoErro(`Preencha nome e preço na linha ${n + 2}.`, 400);
    const valor = v[preco].replace(/^R\$\s*/i, "");
    const tempo = duracao >= 0 && v[duracao]?.trim() ? `, ${v[duracao].trim()}${/^\d+$/.test(v[duracao].trim()) ? " minutos" : ""}` : "";
    return `${v[nome]} ${/sob consulta/i.test(valor) ? "valor sob consulta" : `R$ ${valor}`}${tempo}`;
  }).join("\n");
}

export function extrairTextoDeArquivo(nome: string, bytes: Uint8Array): string {
  if (bytes.byteLength > MAX_ARQUIVO_TEXTO) throw new ConfiguracaoErro("O arquivo de texto pode ter até 64 KB.", 413);
  const ext = nome.toLowerCase().split(".").at(-1);
  if (!["txt", "md", "csv", "json"].includes(ext ?? "")) throw new ConfiguracaoErro("Use TXT, MD, CSV ou JSON. PDF, imagens e planilhas XLSX ainda precisam ser convertidos para texto ou CSV.", 415);
  let texto: string;
  try { texto = new TextDecoder("utf-8", { fatal: true }).decode(bytes).replace(/^\uFEFF/, ""); }
  catch { throw new ConfiguracaoErro("Salve o arquivo como UTF-8 para preservar os acentos e envie novamente.", 400); }
  if (ext === "csv") texto = linhasDaTabela(lerTabelaCsv(texto));
  if (ext === "json") {
    let valor: unknown; try { valor = JSON.parse(texto); } catch { throw new ConfiguracaoErro("O JSON está incompleto ou inválido.", 400); }
    const faqs = z.array(z.object({ pergunta: z.string().min(1), resposta: z.string().min(1) }).strict()).min(1).max(30).safeParse(valor);
    const servicos = z.array(z.object({ nome: z.string().min(1), preco: z.union([z.string().min(1), z.number().nonnegative()]), duracao_minutos: z.number().int().positive().max(1440).optional() }).strict()).min(1).max(30).safeParse(valor);
    if (faqs.success) texto = linhasDaTabela([["pergunta", "resposta"], ...faqs.data.map(f => [f.pergunta, f.resposta])]);
    else if (servicos.success) texto = linhasDaTabela([["nome", "preco", "duracao_minutos"], ...servicos.data.map(s => [s.nome, typeof s.preco === "number" ? s.preco.toLocaleString("pt-BR", { useGrouping: false, maximumFractionDigits: 2 }) : s.preco, s.duracao_minutos?.toString() ?? ""])]);
    else throw new ConfiguracaoErro("Use uma lista JSON com pergunta/resposta ou nome/preco/duracao_minutos. O preço numérico é informado em reais.", 400);
  }
  return validarTexto(texto);
}

function partesDoMaterial(texto: string): string[] {
  const partes: string[] = []; let resto = texto;
  while (resto.length > 3000) {
    const quebra = resto.lastIndexOf("\n", 3000); const ponto = resto.lastIndexOf(". ", 2998);
    const corte = quebra > 1000 ? quebra : ponto > 1000 ? ponto + 1 : 3000;
    partes.push(resto.slice(0, corte).trim()); resto = resto.slice(corte).trim();
  }
  if (resto) partes.push(resto);
  return partes;
}

export function prepararMaterialNoRascunho(atual: ConfiguracaoNexa, input: EntradaMaterial, agora = new Date()): { rascunho: ConfiguracaoNexa; resumo: string; materialId: string } {
  const texto = validarTexto(input.texto);
  if (input.validoAte && new Date(input.validoAte).getTime() <= agora.getTime()) throw new ConfiguracaoErro("A validade informada já terminou. Envie as informações atuais.", 400);
  const sha256 = createHash("sha256").update(texto).digest("hex");
  const existente = atual.materiais?.find(m => m.sha256 === sha256 && m.validoAte === (input.validoAte ?? null));
  if (existente) return { rascunho: atual, resumo: "Este material já está salvo. Confira os itens no resumo antes de aplicar.", materialId: existente.id };
  if (atual.materiais?.some(m => normalizar(m.nome) === normalizar(input.nome))) throw new ConfiguracaoErro("Já existe um material com esse nome. Remova a versão anterior ou use um nome que explique a diferença entre os conteúdos.", 409);
  if ((atual.materiais?.length ?? 0) >= 20) throw new ConfiguracaoErro("Você já guardou 20 materiais. Atualize ou remova um material antes de acrescentar outro.", 409);
  // Materiais com validade alimentam somente fontes vinculadas ao documento.
  // Não copiam preço para um campo permanente que sobreviveria à sua validade.
  const textoParaExtracao = texto.replace(/(R\$\s*(?:\d{1,3}(?:\.\d{3})+|\d+)(?:,\d{1,2})?)\s*,\s*(?=\d+\s*(?:minutos?|min\b|horas?|h\b))/gi, "$1 com duração de ");
  const proposta = input.validoAte ? { rascunho: structuredClone(atual) } : proporPreenchimento(atual, textoParaExtracao);
  const rascunho = proposta.rascunho;
  const material: MaterialNexa = { id: `novo:material:${sha256.slice(0, 32)}`, nome: input.nome, tipo: input.tipo, texto, sha256, importadoEm: agora.toISOString(), validoAte: input.validoAte ?? null };
  const partes = partesDoMaterial(texto);
  const idsAnteriores = new Set(atual.conhecimento.itens.map(i => i.id));
  const novasRespostas = rascunho.conhecimento.itens.filter(i => !idsAnteriores.has(i.id));
  const somenteRespostas = !input.validoAte && novasRespostas.length > 0 && texto.split(/\n/).filter(l => l.trim()).every(l => /^(?:quando|se)\s+.*(?:perguntarem|perguntar)\s+.*(?:responda|diga|informe)\s+/i.test(l.trim()));
  if (somenteRespostas) novasRespostas.forEach((i, n) => { i.id = `${material.id}:resposta:${n + 1}`; });
  else partes.forEach((parte, i) => rascunho.conhecimento.itens.push({ id: `${material.id}:${i + 1}`, pergunta: `Material: ${input.nome}${partes.length > 1 ? ` — parte ${i + 1}` : ""}`, resposta: parte, origem: "ASSISTENTE", situacao: "REVISAR" }));
  rascunho.materiais = [...(rascunho.materiais ?? []), material];
  const parsed = configuracaoNexaSchema.safeParse(rascunho);
  if (!parsed.success) throw new ConfiguracaoErro("O material ultrapassa a capacidade do rascunho. Divida em partes menores ou revise a quantidade de serviços e respostas.", 409);
  return { rascunho: parsed.data, materialId: material.id, resumo: "Material salvo para revisão. Confira as informações extraídas no resumo; o atendimento aos clientes só muda depois dos testes e da aplicação." };
}

export async function importarMaterial(companyId: string, input: EntradaMaterial) {
  const entrada = materialEntradaSchema.parse(input); const atual = await getConfiguracao(companyId);
  if (atual.revisao !== entrada.revisao) throw new ConfiguracaoErro("A configuração mudou em outra tela. Recarregue antes de importar o material.", 409);
  const preparada = prepararMaterialNoRascunho(atual.rascunho, entrada);
  const tela = preparada.rascunho === atual.rascunho ? atual : await salvarConfiguracao(companyId, { revisao: entrada.revisao, rascunho: preparada.rascunho, etapa: atual.etapa });
  return { tela, resumo: preparada.resumo, materialId: preparada.materialId };
}

export async function removerMaterial(companyId: string, input: { revisao: number; id: string }) {
  const atual = await getConfiguracao(companyId);
  if (atual.revisao !== input.revisao) throw new ConfiguracaoErro("A configuração mudou em outra tela. Recarregue antes de remover o material.", 409);
  if (!atual.rascunho.materiais?.some(m => m.id === input.id)) throw new ConfiguracaoErro("Material não encontrado neste rascunho.", 404);
  const rascunho = structuredClone(atual.rascunho);
  rascunho.materiais = rascunho.materiais?.filter(m => m.id !== input.id);
  rascunho.conhecimento.itens = rascunho.conhecimento.itens.filter(i => !i.id.startsWith(`${input.id}:`));
  const tela = await salvarConfiguracao(companyId, { revisao: input.revisao, rascunho, etapa: atual.etapa });
  return { tela, resumo: "Material e suas fontes removidos do rascunho. Serviços e outros campos que já foram extraídos continuam disponíveis para edição. A versão usada com clientes permanece preservada até aplicar as mudanças." };
}
