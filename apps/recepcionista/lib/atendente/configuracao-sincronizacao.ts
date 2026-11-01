import type { ConfiguracaoNexa, InformacaoNexa, PerguntaNexa, ServicoNexa } from "./configuracao-schema";

const igual = (a: unknown, b: unknown) => JSON.stringify(a) === JSON.stringify(b);
const objeto = (valor: unknown): valor is Record<string, unknown> => valor !== null && typeof valor === "object" && !Array.isArray(valor);

/** Aplica folhas alteradas, usando a publicação como base em vez do rascunho inteiro. */
function projetarCampos<T>(anterior: T, atual: T, publicada: T): T {
  if (igual(anterior, atual)) return structuredClone(publicada);
  if (!objeto(anterior) || !objeto(atual)) return structuredClone(atual);
  const resultado: Record<string, unknown> = objeto(publicada) ? structuredClone(publicada) : {};
  for (const chave of new Set([...Object.keys(anterior), ...Object.keys(atual)])) {
    if (igual(anterior[chave], atual[chave])) continue;
    if (!Object.prototype.hasOwnProperty.call(atual, chave)) delete resultado[chave];
    else resultado[chave] = projetarCampos(anterior[chave], atual[chave], resultado[chave]);
  }
  return resultado as T;
}

function projetarInformacao(anterior: InformacaoNexa, atual: InformacaoNexa, publicada: InformacaoNexa): InformacaoNexa {
  if (igual(anterior, atual)) return structuredClone(publicada);
  if (atual.situacao === "CONFIRMADO" && !atual.valor.trim()) return structuredClone(publicada);
  // Confirmar uma informação revisada aprova o seu conteúdo, não o valor antigo publicado.
  if (atual.situacao === "CONFIRMADO" && anterior.situacao !== "CONFIRMADO") return structuredClone(atual);
  const resultado = projetarCampos(anterior, atual, publicada);
  // Um texto novo em revisão nunca herda o selo CONFIRMADO da versão anterior.
  if (atual.situacao !== "CONFIRMADO") resultado.situacao = atual.situacao;
  return resultado;
}

/** Valores acrescentados/removidos são explícitos; diferenças anteriores ficam intactas. */
function projetarListaDeValores<T extends string>(anterior: T[], atual: T[], publicada: T[]): T[] {
  if (igual(anterior, atual)) return structuredClone(publicada);
  const resultado = publicada.filter(item => !anterior.includes(item) || atual.includes(item));
  for (const item of atual) if (!anterior.includes(item) && !resultado.includes(item)) resultado.push(item);
  return resultado;
}

function projetarListaPorId<T extends { id: string }>(anterior: T[], atual: T[], publicada: T[],
  projetarItem: (anterior: T | undefined, atual: T, publicada: T | undefined) => T | null): T[] {
  if (igual(anterior, atual)) return structuredClone(publicada);
  const antes = new Map(anterior.map(item => [item.id, item]));
  const depois = new Map(atual.map(item => [item.id, item]));
  const resultado = publicada.filter(item => !antes.has(item.id) || depois.has(item.id)).map(item => structuredClone(item));
  for (const item of atual) {
    const previa = antes.get(item.id);
    if (previa && igual(previa, item)) continue;
    const indice = resultado.findIndex(publicado => publicado.id === item.id);
    const novo = projetarItem(previa, item, indice >= 0 ? resultado[indice] : undefined);
    if (!novo) continue;
    if (indice >= 0) resultado[indice] = novo;
    else resultado.push(novo);
  }
  return resultado;
}

type ItemComSituacao = ServicoNexa | PerguntaNexa;
function projetarItemConfirmavel<T extends ItemComSituacao>(anterior: T | undefined, atual: T, publicada: T | undefined): T | null {
  if (!publicada) return atual.situacao === "CONFIRMADO" ? structuredClone(atual) : null;
  if (!anterior || atual.situacao === "CONFIRMADO" && anterior.situacao !== "CONFIRMADO") return structuredClone(atual);
  const resultado = projetarCampos(anterior, atual, publicada);
  if (atual.situacao !== "CONFIRMADO") resultado.situacao = atual.situacao;
  return resultado;
}

function projetarServico(anterior: ServicoNexa | undefined, atual: ServicoNexa, publicada: ServicoNexa | undefined): ServicoNexa | null {
  // O formulário salva a digitação intermediária no rascunho; ela não apaga o dado em uso.
  if (atual.situacao === "CONFIRMADO" && (atual.nome.trim().length < 2
    || atual.precoModo === "FIXO" && (atual.precoCents === null || !Number.isInteger(atual.precoCents) || atual.precoCents < 0))) {
    return publicada ? structuredClone(publicada) : null;
  }
  const resultado = projetarItemConfirmavel(anterior, atual, publicada);
  if (!resultado) return null;
  // A modalidade e o número formam um preço; não é válido atualizar apenas uma metade.
  if (!anterior || anterior.precoCents !== atual.precoCents || anterior.precoModo !== atual.precoModo) {
    resultado.precoCents = atual.precoCents;
    resultado.precoModo = atual.precoModo;
  }
  return resultado;
}

