import { randomUUID } from "node:crypto";
import { z } from "zod";
import type { ConfiguracaoNexa, ServicoNexa } from "./configuracao-schema";
import type { PerguntaDeConfiguracao } from "./conversa-schema";

const operacoes = ["CRIAR", "ATUALIZAR", "ESPECIFICAR"] as const;
const listas = ["MANTER", "CONTINUAR", "CONCLUIDA", "REABRIR"] as const;
export const camposSemanticaServico = {
  operacao: z.enum(operacoes).nullable().default(null),
  servicoId: z.string().trim().min(1).max(180).nullable().default(null),
  categoria: z.string().trim().min(1).max(140).nullable().default(null),
  condicaoPreco: z.string().trim().min(1).max(1000).nullable().default(null),
};
export const semanticaDoServicoSchema = z.object(camposSemanticaServico).strict();
export const FORMATO_SEMANTICA_DO_SERVICO = {
  operacao: { type: ["string", "null"], enum: [...operacoes, null] },
  servicoId: { type: ["string", "null"] },
  categoria: { type: ["string", "null"] },
  condicaoPreco: { type: ["string", "null"] },
};
export const conducaoDaConversaSchema = z.object({
  listaServicos: z.enum(listas),
  servicoEmFocoId: z.string().trim().min(1).max(180).nullable(),
  evidencia: z.string().trim().min(1).max(3000),
}).strict().nullable().default(null);
export const FORMATO_CONDUCAO_DA_CONVERSA = { anyOf: [{
  type: "object", additionalProperties: false,
  properties: { listaServicos: { type: "string", enum: [...listas] }, servicoEmFocoId: { type: ["string", "null"] }, evidencia: { type: "string" } },
  required: ["listaServicos", "servicoEmFocoId", "evidencia"],
}, { type: "null" }] };

export type ItemServicoSemantico = {
  nome: string; evidencia: string;
  operacao?: typeof operacoes[number] | null;
  servicoId?: string | null;
  categoria?: string | null;
  condicaoPreco?: string | null;
};
export type ResultadoSemanticaServicos = {
  rascunho: ConfiguracaoNexa;
  alteracoes: string[];
  remapeamentosIds: Record<string, string>;
  esclarecimento?: PerguntaDeConfiguracao;
};
const itemSchema = z.object({
  nome: z.string().trim().min(2).max(140), evidencia: z.string().trim().min(1).max(3000), ...camposSemanticaServico,
}).passthrough();
const normal = (t: string) => t.normalize("NFD").replace(/\p{M}/gu, "").toLowerCase().replace(/\s+/g, " ").trim();
const escapar = (t: string) => t.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
const contemNome = (t: string, nome: string) => new RegExp(`(?<![a-z0-9])${escapar(normal(nome))}(?![a-z0-9])`).test(normal(t));
const trechos = (t: string) => t.split(/(?<=[.!?;])\s+|\n+|,\s*(?=(?:mas\s+)?(?:e|o servico e|a categoria e|eu faco|fazemos|oferecemos|temos)\b)/iu).map(p => p.trim()).filter(Boolean);
const seguro = (t: string) => {
  const n = normal(t);
  const semRetomadaDoDono = n.replace(/\beu (?:ja )?(?:disse|falei|expliquei|comentei)\b/g, "");
  return !t.includes("?") && !/^(?:quanto|qual|quais|como|posso|podemos|poderia|sera|suponha|imagine|se\b|caso\b|talvez)\b/.test(n)
    && !/\b(?:hipoteticamente|hipotetico|exemplo|talvez|se fosse|se for|se tivesse|se tiver|nao|nunca|nem|jamais)\b/.test(n)
    && !/\b(?:disse|falou|disseram|me contaram|me disseram|ouvi dizer|segundo|ignore|invente|finja|prompt|senha|token)\b/.test(semRetomadaDoDono);
};
function fonteLiteral(evidencia: string, fontes: string[]): boolean {
  const partes = trechos(evidencia).map(p => p.replace(/[.!;]+$/, ""));
  return partes.length > 0 && fontes.some(fonte => partes.every(p => normal(fonte).includes(normal(p))));
}
function declarado(valor: string, fontes: string[]): boolean {
  return fontes.some(fonte => trechos(fonte).some(p => contemNome(p, valor) && seguro(p)));
}
function completarDescricao(original: string, categoria: string | null, condicao: string | null): string | null {
  let linhas = original.split(/\r?\n/).map(p => p.trim()).filter(Boolean);
  for (const [rotulo, valor] of [["Categoria", categoria], ["Condição de preço", condicao]] as const) {
    if (valor === null) continue;
    linhas = linhas.filter(p => !normal(p).startsWith(`${normal(rotulo)}:`));
    linhas.push(`${rotulo}: ${valor.replace(/[.!]+$/, "")}.`);
  }
  const valor = [...new Map(linhas.map(p => [normal(p), p])).values()].join("\n");
  return valor.length <= 1500 ? valor : null;
}
const stub = (s: ServicoNexa) => s.precoCents === null && s.duracaoMin === null;
const condicaoNaDescricao = (s: ServicoNexa) => s.descricao.split(/\r?\n/).filter(p => /^condicao de preco:/i.test(normal(p))).map(normal).join("|");

