/**
 * O GATE. Quem pode fazer o quê, dado o estado da conta.
 *
 * Vive numa função PURA com `agora` injetado porque o dia em que o acesso de
 * um cliente pagante vira bloqueio não pode depender do relógio de quem roda o
 * código — nem ser impossível de testar sem subir servidor.
 *
 * Duas invariantes da Constituição estão travadas por teste aqui:
 *
 *   TRAVA A AÇÃO, NUNCA SEQUESTRA O DADO — a base de clientes é DELE. Mesmo
 *   inadimplente, mesmo cancelado, ele lê e exporta tudo. Prender dado de
 *   cliente para forçar pagamento é o comportamento que a gente diz combater
 *   na landing; fazer isso destruiria a única coisa que a Nexora vende, que é
 *   confiança.
 *
 *   REGRA ZERO TAMBÉM VALE PARA A RECUSA — toda negativa devolve uma ação
 *   executável. Tela de bloqueio que só informa é proibida como qualquer outra.
 */

import { emReais, PRECO_MENSAL_CENTS } from "./preco";

export type EstadoConta =
  | "GRATIS"
  | "TRIAL"
  | "TRIAL_EXPIRADO"
  | "ATIVO"
  | "PASSE"
  | "TOLERANCIA"
  | "CANCELADO_COM_ACESSO"
  | "BLOQUEADO"
  | "CANCELADO";

export type Acao =
  | "VER_DADOS"
  | "EXPORTAR"
  | "AGENDA_PUBLICA"
  | "MARCAR_RESULTADO"
  | "IMPORTAR"
  | "GERAR_ONDA"
  | "ENVIAR_TOQUE"
  | "CONECTAR_WHATSAPP";

export const ACOES: Acao[] = [
  "VER_DADOS",
  "EXPORTAR",
  "AGENDA_PUBLICA",
  "MARCAR_RESULTADO",
  "IMPORTAR",
  "GERAR_ONDA",
  "ENVIAR_TOQUE",
  "CONECTAR_WHATSAPP",
];

/**
 * O que não trava em nenhuma hipótese.
 *
 * AGENDA_PUBLICA está aqui por um motivo que não é generosidade: quem usaria
 * a página de agendamento é o CLIENTE FINAL do dono, que não deve nada a
 * ninguém. Derrubar a agenda por inadimplência do dono puniria terceiro.
 */
export const ACOES_SEMPRE_LIVRES: Acao[] = [
  "VER_DADOS",
  "EXPORTAR",
  "AGENDA_PUBLICA",
  // Marcar que um cliente voltou é COMO a Receita Recuperada entra no sistema.
  // Travar isso apagaria a prova da garantia que a gente mesmo vende.
  "MARCAR_RESULTADO",
  // A lista entra de graça em qualquer estado. É ela que gera o diagnóstico, e
  // o diagnóstico é o que mostra ao dono quanto dinheiro está parado — travar
  // a importação escondia justamente a dor que faz alguém decidir assinar.
  "IMPORTAR",
];

/** Dias de inadimplência com acesso total antes de travar. */
export const TOLERANCIA_DIAS = 7;

/**
 * Duração do teste grátis: 7 dias de acesso total liberado para experimentar.
 */
export const TRIAL_DIAS = 7;

const DIA_MS = 86_400_000;

export type Assinatura = {
  subscriptionStatus: string | null;
  trialEndsAt: Date | null;
  currentPeriodEnd: Date | null;
  cancelAtPeriodEnd: boolean;
  dunningIniciadoEm: Date | null;
  /** Fim do último passe avulso pago (30 dias no Pix ou anual). Sem cobrança automática. */
  acessoPagoAte: Date | null;
};

