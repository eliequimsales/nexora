/**
 * A ONDA DE SEGUNDA
 *
 * Doze clientes por semana. Não é limitação técnica nem escassez fabricada —
 * são três motivos reais, e todos são ditos ao dono na própria tela:
 *
 *   1. WhatsApp bloqueia número que dispara em massa. Onda pequena é proteção
 *      operacional do número DELE — um cliente banido é desastre irrecuperável.
 *   2. Ele não teria mão para atender 100 pessoas respondendo hoje à tarde.
 *      Mensagem que gera resposta sem atendimento vira cliente irritado.
 *   3. Doze mensagens de copiar e colar levam ~9 minutos. Lista de 137 vira
 *      nada; lista de 12 vira mensagem enviada.
 *
 * Efeito colateral virtuoso: 180 clientes de estoque x 4 toques nao cabem num
 * mes, entao o estoque se distribui naturalmente por meses.
 */

import type { Esteira } from "./esteiras";

export const TAMANHO_DA_ONDA = 12;

export type Candidato = {
  id: string;
  esteira: Esteira;
  /** Dinheiro em jogo em centavos — o que ele já gastou, não o que promete gastar. */
  valorCents: number;
  /** Follow-up do Protocolo 4 Toques que já venceu. Vem na frente de tudo. */
  toqueVencido: boolean;
  confianca: "alta" | "baixa";
};

/**
 * Prioridade das esteiras dentro da onda. Pré-atraso primeiro porque converte
 * mais (sumiço recente volta mais fácil) e porque é a única esteira que impede
 * o estoque de se formar de novo.
 */
const PRIORIDADE: Record<string, number> = {
  PRE_ATRASO: 0,
  ATRASO: 1,
  RESGATE: 2,
  EM_DIA: 99,
};

/**
 * POR QUE A ONDA VEIO VAZIA.
 *
 * `cards: []` colapsava quatro situações opostas num único valor, e a tela
 * dizia a mesma frase para todas: "ninguém da sua base está atrasado". Para
 * quem acabou de se cadastrar e ainda não importou nada, isso é mentira — e é
 * a PRIMEIRA tela dele. Verdade acima de marketing começa por não confundir
 * "base em dia" com "base inexistente".
 *
 * Regra Zero: os quatro estados terminam numa ação executável. Nenhum deles
 * pode deixar o dono olhando para um parágrafo.
 */
export type MotivoVazio =
  | "SEM_BASE"
  | "TODOS_OPT_OUT"
  | "SEQUENCIA_ESGOTADA"
  | "NINGUEM_ATRASADO";

export type Vazio = {
  motivo: MotivoVazio;
  titulo: string;
  explicacao: string;
  acao: { texto: string; href: string };
};

const IMPORTAR = "/painel/clientes/importar";

export function diagnosticarVazio(contagem: {
  /** Todos os clientes cadastrados, inclusive quem pediu para sair. */
  total: number;
  /** Os que ainda podem receber mensagem (optOut = false). */
  ativos: number;
  /** Ativos que ainda têm toque disponível no Protocolo 4 Toques. */
  elegiveis: number;
}): Vazio {
  if (contagem.total === 0) {
    return {
      motivo: "SEM_BASE",
      titulo: "Sua base ainda está vazia",
      explicacao:
        "A Nexora trabalha em cima dos clientes que você já teve. Manda a lista do jeito " +
        "que ela estiver — planilha torta, print do caderno, conversa exportada do WhatsApp. " +
        "A gente entende e diz o que não conseguiu ler.",
      acao: { texto: "Importar minha lista de clientes", href: IMPORTAR },
    };
  }

  if (contagem.ativos === 0) {
    return {
      motivo: "TODOS_OPT_OUT",
      titulo: "Todo mundo da sua base pediu para não receber mensagem",
      explicacao:
        `Seus ${contagem.total} clientes estão marcados como "não perturbe". A Nexora ` +
        "respeita isso e não manda mensagem para nenhum deles — é exigência do CDC. " +
        "Para voltar a ter onda, é preciso trazer clientes novos para a base.",
      acao: { texto: "Importar mais clientes", href: IMPORTAR },
    };
  }

  if (contagem.elegiveis === 0) {
    return {
      motivo: "SEQUENCIA_ESGOTADA",
      titulo: "Você já falou com todo mundo",
      explicacao:
        "Todos os seus clientes ativos já receberam os 4 toques do protocolo. Insistir " +
        "depois disso não traz ninguém de volta e queima seu número no WhatsApp. " +
        "O caminho agora é aumentar a base.",
      acao: { texto: "Importar mais clientes", href: IMPORTAR },
    };
  }

  return {
    motivo: "NINGUEM_ATRASADO",
    titulo: "Hoje você não precisa abrir",
    explicacao:
      "Ninguém da sua base está atrasado o suficiente para valer uma mensagem esta " +
      "semana. Isso é boa notícia. Quando alguém escapar do ritmo dele, aparece aqui.",
    acao: { texto: "Adicionar mais clientes à base", href: IMPORTAR },
  };
}

export function montarOnda<T extends Candidato>(
  candidatos: T[],
  tamanho: number = TAMANHO_DA_ONDA,
): T[] {
  return [...candidatos]
    .filter((c) => c.esteira !== "EM_DIA")
    .sort((a, b) => {
      // 1. Follow-up vencido na frente: não mandar o toque 2 é jogar fora a
      //    maior alavanca disponível (4-5 toques recuperam ~81% a mais).
      if (a.toqueVencido !== b.toqueVencido) return a.toqueVencido ? -1 : 1;

      // 2. Ordem das esteiras.
      const pa = PRIORIDADE[a.esteira] ?? 98;
      const pb = PRIORIDADE[b.esteira] ?? 98;
      if (pa !== pb) return pa - pb;

      // 3. Dinheiro antes de vaidade: dentro da esteira, quem tem mais em jogo.
      if (a.valorCents !== b.valorCents) return b.valorCents - a.valorCents;

      // 4. Empate: confiança alta primeiro, para o dono começar pelo que é sólido.
      if (a.confianca !== b.confianca) return a.confianca === "alta" ? -1 : 1;

      return a.id.localeCompare(b.id);
    })
    .slice(0, tamanho);
}
