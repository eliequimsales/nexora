/**
 * CLIENTE E INTEGRAÇÃO COM GATEWAY ASAAS (API v3)
 *
 * Implementa checkout hospedado (PCI-compliant SAQ-A), consulta de clientes,
 * assinaturas e pagamentos avulsos (Pix e Cartão), além de convergência de pagamentos.
 *
 * Documentação oficial:
 * - Sandbox: https://sandbox.asaas.com/api/v3
 * - Produção: https://api.asaas.com/api/v3
 */

import crypto from "crypto";
import { prisma } from "@/lib/db";
import { logError } from "@/lib/errors";
import { PLANOS, type PlanoId, ehPlanoCompleto } from "./planos";
import { periodoDoPasse, fimDoAcessoAtual } from "./passe";
import { enviarEmail } from "@/lib/reengajamento/email";
import { montarConfirmacao, montarConfirmacaoDoPasse } from "./confirmacao";

export const VARIAVEIS_DO_ASAAS = ["ASAAS_API_KEY"] as const;

export function variaveisPendentesDoAsaas(
  env: Record<string, string | undefined> = process.env,
): string[] {
  return VARIAVEIS_DO_ASAAS.filter((k) => !(env[k] ?? "").trim());
}

export function asaasConfigurado(
  env: Record<string, string | undefined> = process.env,
): boolean {
  return variaveisPendentesDoAsaas(env).length === 0;
}

export function provedorCobranca(
  env: Record<string, string | undefined> = process.env,
): "asaas" | "stripe" {
  if (env.BILLING_GATEWAY === "asaas") return "asaas";
  if (env.BILLING_GATEWAY === "stripe") return "stripe";
  if (env.ASAAS_API_KEY?.trim()) return "asaas";
  return "stripe";
}

export function obterAsaasBaseUrl(
  env: Record<string, string | undefined> = process.env,
): string {
  const sandbox =
    env.ASAAS_SANDBOX === "true" ||
    env.ASAAS_SANDBOX === "1" ||
    (!env.ASAAS_SANDBOX &&
      (env.ASAAS_API_KEY?.includes("sandbox") || env.NODE_ENV !== "production"));

  return sandbox
    ? "https://sandbox.asaas.com/api/v3"
    : "https://api.asaas.com/api/v3";
}

async function requisicaoAsaas<T>(
  caminho: string,
  opcoes: {
    method?: string;
    body?: unknown;
    env?: Record<string, string | undefined>;
  } = {},
): Promise<{ ok: boolean; status: number; data: T | null; error?: string }> {
  const env = opcoes.env ?? process.env;
  const apiKey = env.ASAAS_API_KEY;
  if (!apiKey) {
    return { ok: false, status: 500, data: null, error: "ASAAS_API_KEY não configurada" };
  }

  const baseUrl = obterAsaasBaseUrl(env);
  const url = `${baseUrl}${caminho.startsWith("/") ? caminho : `/${caminho}`}`;

  const headers: Record<string, string> = {
    "Content-Type": "application/json",
    access_token: apiKey,
    "User-Agent": "Nexora/1.0",
  };

  try {
    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), 15_000);

    const res = await fetch(url, {
      method: opcoes.method || "GET",
      headers,
      body: opcoes.body ? JSON.stringify(opcoes.body) : undefined,
      signal: controller.signal,
    });
    clearTimeout(timeout);

    const json = (await res.json().catch(() => null)) as T | { errors?: Array<{ description: string }> } | null;

    if (!res.ok) {
      const msgErro =
        json && typeof json === "object" && "errors" in json && Array.isArray(json.errors)
          ? json.errors.map((e) => e.description).join("; ")
          : `Erro HTTP ${res.status}`;
      return { ok: false, status: res.status, data: null, error: msgErro };
    }

    return { ok: true, status: res.status, data: json as T };
  } catch (err: unknown) {
    const msg = err instanceof Error ? err.message : String(err);
    return { ok: false, status: 500, data: null, error: `Falha de rede Asaas: ${msg}` };
  }
}

