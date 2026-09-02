import { medianaDoSegmento } from "./ciclo";
import { conviteDeVolta, primeiroNome, type Convite } from "./convite";
import { emReais } from "@/lib/billing/preco";

/**
 * DIAGNÓSTICO DE TRÊS NOMES — a porta que abre no celular.
 *
 * O gargalo do funil não era copy. Era que a primeira interação da empresa é
 * uma tarefa de MESA feita por um público de CELULAR:
 *
 *   textarea com dica de "Ctrl+C do Excel"  -> gesto que não existe no iPhone
 *   "escolher arquivo"                       -> seletor do Android, onde a
 *                                               exportação do WhatsApp se perde
 *   "cole a conversa do WhatsApp"            -> exporta UMA conversa, ou seja
 *                                               UM cliente, e sem telefone
 *
 * Dos três, dois exigem computador e o terceiro quase não funciona. Nenhuma
 * otimização de anúncio empurra tráfego para dentro de uma porta que não abre
 * no aparelho em que a pessoa está.
 *
 * Mas o dono não precisa de arquivo nenhum para lembrar de três clientes que
 * sumiram — ele pensa neles no chuveiro. Este módulo troca "vá buscar um
 * arquivo" por "digite três nomes que você já sabe", e termina em três
 * mensagens prontas para mandar hoje à noite.
 *
 * POR QUE NÃO USA `gerarDiagnostico`: aquele motor tem Corte Honesto
 * (MIN_SUMIDOS = 25). Três nomes disparariam a recusa, e a tela diria "não
 * compre" para quem acabou de descrever três clientes reais. Recusa correta
 * para uma base, absurda para uma amostra.
 *
 * O QUE ESTE MÓDULO NÃO FAZ, de propósito: extrapolar. Não diz "se três
 * sumiram, sua base tem 200". A Nexora não tem dataset para afirmar quanto de
 * uma base de barbearia adormece, e inventar isso seria número com cara de
 * dado — proibido pela Constituição, e proibido justamente na página onde a
 * empresa vende honestidade.
 */

export type NomeLembrado = {
  nome: string;
  /** Escolhido em botão, não digitado: memória não tem dia exato. */
  diasSumido: number;
  /** Opcional. Sem ele, o convite ainda sai — só sem o link direto. */
  telefone: string;
};

export type CartaoDeVolta = {
  nome: string;
  primeiroNome: string;
  diasSumido: number;
  /** A frase auditável: o dono confere de cabeça se faz sentido. */
  porque: string;
  convite: Convite;
};

export type DiagnosticoTresNomes = {
  cartoes: CartaoDeVolta[];
  /** Valor SÓ dos nomes citados, e só quando ele informou o ticket. */
  valorCents: number | null;
  textoDoValor: string | null;
  confianca: "baixa";
  ressalva: string;
};

/**
 * As faixas de tempo, em botão.
 *
 * Campo de data pediria precisão que ninguém tem: o dono não sabe que a Maria
 * veio pela última vez em 14/03. Ele sabe "uns seis meses". Botão é mais
 * honesto E mais rápido — e no celular a diferença entre um seletor de data e
 * quatro botões é a diferença entre desistir e continuar.
 */
export const QUANDO = [
  { rotulo: "Um mês", dias: 30 },
  { rotulo: "Uns três meses", dias: 90 },
  { rotulo: "Uns seis meses", dias: 180 },
  { rotulo: "Mais de um ano", dias: 365 },
] as const;

const RESSALVA =
  "Isto é o que você me contou agora, de memória — não é registro. " +
  "O ritmo abaixo é o típico do seu ramo, não o dessa pessoa em específico. " +
  "Com a sua lista de verdade eu calculo o ciclo de cada cliente, um por um.";

function frasedoPorque(diasSumido: number, cicloDoSegmento: number, segmento: string): string {
  const vezes = Math.floor(diasSumido / cicloDoSegmento);

  if (vezes >= 2) {
    return (
      `Sem aparecer há ${diasSumido} dias. Em ${segmento || "negócios como o seu"} ` +
      `a pessoa costuma voltar a cada ${cicloDoSegmento} dias — ou seja, ela já perdeu ` +
      `umas ${vezes} idas.`
    );
  }

  if (vezes === 1) {
    return (
      `Sem aparecer há ${diasSumido} dias, e o normal em ${segmento || "negócios como o seu"} ` +
      `é a cada ${cicloDoSegmento}. Passou da hora dela, mas não muito — é a melhor ` +
      `janela para chamar, antes de virar hábito não voltar.`
    );
  }

  return (
    `Sem aparecer há ${diasSumido} dias. Em ${segmento || "negócios como o seu"} o ciclo ` +
    `costuma ser de ${cicloDoSegmento} dias, então ela ainda está dentro do prazo — ` +
    `se você acha que sumiu mesmo, você conhece essa pessoa melhor que a média.`
  );
}

export function diagnosticarTresNomes(
  nomes: NomeLembrado[],
  contexto: { negocio: string; segmento: string; ticketCents?: number },
): DiagnosticoTresNomes {
  const ciclo = medianaDoSegmento(contexto.segmento);
  const negocio = (contexto.negocio ?? "").trim();

  const cartoes: CartaoDeVolta[] = nomes
    .filter((n) => (n.nome ?? "").trim().length > 0)
    .map((n) => ({
      nome: n.nome.trim(),
      primeiroNome: primeiroNome(n.nome),
      diasSumido: n.diasSumido,
      porque: frasedoPorque(n.diasSumido, ciclo, contexto.segmento),
      convite: conviteDeVolta({ nome: n.nome, telefone: n.telefone ?? "", negocio }),
    }));

  // Dinheiro só entra quando ELE deu o número, e só conta os nomes que ele
  // citou. Multiplicar por uma base estimada seria transformar três lembranças
  // em projeção de faturamento — que é exatamente o tipo de número que a
  // Constituição manda não produzir.
  const temTicket = typeof contexto.ticketCents === "number" && contexto.ticketCents > 0;
  const valorCents = temTicket ? cartoes.length * contexto.ticketCents! : null;

  const textoDoValor =
    valorCents === null
      ? null
      : `${emReais(valorCents)} — e isso é só ${cartoes.length === 1 ? "essa pessoa" : `essas ${cartoes.length} pessoas`}, ` +
        `pelo valor que você mesmo me disse. Não estou chutando quantos outros existem.`;

  return {
    cartoes,
    valorCents,
    textoDoValor,
    // Sempre baixa, sem exceção. Três nomes de memória não viram base, e a
    // tela que abre a relação não pode começar exagerando a própria precisão.
    confianca: "baixa",
    ressalva: RESSALVA,
  };
}
