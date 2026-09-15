import { estadoDaConta, type Assinatura } from "./acesso";

const DIA_MS = 86_400_000;

/**
 * O período de um passe pago (30 dias no Pix ou anual).
 *
 * Começa quando o acesso atual acaba (ver `fimDoAcessoAtual`). Acesso que já
 * venceu não devolve os dias que passaram: o período novo começa agora.
 */
export function periodoDoPasse(p: {
  acessoAte: Date | null;
  agora: Date;
  dias: number;
}): { inicio: Date; fim: Date } {
  const inicio =
    p.acessoAte && p.acessoAte.getTime() > p.agora.getTime() ? p.acessoAte : p.agora;
  return { inicio, fim: new Date(inicio.getTime() + p.dias * DIA_MS) };
}

/**
 * Até quando a conta JÁ tem acesso antes deste pagamento — null quando não tem.
 *
 * Pagar cedo não pode custar dias. Quem ainda está no mês grátis que os Termos
 * prometeram, quem cancelou com dias pagos pela frente e quem estende um passe
 * que ainda vale começam o período novo quando o acesso atual acaba.
 */
export function fimDoAcessoAtual(a: Assinatura, agora: Date): Date | null {
  switch (estadoDaConta(a, agora)) {
    case "PASSE":
      return a.acessoPagoAte;
    case "TRIAL":
      return a.trialEndsAt;
    case "CANCELADO_COM_ACESSO":
      return a.currentPeriodEnd;
    default:
      return null;
  }
}

/**
 * Quantos dias o pagamento comprou, lidos do metadata que a rota do checkout
 * gravou na sessão (lib/billing/planos.ts).
 *
 * Tudo que volta da Stripe no metadata é texto. Texto torto não vira prazo —
 * nem de mais, nem de menos: vira null, e quem chama registra o erro.
 */
export function diasDoPasse(metadata: Record<string, string> | null | undefined): number | null {
  const bruto = metadata?.passeDias;
  if (typeof bruto !== "string" || !/^\d{1,3}$/.test(bruto)) return null;
  const dias = Number(bruto);
  return dias >= 1 && dias <= 366 ? dias : null;
}