export function validarTokenWebhookAsaas(
  tokenRecebido: string | null,
  env: Record<string, string | undefined> = process.env,
): boolean {
  const segredo = env.ASAAS_WEBHOOK_TOKEN;
  if (!segredo) return false;
  if (!tokenRecebido) return false;

  try {
    const bufA = Buffer.from(segredo);
    const bufB = Buffer.from(tokenRecebido);
    if (bufA.length !== bufB.length) return false;
    return crypto.timingSafeEqual(bufA, bufB);
  } catch {
    return false;
  }
}

function sanitizarTelefone(tel?: string | null): string {
  if (!tel) return "";
  return tel.replace(/\D/g, "").slice(0, 11);
}

function formatarDataIso(data: Date): string {
  return data.toISOString().split("T")[0];
}

export async function buscarOuCriarClienteAsaas(
  empresa: {
    id: string;
    name: string;
    email: string;
    phone?: string | null;
    asaasCustomerId?: string | null;
  },
  env = process.env,
): Promise<string> {
  if (empresa.asaasCustomerId) {
    return empresa.asaasCustomerId;
  }

  // 1. Tenta buscar no Asaas pelo externalReference = companyId
  const busca = await requisicaoAsaas<{
    data: Array<{ id: string }>;
  }>(`/customers?externalReference=${encodeURIComponent(empresa.id)}`, { env });

  if (busca.ok && busca.data?.data && busca.data.data.length > 0) {
    const idEncontrado = busca.data.data[0].id;
    await prisma.company.update({
      where: { id: empresa.id },
      data: { asaasCustomerId: idEncontrado },
    });
    return idEncontrado;
  }

  // 2. Cria cliente no Asaas
  const criacao = await requisicaoAsaas<{ id: string }>("/customers", {
    method: "POST",
    body: {
      name: empresa.name.trim() || "Cliente Nexora",
      email: empresa.email.trim(),
      mobilePhone: sanitizarTelefone(empresa.phone) || undefined,
      externalReference: empresa.id,
      notificationDisabled: false,
    },
    env,
  });

  if (!criacao.ok || !criacao.data?.id) {
    throw new Error(`Falha ao registrar cliente no Asaas: ${criacao.error}`);
  }

  const novoId = criacao.data.id;
  await prisma.company.update({
    where: { id: empresa.id },
    data: { asaasCustomerId: novoId },
  });

  return novoId;
}

