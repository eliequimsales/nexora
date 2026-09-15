/**
 * O RESUMO DO /status — puro, para a regra de "está no ar?" ser testável sem
 * banco nem Stripe.
 */

export type EstadoDoComponente = "operando" | "fora" | "nao_configurado" | "desligado";

export type ComponenteDoStatus = {
  chave: "painel" | "pagamentos" | "emails" | "whatsapp";
  nome: string;
  estado: EstadoDoComponente;
  detalhe: string;
};

export type ResumoDoStatus = { tom: "ok" | "parcial" | "fora"; titulo: string };

export function resumoDoStatus(componentes: ComponenteDoStatus[]): ResumoDoStatus {
  // Sem banco não há painel, onda nem agenda: o resto respondendo não muda isso.
  if (componentes.some((c) => c.chave === "painel" && c.estado === "fora")) {
    return { tom: "fora", titulo: "O serviço está fora do ar agora." };
  }
  // Recurso desligado de propósito não é problema; configuração faltando é.
  if (componentes.some((c) => c.estado === "fora" || c.estado === "nao_configurado")) {
    return { tom: "parcial", titulo: "Parte do serviço está com problema agora." };
  }
  return { tom: "ok", titulo: "Tudo operando agora." };
}
