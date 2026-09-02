import { emReais } from "@/lib/billing/preco";
import type { Mensagem } from "./email";

/**
 * O GATILHO EXTERNO DO RITUAL DE SEGUNDA.
 *
 * Os onze momentos da régua são todos de ciclo de vida — TRIAL_ACABANDO,
 * CANCELOU, SEM_USO, PAGAMENTO_FALHOU. Cada um é enviado UMA vez na vida da
 * conta. Consequência: um assinante ATIVO nunca mais recebe nada.
 *
 * E a "Onda de segunda" depende inteiramente de o barbeiro lembrar sozinho, na
 * segunda de manhã, que é o dia mais cheio da semana dele. Hábito sem gatilho
 * externo não é hábito — é intenção.
 *
 * Isso vale muito, e dá para calcular quanto: com 6 meses de vida média o
 * anúncio precisa de 27 assinantes para se pagar; com 12 meses, de 13. Dobrar
 * a retenção vale tanto quanto dobrar a conversão, e é bem mais barato.
 *
 * COMO CONVIVE COM A REGRA DE "UM MOMENTO, UMA VEZ": a chave do momento carrega
 * a semana — `ONDA:2026-W36`. O `@@unique([companyId, momento])` que já existe
 * no model Reengajamento passa a garantir um envio por semana, sem migração e
 * sem consulta extra.
 *
 * A REGRA MAIS IMPORTANTE É QUANDO NÃO MANDAR. Onda vazia não vira e-mail:
 * anunciar zero nomes ensina que a mensagem não vale a pena abrir, e leva junto
 * a entregabilidade do PAGAMENTO_FALHOU — que é o e-mail que não pode faltar.
 */

/**
 * Semana ISO-8601: `2026-W36`.
 *
 * Usa o ANO ISO e não o ano do calendário. O erro clássico é usar
 * `getUTCFullYear()`, o que faz a última semana de dezembro colidir com a
 * primeira de janeiro — e o `@@unique` então BARRA o envio da primeira semana
 * do ano, em silêncio, todo ano.
 */
export function chaveDaSemana(data: Date): string {
  const d = new Date(Date.UTC(data.getUTCFullYear(), data.getUTCMonth(), data.getUTCDate()));
  // Quinta-feira da mesma semana define o ano ISO, por definição da norma.
  const diaISO = d.getUTCDay() === 0 ? 7 : d.getUTCDay();
  d.setUTCDate(d.getUTCDate() + 4 - diaISO);

  const anoISO = d.getUTCFullYear();
  const primeiroDeJaneiro = new Date(Date.UTC(anoISO, 0, 1));
  const semana = Math.ceil(((d.getTime() - primeiroDeJaneiro.getTime()) / 86_400_000 + 1) / 7);

  return `${anoISO}-W${String(semana).padStart(2, "0")}`;
}

export function momentoDaOnda(data: Date): string {
  return `ONDA:${chaveDaSemana(data)}`;
}

export type SinaisDaOnda = {
  subscriptionStatus: string | null;
  semEmail: boolean;
  clientesNaBase: number;
  cartoesNaOnda: number;
  jaEnviadoNestaSemana: boolean;
};

/** Quem ainda é cliente e ainda tem acesso. Cancelado tem régua própria. */
const ATIVO = ["active", "trialing", "past_due"];

export function deveChamarParaOnda(s: SinaisDaOnda): boolean {
  if (s.semEmail) return false;
  if (s.jaEnviadoNestaSemana) return false;
  if (!ATIVO.includes(s.subscriptionStatus ?? "")) return false;

  // Base vazia e onda vazia são a mesma decisão: não há o que chamar para
  // fazer. Mandar assim mesmo é o jeito mais rápido de ensinar que o e-mail
  // da Nexora não precisa ser aberto.
  if (s.clientesNaBase <= 0) return false;
  if (s.cartoesNaOnda <= 0) return false;

  return true;
}

export function textoDaChamada(dados: {
  nome: string;
  cartoes: number;
  /** Faixa mínima estimada em jogo. Zero quando não há número confiável. */
  potencialCents: number;
  /** Contatos de semanas anteriores ainda sem desfecho marcado. */
  vencidos: number;
}): Mensagem {
  const nome = (dados.nome ?? "").trim();
  // Sem nome a saudação some inteira: "Olá, ," é o detalhe que faz o dono
  // desconfiar de tudo o que vem depois.
  const abertura = nome ? `${nome}, sua onda desta semana está pronta.` : "Sua onda desta semana está pronta.";

  const linhas = [abertura];

  // Minutos são a moeda dele. "12 nomes" é trabalho; "9 minutos" é decisão.
  const minutos = Math.max(3, Math.round(dados.cartoes * 0.75));

  linhas.push(
    dados.potencialCents > 0
      ? `São ${dados.cartoes} clientes que sumiram, com algo em torno de ` +
        `${emReais(dados.potencialCents)} estimados em jogo — é a conta da sua própria base, ` +
        `pela frequência e pelo ticket dela. Leva uns ${minutos} minutos.`
      : `São ${dados.cartoes} clientes que sumiram. Leva uns ${minutos} minutos: ` +
        `você lê cada mensagem, muda se quiser, e manda do seu WhatsApp.`,
  );

  if (dados.vencidos > 0) {
    linhas.push(
      `${dados.vencidos} ${dados.vencidos === 1 ? "pessoa" : "pessoas"} de semanas anteriores ` +
        `ainda estão sem desfecho. Se alguma delas apareceu, o dinheiro dela ainda não está ` +
        `no seu Livro-Caixa.`,
    );
  }

  return {
    assunto: `Sua onda de segunda: ${dados.cartoes} clientes`,
    corpo: linhas.join("\n\n"),
    acao: { texto: "Ver a onda desta semana", href: "/painel/onda" },
  };
}
