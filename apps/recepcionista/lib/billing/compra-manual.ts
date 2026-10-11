export interface DadosComprador {
  nome: string;
  telefone: string;
  email: string;
  statusPago: boolean;
  orderBump?: boolean;
}

export function normalizarTelefone(tel: string | null | undefined): string | null {
  if (!tel) return null;
  const digitos = tel.replace(/\D/g, "");
  if (!digitos) return null;
  if (digitos.startsWith("55") && (digitos.length === 12 || digitos.length === 13)) {
    return digitos;
  }
  if (digitos.length === 10 || digitos.length === 11) {
    return `55${digitos}`;
  }
  return digitos;
}

export function extrairComprador(body: Record<string, any>): DadosComprador {
  // 1. Formato Kiwify
  if (body?.order_status) {
    const statusPago = body.order_status === "paid" || body.order_status === "approved";
    const cust = body.Customer || {};
    return {
      nome: cust.full_name || cust.first_name || "Cliente",
      telefone: normalizarTelefone(cust.mobile || cust.phone) || "",
      email: cust.email || "",
      statusPago,
      orderBump: Boolean(body.order_bumps && body.order_bumps.length > 0),
    };
  }

  // 2. Formato Hotmart
  if (body?.data?.buyer || body?.status) {
    const statusPago =
      body.status === "approved" ||
      body.status === "complete" ||
      body.event === "PURCHASE_APPROVED";
    const buyer = body?.data?.buyer || body?.buyer || {};
    return {
      nome: buyer.name || "Cliente",
      telefone: normalizarTelefone(buyer.checkout_phone || buyer.phone) || "",
      email: buyer.email || "",
      statusPago,
      orderBump: Boolean(body?.data?.purchase?.order_bump),
    };
  }

  // 3. Formato Asaas
  if (body?.event && body?.payment) {
    const statusPago =
      body.event === "PAYMENT_CONFIRMED" || body.event === "PAYMENT_RECEIVED";
    return {
      nome: body.payment.customerName || "Cliente",
      telefone: normalizarTelefone(body.payment.customerPhone || body.payment.phone) || "",
      email: body.payment.customerEmail || body.payment.email || "",
      statusPago,
    };
  }

  // 4. Formato Genérico / Teste Manual
  return {
    nome: body.nome || body.name || "Cliente",
    telefone: normalizarTelefone(body.telefone || body.phone || body.whatsapp) || "",
    email: body.email || "",
    statusPago: body.status !== "recusado" && body.status !== "cancelado",
    orderBump: Boolean(body.orderBump),
  };
}
