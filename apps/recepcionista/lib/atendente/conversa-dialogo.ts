import { z } from "zod";
import type { ConfiguracaoNexa, InformacaoNexa } from "./configuracao-schema";

export type FonteDialogoConfiguracao = { id: string; texto: string };

const REGRA_DE_ATUALIZACAO = "Se o atendente já tem uma configuração em uso, as mudanças confirmadas aqui atualizam essa configuração assim que são salvas. O que precisa esclarecer fica para revisão. Na primeira configuração, revise e teste antes de ativar o atendente.";

const FONTES_PRODUTO: FonteDialogoConfiguracao[] = [
  { id: "produto:topicos", texto: `Vamos conversar sobre sua empresa, o que você vende, preços, horários e regras. Pode escrever do seu jeito e continuar depois. As informações são salvas durante a conversa. ${REGRA_DE_ATUALIZACAO} O que você não informou fica em branco.` },
  { id: "produto:servicos", texto: "Informe os serviços reais da empresa, seus tipos, preços e duração quando houver. Um preço pode ser fixo ou sob consulta. Categorias amplas precisam ser detalhadas em serviços concretos; preços e duração desconhecidos podem ficar para depois. Não é necessário criar serviços que a empresa não oferece." },
  { id: "produto:objetivo", texto: "Receber pedidos: seu atendente reúne o que o cliente deseja e repassa à equipe para confirmar. Fazer agendamentos: ele ajuda a escolher um horário, envia o link ou registra uma reserva quando houver autorização e disponibilidade. Escolher esse objetivo não autoriza cobranças, cancelamentos ou remarcações." },
  { id: "produto:agenda", texto: "O agendamento direto depende de autorização da empresa e de disponibilidade na agenda. Uma reserva só pode ser confirmada depois de registrada com sucesso. Também é possível configurar envio do link de agendamento ou apenas tirar dúvidas. Perguntar sobre agenda não concede autorização para reservar, cancelar ou remarcar." },
  { id: "produto:teste", texto: "O teste mostra como seu atendente responde com o que você ensinou. Não envia mensagens pelo WhatsApp nem cria reservas reais. Você pode testar enquanto configura." },
  { id: "produto:conexao", texto: "Conectar o WhatsApp e ativar o atendimento são etapas diferentes. A conexão é feita na área de conexão da interface. Depois de revisar e testar a configuração, o responsável decide quando ativar o atendimento. A conversa de configuração não conecta nem ativa o WhatsApp e não precisa receber senhas, tokens ou chaves de API." },
  { id: "produto:humano", texto: "Quando uma pessoa da equipe assume uma conversa com um cliente, a IA fica pausada naquela conversa. O responsável pode revisar o atendimento pelo painel. Explicar essa possibilidade não significa que alguém já assumiu a conversa." },
];

const normalizar = (texto: string) => texto.normalize("NFD").replace(/\p{M}/gu, "").toLowerCase().replace(/\s+/g, " ").trim();
const segredo = /\b(?:sk[-_]|gsk_)[a-z0-9_-]{12,}|\bAIza[a-z0-9_-]{12,}|\bBearer\s+\S+|https?:\/\/[^\s/]+:[^\s/]+@|\b(?:senha|password|secret|segredo|token|api[_ -]?key|chave (?:da|de) api)\s*[:=]\s*\S+/i;
const instrucao = /\b(?:system prompt|prompt do sistema|mensagem de sistema|instru[cç][oõ]es (?:internas|do sistema)|ignore (?:as|suas|todas)|invente|finja|fingir)\b/i;
const pedidoDeSegredo = /\b(?:envie|informe|digite|passe|compartilhe|preciso|precisamos|me diga)\b.{0,70}\b(?:senhas?|tokens?|credenciais?|chaves? (?:da|de) api|api[_ -]?key)\b/i;

