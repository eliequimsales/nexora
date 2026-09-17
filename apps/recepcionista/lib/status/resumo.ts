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
  /**
   * Módulo fora da oferta e ainda em testes — hoje, o atendente de WhatsApp.
   * Aparece na lista com o estado real, mas não entra no resumo: o que a Nexora
   * vende é a recuperação de clientes, e um gateway opcional caído não pode
   * fazer a página anunciar que o produto pago está com problema.
   */
  opcional?: boolean;
};

export type ResumoDoStatus = { tom: "ok" | "parcial" | "fora"; titulo: string };

export function resumoDoStatus(componentes: ComponenteDoStatus[]): ResumoDoStatus {
  const essenciais = componentes.filter((c) => !c.opcional);

  // Sem banco não há painel, onda nem agenda: o resto respondendo não muda isso.
  if (essenciais.some((c) => c.chave === "painel" && c.estado === "fora")) {
    return { tom: "fora", titulo: "O serviço está fora do ar agora" };
  }
  // Recurso desligado de propósito não é problema; configuração faltando é.
  if (essenciais.some((c) => c.estado === "fora" || c.estado === "nao_configurado")) {
    return { tom: "parcial", titulo: "Parte do serviço está com problema agora" };
  }
  return { tom: "ok", titulo: "Todos os sistemas operacionais" };
}
