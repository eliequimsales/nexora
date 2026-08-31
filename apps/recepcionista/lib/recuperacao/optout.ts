/**
 * OPT-OUT POR TEXTO.
 *
 * Decide se uma mensagem RECEBIDA de um cliente é um pedido para parar de
 * receber mensagens. Puro, sem I/O, porque a decisão precisa ser auditável:
 * silenciar alguém para sempre é irreversível na prática — o cliente nunca
 * mais aparece em onda nenhuma, e o dono não fica sabendo por quê.
 *
 * A ASSIMETRIA QUE MANDA AQUI
 * Falso positivo: silencia um cliente que estava voltando. Invisível, definitivo,
 * e o dono perde dinheiro sem nunca descobrir a causa.
 * Falso negativo: o dono marca na mão, no botão que existe na Onda.
 * Os dois custos não são do mesmo tamanho. Na dúvida, NÃO marcar.
 *
 * POR QUE ISSO É DIFÍCIL EM PORTUGUÊS BRASILEIRO
 * Em barbearia e salão, "parar" quase nunca é "pare de falar comigo" — é PASSAR
 * LÁ: "vou parar aí sábado". E "cancelar" quase sempre é o HORÁRIO, não o
 * cadastro: "quero cancelar meu horário". As duas palavras que um filtro ingênuo
 * usaria são justamente as duas que mais aparecem na boca de quem está voltando.
 *
 * Por isso a regra não é "contém a palavra". É:
 *   1. a mensagem INTEIRA ser um comando de uma palavra ("PARAR", "SAIR"), ou
 *   2. conter uma frase que não tem outra leitura ("não quero mais receber").
 *
 * "cancelar" sozinho ficou DE FORA de propósito. "quero cancelar" num salão é
 * desmarcar horário; tratar como descadastro silenciaria o cliente mais ativo.
 */

/** Minúsculas, sem acento, só letras e espaço, espaços colapsados. */
function normalizar(texto: string): string {
  return texto
    .normalize("NFD")
    .replace(/[̀-ͯ]/g, "")
    .toLowerCase()
    .replace(/[^a-z\s]/g, " ")
    .replace(/\s+/g, " ")
    .trim();
}

/**
 * Comandos que só fazem sentido como "pare". Casam apenas se forem a mensagem
 * INTEIRA — "vou parar ai" tem três palavras e não entra aqui.
 */
const COMANDOS = new Set([
  "parar",
  "pare",
  "parem",
  "sair",
  "stop",
  "descadastrar",
  "descadastro",
  "cancelar inscricao",
  "cancelar cadastro",
  "sair da lista",
]);

/**
 * Frases sem segunda leitura. Note que "nao quero mais" sozinho NÃO está aqui:
 * "não quero mais aquele corte, quero outro" é um cliente escolhendo, não saindo.
 */
const FRASES: RegExp[] = [
  /\bnao quero (mais )?receber\b/,
  /\bnao quero mais mensagens\b/,
  /\bnao quero receber mais\b/,
  /\bpar(e|a|em) de (me )?(mandar|enviar)\b/,
  /\bnao me (mande|manda|mandem|envie) mais\b/,
  /\bnao (envie|envia|enviem) mais\b/,
  /\bme (tira|tire|tirem) (da|dessa|desta) lista\b/,
  /\btirar? meu (numero|contato) da lista\b/,
  /\bme (descadastr|remov)\w*/,
  /\bremover? meu (numero|contato)\b/,
  /\bremover? da lista\b/,
];

export function pediuParaParar(texto: string): boolean {
  if (typeof texto !== "string") return false;

  const t = normalizar(texto);
  if (!t) return false;

  if (COMANDOS.has(t)) return true;
  return FRASES.some((r) => r.test(t));
}