/** Explica somente a vigência das mudanças neste produto; não altera nem confirma um dado do negócio. */
export function explicacaoDaAtualizacaoDaConfiguracao(texto: string): { texto: string; somenteResposta: true } | null {
  if (!texto.trim() || texto.length > 1200 || segredo.test(texto) || instrucao.test(texto) || pedidoDeSegredo.test(texto)
    || /[\u0000-\u0008\u000b\u000c\u000e-\u001f]|\d|r\$|https?:\/\//i.test(texto)) return null;
  const t = normalizar(texto);
  if ((t.match(/\?/g)?.length ?? 0) > 1) return null;
  // O responsável pode esclarecer explicitamente que não está pedindo uma alteração.
  const consulta = t
    .replace(/\b(?:nao|nn|n) quero (?:alterar|mudar|trocar|atualizar)(?: nada)?(?: agora)?\b/g, "")
    .replace(/\bsem (?:alterar|mudar|trocar|atualizar)(?: nada)?(?: agora)?\b/g, "")
    .replace(/\b(?:so|apenas) quero (?:entender|saber|conferir)\b/g, "").trim();
  if (/\b(?:altere|mude|troque|atualize|corrija|defina|adicione|inclua|remova|exclua|apague|publique|ative|salve|envie|reserve|agende|gere)\b/.test(consulta)
    || /\b(?:quero|vamos|preciso|pode|consegue)(?: que voce)? (?:alterar|mudar|trocar|atualizar|corrigir|definir|publicar|ativar|salvar)\b/.test(consulta)
    || /\b(?:reajustes?|inflacao|contratos?|mensalidades?|anual|cobrar|cobro|cobranca|somos|oferecemos|aceitamos|funcionamos|nosso endereco|nossa empresa se chama|meu negocio se chama)\b/.test(consulta)
    || /\b(?:quanto custa|qual (?:e )?(?:o )?(?:preco|valor|nome|endereco)|qual (?:e )?(?:a )?duracao)\b/.test(consulta)) return null;
  const interrogativos = consulta.match(/\b(?:quando|como|qual|quais|onde|quanto|por que|porque)\b/g) ?? [];
  if (interrogativos.length > 1) return null;
  if (!/\?/.test(consulta) && !/^(?:se eu .{1,100},? )?(?:quando|em quanto tempo)\b/.test(consulta)) return null;
  if (!/\b(?:aqui|no painel|pelo painel|na configuracao|pela configuracao|nessa configuracao|nesta configuracao|nesta conversa|nessa conversa)\b/.test(consulta)
    || !/\b(?:atendente|atendimento|ia|robo)\b/.test(consulta)
    || !/\b(?:alteracoes?|alterar|altero|alterei|mudancas?|mudar|mudo|mudei|trocar|troco|troquei|atualizar|atualizacoes?|editar|edito|editada|editadas|informacoes?|dados?|precos?|salvas?|salvar)\b/.test(consulta)
    || !/\b(?:usa|usar|usado|usada|usados|usadas|vale|valer|aplica|aplicar|aplicadas?|entra|entrar|reflete|refletir|atualiza|atualizam|atualizado|atualizada|considera|responde|responder)\b/.test(consulta)
    || !/\b(?:quando|quanto tempo|na hora|imediatamente|automaticamente|ja|comeca)\b/.test(consulta)) return null;
  // Não deixa outra declaração ser silenciosamente descartada por esta resposta direta.
  const partes = consulta.split(/[.!?;\n]+/).map(p => p.trim()).filter(Boolean);
  if (partes.some(p => !/\b(?:quando|quanto tempo|na hora|imediatamente|automaticamente|ja|comeca)\b/.test(p)
    && !/^(?:oi|ola|bom dia|boa tarde|boa noite|por favor)$/.test(p))) return null;
  return { texto: REGRA_DE_ATUALIZACAO, somenteResposta: true };
}

/** Fontes de leitura da própria empresa; materiais e dados em revisão não autorizam afirmações. */
export function fontesDoDialogoConfiguracao(c: ConfiguracaoNexa): FonteDialogoConfiguracao[] {
  const fontes = FONTES_PRODUTO.map(fonte => ({ ...fonte }));
  const adicionar = (id: string, texto: string) => {
    const valor = texto.trim();
    if (valor && valor.length <= 6000 && !segredo.test(valor) && !instrucao.test(valor)) fontes.push({ id, texto: valor });
  };
  const confirmado = (id: string, rotulo: string, campo: InformacaoNexa) => {
    if (campo.situacao === "CONFIRMADO") adicionar(id, `${rotulo}: ${campo.valor}`);
  };
  if (c.negocio.nome.trim() && normalizar(c.negocio.nome) !== "minha empresa") adicionar("negocio:nome", `Nome cadastrado da empresa: ${c.negocio.nome}`);
  if (c.negocio.segmento.trim()) adicionar("negocio:segmento", `Área de atuação cadastrada: ${c.negocio.segmento}`);
  confirmado("negocio:descricao", "Descrição da empresa", c.negocio.descricao);
  confirmado("negocio:regiao", "Região atendida", c.negocio.regiao);
  confirmado("informacoes:endereco", "Endereço", c.informacoes.endereco);
  confirmado("informacoes:pagamento", "Formas de pagamento", c.informacoes.pagamento);
  if (c.informacoes.horariosSituacao === "CONFIRMADO") {
    const dias = ["domingo", "segunda-feira", "terça-feira", "quarta-feira", "quinta-feira", "sexta-feira", "sábado"];
    adicionar("informacoes:horarios", `Horários da empresa: ${c.informacoes.horarios.map(h => `${dias[h.day]}: ${h.closed ? "fechado" : `${h.open} às ${h.close}`}`).join("; ")}${c.informacoes.diasFechados.length ? `. Dias fechados: ${c.informacoes.diasFechados.join(", ")}` : ""}`);
  }
  for (const s of c.informacoes.servicos.filter(s => s.situacao === "CONFIRMADO")) {
    const preco = s.precoModo === "SOB_CONSULTA" ? "Preço sob consulta" : s.precoCents === null ? "Preço não informado" : `Preço: ${(s.precoCents / 100).toLocaleString("pt-BR", { style: "currency", currency: "BRL" }).replace(/\u00a0/g, " ")}`;
    adicionar(`servico:${s.id}`, `Serviço: ${s.nome}. ${preco}. ${s.duracaoMin === null ? "Duração não informada" : `Duração: ${s.duracaoMin} minutos`}.${s.descricao ? ` Descrição: ${s.descricao}` : ""}`);
  }
  for (const item of c.conhecimento.itens.filter(i => i.situacao === "CONFIRMADO")) adicionar(`regra:${item.id}`, `${item.pergunta} ${item.resposta}`);
  return fontes;
}

const dialogoSchema = z.object({
  intencao: z.enum(["INFORMAR", "PERGUNTAR", "CORRIGIR", "MISTO"]),
  resposta: z.string().trim().min(1).max(2500).nullable(),
  fontesIds: z.array(z.string().trim().min(1).max(240)).max(12),
}).strict();

const acaoAlegada = /\b(?:salvei|gravamos|gravei|registrei|anotei|conectei|conectamos|ativei|ativamos|publiquei|publicamos|reservei|reservamos|agendei|agendamos|cancelei|cancelamos|remarquei|remarcamos|enviei|enviamos|notifiquei|avisei|gerei|emitimos|emiti|conclui|concluimos|finalizei)\b|\b(?:vou|vamos)\s+(?:salvar|gravar|registrar|conectar|ativar|publicar|reservar|agendar|cancelar|remarcar|enviar|notificar|gerar|emitir|concluir)\b|\b(?:foi|foram|esta|estao|ficou|ficaram|ja)\s+(?:tudo\s+)?(?:salv[oa]s?|gravado|registrad[oa]s?|conectad[oa]s?|ativad[oa]s?|publicad[oa]s?|reservad[oa]s?|agendad[oa]s?|cancelad[oa]s?|remarcad[oa]s?|enviad[oa]s?|concluid[oa]s?|finalizad[oa]s?)\b|\b(?:configuracao|cadastro)\s+(?:complet[oa]|pront[oa]|concluid[oa])\b|\bpront[oa] para atender\b/;

function numeros(texto: string): string[] {
  return (texto.match(/\d+(?:[.,:]\d+)*/g) ?? []).map(valor => {
    if (valor.includes(":")) return valor.split(":").map(v => Number(v)).join(":");
    const decimal = valor.includes(",") ? valor.replace(/\./g, "").replace(",", ".") : /^\d{1,3}(?:\.\d{3})+$/.test(valor) ? valor.replace(/\./g, "") : valor;
    return String(Number(decimal));
  });
}

function valoresMonetarios(texto: string): string[] {
  return [...texto.matchAll(/(?:R\$\s*|\b(?:custa|pre[cç]o|valor)\s*:?\s*)(\d+(?:[.,]\d+)*)|(\d+(?:[.,]\d+)*)\s*reais?\b/gi)].flatMap(m => numeros(m[1] ?? m[2]));
}

function nomesConhecidos(resposta: string, fontes: FonteDialogoConfiguracao[]): boolean {
  // O vocabulário do produto cobre inícios comuns de frase sem autorizar nomes de outra empresa.
  const vocabulario = new Set(normalizar([...FONTES_PRODUTO, ...fontes].map(f => f.texto).join(" ")).match(/[a-z]+/g));
  for (const palavra of ["sim", "nao", "voce", "voces", "seu", "sua", "seus", "suas", "isso", "certo", "entendi", "claro", "otimo", "perfeito", "exatamente", "tudo", "caso", "importante", "podemos", "pode", "para", "como", "sobre", "nesse", "nessa", "neste", "nesta", "aqui", "antes", "depois", "tambem", "ainda", "cada", "basta", "assim", "obrigado", "obrigada", "um", "uma"]) vocabulario.add(palavra);
  return (resposta.match(/(?<![\p{L}\p{N}_])(?:\p{Lu}\p{Ll}{2,}|\p{Lu}{3,})(?![\p{L}\p{N}_])/gu) ?? []).every(nome => {
    const palavra = normalizar(nome);
    return vocabulario.has(palavra) || vocabulario.has(palavra.replace(/s$/, ""));
  });
}

function contradizNegacao(resposta: string, fontes: FonteDialogoConfiguracao[]): boolean {
  const negacao = /\b(?:nao|nunca|sem|nenhum|nenhuma|inexistente|indisponivel)\b/;
  const irrelevantes = new Set(["nao", "nunca", "sem", "nenhum", "nenhuma", "temos", "tem", "somos", "esta", "estao", "aceita", "aceitam", "aceitamos", "atende", "atendem", "atendemos", "oferece", "oferecem", "oferecemos", "faz", "fazemos", "proprio", "propria", "informado", "informada", "servico", "empresa", "formas", "forma", "pagamento", "regra", "regras"]);
  const trechos = normalizar(resposta).split(/[.!;\n]/).filter(Boolean);
  return fontes.filter(f => !f.id.startsWith("produto:")).some(fonte => normalizar(fonte.texto).split(/[.!;\n]/).some(trecho => {
    if (!negacao.test(trecho)) return false;
    const assuntos = (trecho.match(/[a-z]{3,}/g) ?? []).filter(palavra => !irrelevantes.has(palavra));
    return assuntos.length > 0 && trechos.some(respostaTrecho => !negacao.test(respostaTrecho)
      && assuntos.some(assunto => new RegExp(`\\b${assunto}\\b`).test(respostaTrecho)));
  }));
}

/** Apenas explica: o retorno jamais deve ser aplicado como configuração ou execução. */
export function respostaDoDialogoConfiguracao(extracao: unknown, c: ConfiguracaoNexa, textoAtual: string): { texto: string; somenteResposta: boolean } | null {
  if (!extracao || typeof extracao !== "object" || Array.isArray(extracao)) return null;
  const resultado = dialogoSchema.safeParse((extracao as Record<string, unknown>).dialogo);
  if (!resultado.success || !resultado.data.resposta) return null;
  const { intencao, resposta, fontesIds } = resultado.data;
  if (/[?\u0000-\u0008\u000b\u000c\u000e-\u001f]/.test(resposta) || segredo.test(resposta) || instrucao.test(resposta) || pedidoDeSegredo.test(resposta) || acaoAlegada.test(normalizar(resposta))
    || /^(?:salvo|pronto|feito|conectado|ativado|publicado|concluido)[.!\s]*$/.test(normalizar(resposta))) return null;
  const catalogo = new Map(fontesDoDialogoConfiguracao(c).map(f => [f.id, f]));
  if (fontesIds.some(id => !catalogo.has(id))) return null;
  const fontes = [...new Set(fontesIds)].map(id => catalogo.get(id)!);
  if (!fontes.length) {
    const acolhimento = /^(?:entendi|certo|combinado|claro|perfeito|obrigad[oa])(?:[.!,:\s]+(?:podemos continuar|pode continuar|vamos por partes|vamos continuar|vamos organizar por partes|vamos terminar a lista|deixamos (?:os precos|os valores|essa parte) para depois|pode me contar do seu jeito|me conte do seu jeito))*[.!\s]*$/i;
    return intencao !== "PERGUNTAR" && intencao !== "MISTO" && acolhimento.test(normalizar(resposta))
      ? { texto: resposta, somenteResposta: false } : null;
  }
  const base = fontes.map(f => f.texto).join("\n");
  const permitidos = new Set(numeros(base));
  const precos = new Set(valoresMonetarios(base));
  if (numeros(resposta).some(numero => !permitidos.has(numero)) || valoresMonetarios(resposta).some(valor => !precos.has(valor))) return null;
  if (!nomesConhecidos(resposta, fontes) || contradizNegacao(resposta, fontes)) return null;
  // Links só podem repetir uma fonte citada; a mensagem atual, sozinha, não prova um fato.
  if ((resposta.match(/https?:\/\/[^\s)]+/g) ?? []).some(url => !base.includes(url))) return null;
  if (/\b(?:posso|pode|vai|consegue)\s+(?:confirmar|reservar|agendar)\b/.test(normalizar(resposta)) && c.atendimento.agendamento !== "DIRETO"
    && !/\b(?:se|quando|apos|depois|depende|autorizacao)\b/.test(normalizar(resposta))) return null;
  // Uma dúvida hipotética do dono não autoriza números ou nomes novos fora das fontes.
  void textoAtual;
  return { texto: resposta, somenteResposta: intencao === "PERGUNTAR" };
}