/** Só interpreta identidade e regras literais autorizadas; valores numéricos ficam no motor. */
export function aplicarSemanticaDosServicos(c: ConfiguracaoNexa, itens: readonly ItemServicoSemantico[], textoAtual: string,
  opcoes: { propostaConfirmada?: string } = {}): ResultadoSemanticaServicos {
  let rascunho = structuredClone(c);
  const alteracoes: string[] = [];
  const remapeamentosIds: Record<string, string> = {};
  let esclarecimento: PerguntaDeConfiguracao | undefined;
  const fontes = [textoAtual, opcoes.propostaConfirmada].filter((v): v is string => Boolean(v?.trim()))
    .filter(v => !/\b(?:nao|nn)\s+(?:quero\s+(?:alterar|mudar|trocar|salvar)|(?:mude|altere|troque|salve|atualize))\b/.test(normal(v)));
  const esclarecer = (texto = "Qual serviço você quer corrigir?") => {
    esclarecimento ??= { chave: "esclarecimento:informacoes.servicos", texto, sugestoes: rascunho.informacoes.servicos.slice(0, 4).map(s => s.nome) };
  };
  const resolverId = (id: string) => {
    const vistos = new Set<string>();
    while (remapeamentosIds[id] && !vistos.has(id)) { vistos.add(id); id = remapeamentosIds[id]; }
    return id;
  };
  for (const entrada of itens) {
    // O contrato anterior não contém ações semânticas; seu comportamento fica no chamador.
    if (!entrada.operacao && !entrada.servicoId && !entrada.categoria && !entrada.condicaoPreco) continue;
    const parsed = itemSchema.safeParse(entrada);
    if (!parsed.success) { esclarecer(); continue; }
    const s = parsed.data;
    // Repetir um dado antigo no JSON não é uma nova dúvida do dono. Descarte
    // o patch sem prova atual; não peça ao responsável para explicar de novo.
    if (!fonteLiteral(s.evidencia, fontes)) continue;
    // Campos opcionais repetidos do cadastro não são uma alteração nova. Uma
    // condição antiga não pode bloquear, por exemplo, uma duração dita agora.
    if (s.categoria && !declarado(s.categoria, fontes)) s.categoria = null;
    if (s.condicaoPreco && !declarado(s.condicaoPreco, fontes)) s.condicaoPreco = null;
    if (s.servicoId && !c.informacoes.servicos.some(v => v.id === s.servicoId)) { esclarecer(); continue; }
    if ((s.operacao === "ATUALIZAR" || s.operacao === "ESPECIFICAR") && !s.servicoId) { esclarecer(); continue; }
    if (s.operacao === "CRIAR" && s.servicoId) { esclarecer(); continue; }
    const candidato = structuredClone(rascunho);
    let alvo = s.servicoId ? candidato.informacoes.servicos.find(v => v.id === resolverId(s.servicoId!)) : undefined;
    const novosMapas: Record<string, string> = {};
    const original = s.servicoId ? c.informacoes.servicos.find(v => v.id === s.servicoId) : undefined;
    const aliasAntigo = s.operacao === "ATUALIZAR" && original && alvo && original.id !== alvo.id && normal(original.nome) === normal(s.nome);
    const nomeAplicado = aliasAntigo && alvo ? alvo.nome : s.nome;
    const nomeNovo = !alvo || normal(alvo.nome) !== normal(nomeAplicado);
    if (nomeNovo && !declarado(s.nome, fontes)) { esclarecer("Qual é o nome do serviço que você quer cadastrar?"); continue; }
    if (alvo && nomeNovo && s.operacao !== "ATUALIZAR" && s.operacao !== "ESPECIFICAR") { esclarecer(); continue; }
    if (!alvo) {
      if (s.operacao !== "CRIAR") { esclarecer(); continue; }
      // Uma criação comum continua no motor numérico. Criamos apenas o alvo
      // necessário para a categoria ou a regra de preço não se perderem.
      if (!s.categoria && !s.condicaoPreco) continue;
      alvo = candidato.informacoes.servicos.find(v => normal(v.nome) === normal(s.nome));
      if (!alvo) {
        alvo = { id: `novo:${randomUUID()}`, nome: s.nome, descricao: "", precoModo: "FIXO", precoCents: null, duracaoMin: null, situacao: "CONFIRMADO", origem: "ASSISTENTE" };
        candidato.informacoes.servicos.push(alvo);
      }
    }
    const colisoes = candidato.informacoes.servicos.filter(v => v.id !== alvo!.id && normal(v.nome) === normal(nomeAplicado));
    if (colisoes.length > 1) { esclarecer("Há mais de um cadastro com esse nome. Qual serviço você quer corrigir?"); continue; }
    const outro = colisoes[0];
    if (outro) {
      const condicoesDiferentes = condicaoNaDescricao(alvo) && condicaoNaDescricao(outro) && condicaoNaDescricao(alvo) !== condicaoNaDescricao(outro);
      if ((!stub(alvo) && !stub(outro)) || condicoesDiferentes) {
        esclarecer(`Já existe ${outro.nome} com outras informações. Qual serviço você quer manter?`); continue;
      }
      // Só a duplicata sem preço nem duração é retirada. O cadastro concreto e
      // sua identidade sobrevivem, inclusive quando ele era o alvo original.
      const manter = stub(alvo) ? outro : alvo;
      const retirar = manter.id === alvo.id ? outro : alvo;
      const descricao = completarDescricao([manter.descricao, retirar.descricao].filter(Boolean).join("\n"), s.categoria, s.condicaoPreco);
      if (descricao === null) { esclarecer("Pode resumir as informações que devem ficar nesse serviço?"); continue; }
      manter.descricao = descricao;
      candidato.informacoes.servicos = candidato.informacoes.servicos.filter(v => v.id !== retirar.id);
      novosMapas[retirar.id] = manter.id;
      alvo = manter;
    }
    if (normal(alvo.nome) !== normal(nomeAplicado)) alvo.nome = nomeAplicado;
    const descricao = completarDescricao(alvo.descricao, s.categoria, s.condicaoPreco);
    if (descricao === null) { esclarecer("Pode resumir as informações que devem ficar nesse serviço?"); continue; }
    alvo.descricao = descricao;
    if (s.condicaoPreco) { alvo.precoModo = "SOB_CONSULTA"; alvo.precoCents = null; }
    if (JSON.stringify(candidato) === JSON.stringify(rascunho)) continue;
    alvo.origem = "ASSISTENTE";
    rascunho = candidato;
    Object.assign(remapeamentosIds, novosMapas);
    alteracoes.push(`Serviço: ${alvo.nome}`);
  }
  return { rascunho, alteracoes: [...new Set(alteracoes)], remapeamentosIds, ...(esclarecimento ? { esclarecimento } : {}) };
}