function projetarPergunta(anterior: PerguntaNexa | undefined, atual: PerguntaNexa, publicada: PerguntaNexa | undefined): PerguntaNexa | null {
  if (atual.situacao === "CONFIRMADO" && (!atual.pergunta.trim() || !atual.resposta.trim())) return publicada ? structuredClone(publicada) : null;
  return projetarItemConfirmavel(anterior, atual, publicada);
}

function horariosCompletos(horarios: ConfiguracaoNexa["informacoes"]["horarios"]): boolean {
  const hora = /^([01]\d|2[0-3]):[0-5]\d$/;
  return horarios.length === 7 && new Set(horarios.map(h => h.day)).size === 7
    && horarios.every(h => Number.isInteger(h.day) && h.day >= 0 && h.day <= 6
      && (h.closed || hora.test(h.open) && hora.test(h.close) && h.open < h.close));
}

/**
 * Sincroniza somente a edição desta operação com uma publicação já existente.
 * Não publica diferenças antigas do rascunho, não ativa o canal e não aprova materiais.
 * O chamador deve persistir a configuração e suas projeções na mesma transação.
 */
export function projetarAlteracoesDaConfiguracao(anterior: ConfiguracaoNexa, atual: ConfiguracaoNexa, publicada: ConfiguracaoNexa): ConfiguracaoNexa {
  const resultado = projetarCampos(anterior, atual, publicada);
  for (const campo of ["nome", "segmento"] as const) {
    if (atual.negocio[campo].trim().length < 2 || campo === "nome" && atual.negocio.nome.trim().toLocaleLowerCase("pt-BR") === "minha empresa") resultado.negocio[campo] = publicada.negocio[campo];
  }
  if (atual.atendimento.nome.trim().length < 2) resultado.atendimento.nome = publicada.atendimento.nome;
  resultado.negocio.regiao = projetarInformacao(anterior.negocio.regiao, atual.negocio.regiao, publicada.negocio.regiao);
  resultado.negocio.descricao = projetarInformacao(anterior.negocio.descricao, atual.negocio.descricao, publicada.negocio.descricao);
  resultado.informacoes.endereco = projetarInformacao(anterior.informacoes.endereco, atual.informacoes.endereco, publicada.informacoes.endereco);
  resultado.informacoes.pagamento = projetarInformacao(anterior.informacoes.pagamento, atual.informacoes.pagamento, publicada.informacoes.pagamento);
  resultado.informacoes.servicos = projetarListaPorId(anterior.informacoes.servicos, atual.informacoes.servicos, publicada.informacoes.servicos, projetarServico);
  resultado.conhecimento.itens = projetarListaPorId(anterior.conhecimento.itens, atual.conhecimento.itens, publicada.conhecimento.itens, projetarPergunta);
  resultado.informacoes.diasFechados = projetarListaDeValores(anterior.informacoes.diasFechados, atual.informacoes.diasFechados, publicada.informacoes.diasFechados);
  resultado.atendimento.handoffKeywords = projetarListaDeValores(anterior.atendimento.handoffKeywords, atual.atendimento.handoffKeywords, publicada.atendimento.handoffKeywords);

  const horariosMudaram = !igual(anterior.informacoes.horarios, atual.informacoes.horarios);
  const situacaoMudou = anterior.informacoes.horariosSituacao !== atual.informacoes.horariosSituacao;
  if ((horariosMudaram || situacaoMudou) && atual.informacoes.horariosSituacao === "CONFIRMADO" && !horariosCompletos(atual.informacoes.horarios)) {
    resultado.informacoes.horarios = structuredClone(publicada.informacoes.horarios);
    resultado.informacoes.horariosSituacao = publicada.informacoes.horariosSituacao;
  } else if (!horariosMudaram && !situacaoMudou) resultado.informacoes.horarios = structuredClone(publicada.informacoes.horarios);
  else if (atual.informacoes.horariosSituacao === "CONFIRMADO" && anterior.informacoes.horariosSituacao !== "CONFIRMADO") {
    resultado.informacoes.horarios = structuredClone(atual.informacoes.horarios);
  } else {
    const previos = anterior.informacoes.horarios.map(h => ({ ...h, id: String(h.day) }));
    const atuais = atual.informacoes.horarios.map(h => ({ ...h, id: String(h.day) }));
    const publicados = publicada.informacoes.horarios.map(h => ({ ...h, id: String(h.day) }));
    resultado.informacoes.horarios = projetarListaPorId(previos, atuais, publicados, (antes, depois, publicado) =>
      antes && publicado ? projetarCampos(antes, depois, publicado) : structuredClone(depois)).map(({ id: _id, ...h }) => h);
  }
  if ((horariosMudaram || situacaoMudou) && atual.informacoes.horariosSituacao !== "CONFIRMADO") resultado.informacoes.horariosSituacao = atual.informacoes.horariosSituacao;

  if (!igual(anterior.materiais, atual.materiais)) {
    if (atual.materiais === undefined) delete resultado.materiais;
    else resultado.materiais = projetarListaPorId(anterior.materiais ?? [], atual.materiais, publicada.materiais ?? [], (antes, depois, publicado) =>
      antes && publicado ? projetarCampos(antes, depois, publicado) : structuredClone(depois));
  }
  return resultado;
}