export function estadoDaConta(a: Assinatura, agora: Date): EstadoConta {
  const s = a.subscriptionStatus;

  if (s === "active") return "ATIVO";

  // Passe pago vale até o último dia, qualquer que seja a situação de uma
  // assinatura antiga: quem acabou de pagar o Pix não pode ser travado por um
  // cartão recusado ou por um cancelamento de meses atrás.
  if (a.acessoPagoAte && agora < a.acessoPagoAte) return "PASSE";

  if (s === "canceled" || s === "incomplete_expired") {
    return a.currentPeriodEnd && agora < a.currentPeriodEnd
      ? "CANCELADO_COM_ACESSO"
      : "CANCELADO";
  }

  if (s === "past_due" || s === "unpaid") {
    const limite = a.dunningIniciadoEm
      ? new Date(a.dunningIniciadoEm.getTime() + TOLERANCIA_DIAS * DIA_MS)
      : null;
    return limite && agora < limite ? "TOLERANCIA" : "BLOQUEADO";
  }

  // `paused` é o que a Stripe faz quando o trial termina sem meio de pagamento.
  // Não é calote — é trial expirado, e a assinatura continua viva para ser
  // retomada com o MESMO histórico quando ele adicionar o cartão.
  if (s === "paused") return "TRIAL_EXPIRADO";

  // Trial da Stripe: ela diz que está em teste, e só a data vencida desmente.
  if (s === "trialing") {
    return a.trialEndsAt && agora >= a.trialEndsAt ? "TRIAL_EXPIRADO" : "TRIAL";
  }

  if (s === null || s === undefined) {
    // Sem prazo nenhum é a conta que nunca teve teste grátis: aceitou os Termos
    // em que a Nexora é grátis para descobrir e paga para recuperar. Conta antiga,
    // que aceitou o mês grátis, ganha relógio antes de chegar aqui
    // (garantirRelogio). Em nenhum dos dois casos o teste é infinito.
    if (!a.trialEndsAt) return "GRATIS";
    return agora < a.trialEndsAt ? "TRIAL" : "TRIAL_EXPIRADO";
  }

  // incomplete e qualquer status novo que a Stripe inventar: trate como sem
  // acesso às ações de saída, nunca como ativo. Errar para o lado de liberar
  // é dar o produto de graça; errar para o lado de travar o dono resolve com
  // um clique no botão que a recusa devolve.
  return "TRIAL_EXPIRADO";
}

export type Permissao =
  | { pode: true }
  | { pode: false; motivo: string; acao: { texto: string; href: string }; http: 402 };

const COM_ACESSO: EstadoConta[] = ["TRIAL", "ATIVO", "PASSE", "TOLERANCIA", "CANCELADO_COM_ACESSO"];

const RECUSA: Record<string, { motivo: string; texto: string }> = {
  // Quem nunca teve teste não pode ler "seu teste terminou". A recusa dele é a
  // oferta: o trabalho está pronto, falta escolher o plano.
  GRATIS: {
    motivo:
      "As mensagens prontas dos seus clientes estão esperando. Para liberar e mandar do " +
      "seu WhatsApp, escolha um plano. Sua lista continua sua, com ou sem plano.",
    texto: `Liberar as mensagens — ${emReais(PRECO_MENSAL_CENTS)}/mês`,
  },
  TRIAL_EXPIRADO: {
    motivo:
      "Seu período de teste terminou. Sua base e seu histórico continuam aqui, inteiros — " +
      "só o envio de novas ondas está parado.",
    // Derivado da constante, nunca escrito à mão: preço em texto solto é como
    // a tela começa a anunciar um valor diferente do que a Stripe cobra.
    texto: `Assinar por ${emReais(PRECO_MENSAL_CENTS)}/mês`,
  },
  BLOQUEADO: {
    motivo:
      "O último pagamento não passou e já se passaram mais de " +
      `${TOLERANCIA_DIAS} dias. Seus dados estão intactos — atualize a forma de pagamento e a onda volta na hora.`,
    texto: "Atualizar forma de pagamento",
  },
  CANCELADO: {
    motivo:
      "Sua assinatura foi cancelada e o período pago terminou. Seus dados continuam seus: " +
      "você pode ler e exportar tudo quando quiser.",
    texto: "Reativar minha conta",
  },
};

export function podeExecutar(estado: EstadoConta, acao: Acao): Permissao {
  if (ACOES_SEMPRE_LIVRES.includes(acao)) return { pode: true };
  if (COM_ACESSO.includes(estado)) return { pode: true };

  const r = RECUSA[estado] ?? RECUSA.TRIAL_EXPIRADO;
  return {
    pode: false,
    motivo: r.motivo,
    acao: { texto: r.texto, href: "/painel/assinatura" },
    // 402 Payment Required diz a verdade sobre a causa. 401 mandaria o dono
    // logar de novo e 403 diria que ele não tem direito — as duas mentem, e
    // mandam o suporte para o lugar errado.
    http: 402,
  };
}
