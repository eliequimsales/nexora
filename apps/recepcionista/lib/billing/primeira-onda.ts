import { TAMANHO_DA_ONDA } from "@/lib/recuperacao/onda";
import type { Acao, EstadoConta } from "./acesso";
import { emReais, PRECO_MENSAL_CENTS } from "./preco";

/**
 * A PRIMEIRA ONDA POR NOSSA CONTA.
 *
 * Conta sem plano e sem teste (GRATIS) gera a Onda da semana, liga o WhatsApp e
 * manda as mensagens dela antes de pagar qualquer coisa. É a prova tirada da
 * lista do próprio dono, no lugar do teste de dias corridos: o que decide a
 * compra é o que a Onda fez, não um relógio.
 *
 *   DISPONIVEL   — nunca gerou uma Onda com clientes.
 *   EM_ANDAMENTO — gerou há menos de DIAS_DA_PRIMEIRA_ONDA dias e registrou
 *                  menos de TAMANHO_DA_ONDA mensagens.
 *   USADA        — qualquer outro caso. A parede sobe, com o resultado dela.
 *
 * O prazo fecha a brecha de quem manda pelo link do WhatsApp e nunca marca "já
 * mandei": sem ele, a contagem nunca chegaria a doze.
 *
 * Pura, com `agora` injetado. Quem lê o banco é primeira-onda-da-conta.ts, e
 * quem aplica a exceção é exigirAcesso (guarda.ts): acesso.ts continua dizendo
 * que GRATIS não age.
 */

const DIA_MS = 86_400_000;

export const DIAS_DA_PRIMEIRA_ONDA = 7;

export type SituacaoDaPrimeiraOnda = "DISPONIVEL" | "EM_ANDAMENTO" | "USADA";

export function fimDaPrimeiraOnda(primeiraOndaEm: Date): Date {
  return new Date(primeiraOndaEm.getTime() + DIAS_DA_PRIMEIRA_ONDA * DIA_MS);
}

export function situacaoDaPrimeiraOnda(p: {
  primeiraOndaEm: Date | null;
  /** Mensagens registradas desde que a primeira Onda foi gerada, sem os pulados. */
  enviadas: number;
  agora: Date;
}): SituacaoDaPrimeiraOnda {
  if (!p.primeiraOndaEm) return "DISPONIVEL";
  const noPrazo = p.agora < fimDaPrimeiraOnda(p.primeiraOndaEm);
  return noPrazo && p.enviadas < TAMANHO_DA_ONDA ? "EM_ANDAMENTO" : "USADA";
}

/**
 * O que a primeira Onda libera em cada situação. Mandar só depois de a Onda
 * existir: liberar o envio em DISPONIVEL deixaria quem chama a rota direto
 * mandar sem nunca começar a contagem.
 */
const LIBERA: Record<Exclude<SituacaoDaPrimeiraOnda, "USADA">, Acao[]> = {
  DISPONIVEL: ["GERAR_ONDA", "CONECTAR_WHATSAPP"],
  EM_ANDAMENTO: ["GERAR_ONDA", "ENVIAR_TOQUE", "CONECTAR_WHATSAPP"],
};

export const ACOES_DA_PRIMEIRA_ONDA: Acao[] = [...LIBERA.EM_ANDAMENTO];

export function podeNaPrimeiraOnda(
  estado: EstadoConta,
  acao: Acao,
  situacao: SituacaoDaPrimeiraOnda,
): boolean {
  if (estado !== "GRATIS" || situacao === "USADA") return false;
  return LIBERA[situacao].includes(acao);
}

export type ResultadoDaPrimeiraOnda = {
  enviadas: number;
  /** Responderam, marcaram horário ou voltaram — pela marcação do dono. */
  responderam: number;
  voltaram: number;
  /** Só o que entrou em Dinheiro recuperado com a volta ligada à mensagem. */
  recuperadoCents: number;
};

const RESPOSTAS = ["RESPONDEU", "MARCOU", "VOLTOU"];

/** O resultado sai das marcações do dono, nunca de estimativa. */
export function resultadoDaPrimeiraOnda(
  desfechos: string[],
  recuperadoCents: number,
): ResultadoDaPrimeiraOnda {
  const enviados = desfechos.filter((d) => d !== "PULADO");
  return {
    enviadas: enviados.length,
    responderam: enviados.filter((d) => RESPOSTAS.includes(d)).length,
    voltaram: enviados.filter((d) => d === "VOLTOU").length,
    recuperadoCents,
  };
}

export type AvisoDaPrimeiraOnda = { texto: string; acao: { texto: string; href: string } };

const diaEMes = (d: Date) =>
  d.toLocaleDateString("pt-BR", { day: "2-digit", month: "2-digit", timeZone: "America/Sao_Paulo" });

/** O aviso do painel para a conta GRATIS: em que ponto está a primeira Onda. */
export function avisoDaPrimeiraOnda(p: {
  situacao: SituacaoDaPrimeiraOnda;
  enviadas: number;
  ate: Date | null;
}): AvisoDaPrimeiraOnda {
  if (p.situacao === "DISPONIVEL") {
    return {
      texto:
        `Sua primeira Onda é por nossa conta: até ${TAMANHO_DA_ONDA} mensagens prontas, ` +
        "cada uma escrita para um cliente que parou de voltar. Sem cartão.",
      acao: { texto: "Abrir minha primeira Onda", href: "/painel/onda" },
    };
  }
  if (p.situacao === "EM_ANDAMENTO") {
    return {
      texto:
        `Primeira Onda por nossa conta: ${p.enviadas} de ${TAMANHO_DA_ONDA} mensagens enviadas.` +
        (p.ate ? ` Vale até ${diaEMes(p.ate)}.` : ""),
      acao: { texto: "Continuar a Onda", href: "/painel/onda" },
    };
  }
  return {
    texto: "Sua primeira Onda terminou. As próximas saem toda segunda, com um plano.",
    acao: {
      texto: `Liberar a próxima — ${emReais(PRECO_MENSAL_CENTS)}/mês`,
      href: "/painel/assinatura",
    },
  };
}

/** A trava de "Meus clientes" enquanto a primeira Onda não foi usada. */
export const TRAVA_NA_PRIMEIRA_ONDA = {
  motivo:
    "As mensagens prontas saem pela Onda, e a primeira é por nossa conta: abra em Reativar " +
    "clientes e mande do seu WhatsApp.",
  acao: { texto: "Abrir minha primeira Onda", href: "/painel/onda" },
};
