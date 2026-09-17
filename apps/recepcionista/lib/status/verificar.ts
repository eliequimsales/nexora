import { precoPendenteDoPlano, type PlanoId } from "@/lib/billing/planos";
import { stripe, stripeConfigurado } from "@/lib/billing/stripe";
import { prisma } from "@/lib/db";
import { emailConfigurado } from "@/lib/reengajamento/email";
import { problemaNoGateway } from "@/lib/whatsapp/endereco";
import { resumoDoStatus, type ComponenteDoStatus, type ResumoDoStatus } from "./resumo";

/**
 * O /status CONFERE NA HORA.
 *
 * Nada de "100% no ar" escrito à mão nem histórico de disponibilidade: não existe
 * medição guardada, e página de status que inventa número é a primeira a perder a
 * confiança no dia em que algo cai. Cada item é verificado quando a página abre,
 * com prazo curto, e o resultado fica 30 segundos em memória para quem atualiza a
 * página não virar carga no banco e na Stripe.
 *
 * A página é pública: o detalhe diz O QUE está com problema, nunca endereço,
 * chave ou mensagem de erro do servidor.
 */

const PRAZO_MS = 3_000;
const LEMBRAR_MS = 30_000;

const PLANOS_COBRADOS: PlanoId[] = ["mensal_cartao", "pix_30_dias", "anual"];

export type ResultadoDoStatus = {
  verificadoEm: Date;
  componentes: ComponenteDoStatus[];
  resumo: ResumoDoStatus;
};

async function comPrazo<T>(promessa: Promise<T>): Promise<T> {
  let relogio: ReturnType<typeof setTimeout> | undefined;
  const prazo = new Promise<never>((_, recusar) => {
    relogio = setTimeout(() => recusar(new Error("prazo esgotado")), PRAZO_MS);
  });
  try {
    return await Promise.race([promessa, prazo]);
  } finally {
    clearTimeout(relogio);
  }
}

async function verificarPainel(): Promise<ComponenteDoStatus> {
  const base = { chave: "painel", nome: "Painel e banco de dados" } as const;
  try {
    await comPrazo(prisma.$queryRaw`SELECT 1`);
    return { ...base, estado: "operando", detalhe: "O banco de dados respondeu." };
  } catch {
    return { ...base, estado: "fora", detalhe: "O banco de dados não respondeu a tempo." };
  }
}

async function verificarPagamentos(): Promise<ComponenteDoStatus> {
  const base = { chave: "pagamentos", nome: "Pagamentos (Stripe)" } as const;
  if (!stripeConfigurado()) {
    return {
      ...base,
      estado: "nao_configurado",
      detalhe: "A cobrança ainda não está ligada nesta instalação.",
    };
  }
  if (PLANOS_COBRADOS.some((plano) => precoPendenteDoPlano(plano, process.env))) {
    return {
      ...base,
      estado: "nao_configurado",
      detalhe: "Parte dos planos ainda não está ligada nesta instalação.",
    };
  }
  try {
    // Uma leitura só: confirma que a Stripe responde e que o preço da assinatura existe.
    await comPrazo(stripe().prices.retrieve((process.env.STRIPE_PRICE_PRO ?? "").trim()));
    return {
      ...base,
      estado: "operando",
      detalhe: "A Stripe respondeu e o preço da assinatura existe.",
    };
  } catch {
    return { ...base, estado: "fora", detalhe: "Não foi possível confirmar a Stripe agora." };
  }
}

function verificarEmails(): ComponenteDoStatus {
  const base = { chave: "emails", nome: "E-mails" } as const;
  return emailConfigurado()
    ? {
        ...base,
        estado: "operando",
        detalhe: "Envio configurado. Esta página não manda e-mail de teste.",
      }
    : { ...base, estado: "nao_configurado", detalhe: "O envio de e-mails ainda não está configurado." };
}

async function verificarWhatsApp(): Promise<ComponenteDoStatus> {
  // Opcional: está fora dos planos e ainda em testes, então o estado dele aparece
  // na lista mas não entra no resumo (lib/status/resumo.ts).
  const base = { chave: "whatsapp", nome: "Atendente de WhatsApp", opcional: true } as const;
  const url = (process.env.EVOLUTION_API_URL ?? "").trim();
  if (!url) {
    return {
      ...base,
      estado: "desligado",
      detalhe: "Recurso opcional, desligado nesta fase e fora dos planos.",
    };
  }
  if (problemaNoGateway(url, process.env.NODE_ENV)) {
    return { ...base, estado: "fora", detalhe: "O gateway do WhatsApp está com a configuração incorreta." };
  }
  try {
    // Configurado não é o mesmo que no ar: o gateway já respondeu 502 por dias
    // com a variável preenchida. Qualquer resposta abaixo de 500 é servidor vivo.
    const resposta = await comPrazo(fetch(url, { method: "GET", cache: "no-store" }));
    return resposta.status < 500
      ? { ...base, estado: "operando", detalhe: "O gateway respondeu. A conexão de cada conta aparece no painel dela." }
      : { ...base, estado: "fora", detalhe: "O gateway do WhatsApp está respondendo com falha." };
  } catch {
    return { ...base, estado: "fora", detalhe: "O gateway do WhatsApp não respondeu a tempo." };
  }
}

let lembrado: ResultadoDoStatus | null = null;

export async function statusAgora(agora = new Date()): Promise<ResultadoDoStatus> {
  if (lembrado && agora.getTime() - lembrado.verificadoEm.getTime() < LEMBRAR_MS) return lembrado;

  const componentes = await Promise.all([
    verificarPainel(),
    verificarPagamentos(),
    Promise.resolve(verificarEmails()),
    verificarWhatsApp(),
  ]);

  lembrado = { verificadoEm: agora, componentes, resumo: resumoDoStatus(componentes) };
  return lembrado;
}
