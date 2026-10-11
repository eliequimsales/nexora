import { describe, expect, it } from "vitest";
import { extrairComprador } from "@/lib/billing/compra-manual";

describe("Webhook de Compra Manual — Processamento Multiformato", () => {
  it("extrai dados de compra aprovada da Kiwify com Order Bump", () => {
    const payload = {
      order_status: "paid",
      Customer: {
        full_name: "Marcos Oliveira",
        email: "marcos@oficina.com",
        mobile: "(11) 98888-7777",
      },
      order_bumps: [{ name: "O Resgate Rápido de Clientes que Sumiram" }],
    };

    const comprador = extrairComprador(payload);
    expect(comprador.nome).toBe("Marcos Oliveira");
    expect(comprador.email).toBe("marcos@oficina.com");
    expect(comprador.telefone).toBe("5511988887777");
    expect(comprador.statusPago).toBe(true);
    expect(comprador.orderBump).toBe(true);
  });

  it("extrai dados de compra aprovada do Asaas", () => {
    const payload = {
      event: "PAYMENT_CONFIRMED",
      payment: {
        customerName: "Camila Dentista",
        customerEmail: "camila@odonto.com",
        customerPhone: "21977776666",
        value: 27.0,
      },
    };

    const comprador = extrairComprador(payload);
    expect(comprador.nome).toBe("Camila Dentista");
    expect(comprador.email).toBe("camila@odonto.com");
    expect(comprador.telefone).toBe("5521977776666");
    expect(comprador.statusPago).toBe(true);
  });

  it("extrai dados de compra da Hotmart", () => {
    const payload = {
      status: "approved",
      data: {
        buyer: {
          name: "Roberto Barbearia",
          email: "roberto@barber.com",
          checkout_phone: "31966665555",
        },
      },
    };

    const comprador = extrairComprador(payload);
    expect(comprador.nome).toBe("Roberto Barbearia");
    expect(comprador.telefone).toBe("5531966665555");
    expect(comprador.statusPago).toBe(true);
  });

  it("recusa status pendente ou cancelado", () => {
    const payload = {
      order_status: "waiting_payment",
      Customer: {
        full_name: "Lead Curioso",
        mobile: "11999999999",
      },
    };

    const comprador = extrairComprador(payload);
    expect(comprador.statusPago).toBe(false);
  });
});