export async function criarCheckoutAsaas({
  companyId,
  plano,
  clienteId,
  hostUrl,
  env = process.env,
}: {
  companyId: string;
  plano: PlanoId;
  clienteId: string;
  hostUrl: string;
  env?: Record<string, string | undefined>;
}): Promise<{ url: string; paymentId?: string; subscriptionId?: string }> {
  const configPlano = PLANOS[plano];
  if (!configPlano) {
    throw new Error(`Plano desconhecido: ${plano}`);
  }

  const valorReais = configPlano.valorCents / 100;
  const agora = new Date();
  const descricao = `Nexora — ${plano.replace(/_/g, " ")}`;
  const externalReference = `${companyId}:${plano}`;

  if (configPlano.modo === "payment") {
    // Pagamento avulso (Pix / Boleto / Cartão à vista)
    const vencimento = new Date(agora.getTime() + 3 * 86_400_000);
    const callbackSuccess = `${hostUrl}/painel/assinatura?ok=1&asaas_payment_id=`;

    const criacao = await requisicaoAsaas<{
      id: string;
      invoiceUrl: string;
      bankSlipUrl?: string;
    }>("/payments", {
      method: "POST",
      body: {
        customer: clienteId,
        billingType: "UNDEFINED", // Permite cliente escolher Pix, Cartão ou Boleto no checkout Asaas
        value: valorReais,
        dueDate: formatarDataIso(vencimento),
        description: descricao,
        externalReference,
        postalService: false,
        callback: {
          successUrl: `${callbackSuccess}`,
          autoRedirect: true,
        },
      },
      env,
    });

    if (!criacao.ok || !criacao.data) {
      throw new Error(`Falha ao gerar cobrança no Asaas: ${criacao.error}`);
    }

    const checkoutUrl = criacao.data.invoiceUrl || criacao.data.bankSlipUrl;
    if (!checkoutUrl) {
      throw new Error("Asaas não retornou URL de pagamento (invoiceUrl).");
    }

    return { url: checkoutUrl, paymentId: criacao.data.id };
  } else {
    // Assinatura recorrente mensal
    const vencimento = new Date(agora.getTime() + 1 * 86_400_000);

    const criacao = await requisicaoAsaas<{
      id: string;
    }>("/subscriptions", {
      method: "POST",
      body: {
        customer: clienteId,
        billingType: "CREDIT_CARD",
        value: valorReais,
        nextDueDate: formatarDataIso(vencimento),
        cycle: "MONTHLY",
        description: descricao,
        externalReference,
      },
      env,
    });

    if (!criacao.ok || !criacao.data?.id) {
      throw new Error(`Falha ao criar assinatura no Asaas: ${criacao.error}`);
    }

    const subId = criacao.data.id;

    // Busca o primeiro pagamento da assinatura para pegar a invoiceUrl
    const pagamentos = await requisicaoAsaas<{
      data: Array<{ id: string; invoiceUrl: string }>;
    }>(`/subscriptions/${subId}/payments`, { env });

    const primeiraInvoice = pagamentos.data?.data?.[0]?.invoiceUrl;
    if (!primeiraInvoice) {
      throw new Error("Asaas não retornou fatura para a assinatura criada.");
    }

    return {
      url: primeiraInvoice,
      subscriptionId: subId,
      paymentId: pagamentos.data?.data?.[0]?.id,
    };
  }
}

/**
 * Aplica um pagamento confirmado pelo Asaas (Pix ou Passe avulso).
 */
export async function aplicarPasseAsaas({
  companyId,
  paymentId,
  plano,
  valorCents,
  dias,
}: {
  companyId: string;
  paymentId: string;
  plano: string;
  valorCents: number;
  dias: number;
}): Promise<void> {
  const agora = new Date();
  const stripeSessionId = `asaas:${paymentId}`;

  // Idempotente na chave primária do passe (stripeSessionId único)
  const existente = await prisma.passePago.findUnique({
    where: { stripeSessionId },
  });
  if (existente) return;

  await prisma.$transaction(async (tx) => {
    const empresa = await tx.company.findUnique({
      where: { id: companyId },
      select: {
        acessoPagoAte: true,
        subscriptionStatus: true,
        trialEndsAt: true,
        currentPeriodEnd: true,
        cancelAtPeriodEnd: true,
        dunningIniciadoEm: true,
        name: true,
        email: true,
      },
    });
    if (!empresa) throw new Error(`Empresa ${companyId} não encontrada`);

    const { inicio, fim } = periodoDoPasse({
      acessoAte: fimDoAcessoAtual(empresa, agora),
      agora,
      dias,
    });

    await tx.passePago.create({
      data: {
        companyId,
        stripeSessionId,
        stripePaymentIntentId: paymentId,
        asaasPaymentId: paymentId,
        plano,
        dias,
        valorCents,
        inicio,
        fim,
      },
    });

    await tx.company.update({
      where: { id: companyId },
      data: {
        acessoPagoAte: fim,
        checkoutAbertoEm: null,
        canceladoEm: null,
        ...(ehPlanoCompleto(plano) ? { plan: "completo" } : {}),
      },
    });
  });

  // Envia confirmação transacional legal (Decreto 7.962/2013)
  const empresaAtualizada = await prisma.company.findUnique({
    where: { id: companyId },
    select: { name: true, email: true },
  });
  if (empresaAtualizada) {
    const msg = montarConfirmacaoDoPasse({
      nome: empresaAtualizada.name,
      dias,
      fim: new Date(agora.getTime() + dias * 86_400_000),
      valorCents,
    });
    await enviarEmail(empresaAtualizada.email, msg).catch((e) =>
      logError("asaas-confirmacao-email", e, companyId),
    );
  }
}