/** Se a redação livre falhar na validação, explica pelo texto aprovado que o modelo selecionou. */
export function explicacaoDoProdutoPorFonte(extracao: unknown, fontesSelecionadas: FonteDialogoConfiguracao[], textoAtual: string): { texto: string; somenteResposta: boolean } | null {
  if (!extracao || typeof extracao !== "object") return null;
  const parsed = dialogoSchema.safeParse((extracao as Record<string, unknown>).dialogo);
  if (!parsed.success) return null;
  const d = parsed.data;
  const pergunta = d.intencao === "PERGUNTAR" || d.intencao === "MISTO" || textoAtual.includes("?");
  if (!pergunta || !d.fontesIds.length) return null;
  // Uma dúvida sobre preço, regra ou outro dado da empresa não vira um tutorial do produto.
  if (d.fontesIds.some(id => !id.startsWith("produto:"))) return null;
  const permitidas = new Set(fontesSelecionadas.map(f => f.id));
  if (d.fontesIds.some(id => !permitidas.has(id))) return null;
  const fonte = fontesSelecionadas.find(f => d.fontesIds.includes(f.id) && FONTES_PRODUTO.some(p => p.id === f.id));
  const original = FONTES_PRODUTO.find(p => p.id === fonte?.id);
  return original ? { texto: original.texto, somenteResposta: d.intencao === "PERGUNTAR" } : null;
}
