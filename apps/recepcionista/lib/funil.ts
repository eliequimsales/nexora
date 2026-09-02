/**
 * INSTRUMENTAÇÃO DO FUNIL — cinco eventos, nem um a mais.
 *
 * Achado da auditoria: em todo o app não existia UM evento de funil. Zero
 * gtag, zero fbq, zero tabela. Consequência prática: "4% completam o
 * diagnóstico" era estimativa, e toda a análise de onde investir estava
 * calcada num número que ninguém tinha observado.
 *
 * Gastar em anúncio sem isto compra aprendizado nenhum. Você saberia quanto
 * gastou e quantos assinaram, e NADA sobre onde as pessoas desistem — que é a
 * única informação capaz de dizer o que consertar.
 *
 * POR QUE CINCO, E NÃO VINTE. Cinco cobrem o funil inteiro e cabem numa frase.
 * Vinte viram um painel que ninguém abre, e o Artigo X proíbe dashboard de
 * vaidade. Cada evento aqui responde a uma pergunta que muda uma decisão:
 *
 *   chegou           quanto custou trazer alguém
 *   comecou_entrada  o anúncio prometeu o que a página entrega?
 *   viu_numero       a PORTA abriu? (a etapa que a sensibilidade apontou)
 *   clicou_mensagem  ele agiu, ou só olhou?
 *   criou_conta      virou relação
 *
 * O QUE NUNCA ENTRA: conteúdo. Nem nome de cliente, nem trecho de lista, nem
 * telefone. A página promete "sua lista não é gravada" sem ressalva, e um
 * evento de analytics é gravação como qualquer outra.
 */

export const EVENTOS = [
  "chegou",
  "comecou_entrada",
  "viu_numero",
  "clicou_mensagem",
  "criou_conta",
] as const;

export type NomeDeEvento = (typeof EVENTOS)[number];

export type EventoFunil = {
  nome: NomeDeEvento;
  /** Qual anúncio trouxe. Vem do `?c=` da URL, sempre higienizado. */
  criativo: string | null;
  /** Identificador anônimo da sessão, para ligar as etapas sem identificar gente. */
  sessao: string | null;
};

export function ehEventoValido(nome: unknown): nome is NomeDeEvento {
  return typeof nome === "string" && (EVENTOS as readonly string[]).includes(nome);
}

/**
 * O `?c=` vem de fora e vira chave de agrupamento indexada no banco.
 *
 * Sem limpeza, é entrada de usuário não validada num campo indexado — e quem
 * manda a URL escolhe a cardinalidade da tabela, o que é um jeito barato de
 * encher o banco. Identificador de criativo é coisa curta que você mesmo
 * escolhe: letras, números, hífen e sublinhado.
 */
const FORMATO = /^[a-z0-9_-]{1,32}$/;

export function limparCriativo(bruto: string | null | undefined): string | null {
  if (typeof bruto !== "string") return null;
  const limpo = bruto.trim().toLowerCase();
  return FORMATO.test(limpo) ? limpo : null;
}

/**
 * PRAZO DE VALIDADE DA TABELA.
 *
 * `/api/funil` é a primeira rota pública de ESCRITA do produto — o resto exige
 * sessão, e ela não pode, porque o funil começa antes de existir conta. Isso
 * muda o modelo de ameaça dela.
 *
 * Um IP sozinho grava ~8.600 linhas por dia dentro do limite; cem IPs gravam
 * perto de 1 GB por mês. Não havia limpeza nenhuma, e o banco é um Postgres de
 * plano Hobby. O relatório só olha 14 dias; guardar 90 dá folga para comparar
 * um mês com o anterior, e nada além disso é custo sem uso.
 */
export const RETENCAO_DIAS = 90;

/**
 * TETO GLOBAL POR JANELA.
 *
 * O rate limit por IP não protege contra tráfego distribuído: mil IPs de um
 * botnet passam por ele sem esforço. Este é o disjuntor — acima dele o evento
 * é descartado em silêncio.
 *
 * Perder métrica num pico é irrelevante; perder o banco não é. E o número é
 * folgado o suficiente para nunca ser atingido por tráfego real: 20 mil eventos
 * em 10 minutos são ~4.000 visitas legítimas no mesmo intervalo.
 */
export const TETO_GLOBAL_POR_JANELA = 20_000;

export function cabeMaisEvento(jaGravados: number): boolean {
  if (!Number.isFinite(jaGravados) || jaGravados < 0) return false;
  return jaGravados < TETO_GLOBAL_POR_JANELA;
}