/**
 * Aplica assinatura ativa/paga confirmada pelo Asaas.
 */
export async function aplicarAssinaturaAsaas({
  companyId,
  subscriptionId,
  paymentId,
  plano,
}: {
  companyId: string;
  subscriptionId?: string | null;
  paymentId: string;
  plano: string;
}): Promise<void> {
  const agora = new Date();
  const proximaCobranca = new Date(agora.getTime() + 30 * 86_400_000);

  const empresa = await prisma.company.findUnique({
    where: { id: companyId },
    select: { confirmacaoEnviadaEm: true, name: true, email: true },
  });

  await prisma.company.update({
    where: { id: companyId },
    data: {
      asaasSubscriptionId: subscriptionId ?? paymentId,
      subscriptionStatus: "active",
      plan: ehPlanoCompleto(plano) ? "completo" : "pro",
      currentPeriodEnd: proximaCobranca,
      cancelAtPeriodEnd: false,
      checkoutAbertoEm: null,
      canceladoEm: null,
      falhasSeguidas: 0,
      ultimoErroPagamento: null,
      dunningIniciadoEm: null,
    },
  });

  if (empresa && !empresa.confirmacaoEnviadaEm) {
    await prisma.company.update({
      where: { id: companyId },
      data: { confirmacaoEnviadaEm: new Date() },
    });
    const msg = montarConfirmacao({
      nome: empresa.name,
      emTeste: false,
      proximaCobranca,
    });
    await enviarEmail(empresa.email, msg).catch((e) =>
      logError("asaas-confirmacao-email", e, companyId),
    );
  }
}

/**
 * Re-convergência síncrona na volta do cliente (evita tela em teste antes do webhook).
 */
export async function convergirDoAsaas(
  paymentId: string,
  env = process.env,
): Promise<{ convergido: boolean; status: string; plano?: string }> {
  const res = await requisicaoAsaas<{
    id: string;
    customer: string;
    subscription?: string;
    status: string;
    value: number;
    externalReference?: string;
  }>(`/payments/${paymentId}`, { env });

  if (!res.ok || !res.data) {
    return { convergido: false, status: "DESCONHECIDO" };
  }

  const { status, externalReference, value, subscription, id } = res.data;

  // Se o pagamento já foi recebido ou confirmado
  if (status === "RECEIVED" || status === "CONFIRMED") {
    let companyId: string | null = null;
    let plano = "mensal_cartao";

    if (externalReference?.includes(":")) {
      const partes = externalReference.split(":");
      companyId = partes[0];
      plano = partes[1] || plano;
    } else if (externalReference) {
      companyId = externalReference;
    }

    if (!companyId) {
      const comp = await prisma.company.findFirst({
        where: { asaasCustomerId: res.data.customer },
        select: { id: true },
      });
      companyId = comp?.id ?? null;
    }

    if (companyId) {
      const cfg = PLANOS[plano as PlanoId] ?? PLANOS.mensal_cartao;
      if (cfg.modo === "payment") {
        await aplicarPasseAsaas({
          companyId,
          paymentId: id,
          plano,
          valorCents: Math.round(value * 100),
          dias: cfg.dias ?? 30,
        });
      } else {
        await aplicarAssinaturaAsaas({
          companyId,
          subscriptionId: subscription,
          paymentId: id,
          plano,
        });
      }
      return { convergido: true, status, plano };
    }
  }

  return { convergido: false, status };
}
