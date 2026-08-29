/**
 * A régua rodando: lê os sinais de cada conta, pergunta ao motor o que mandar
 * hoje, envia e registra.
 *
 * O registro é o que impede repetição — e ele é gravado MESMO quando o envio
 * falha por configuração ausente, para que ligar o e-mail um mês depois não
 * dispare de uma vez toda a régua acumulada na cara de quem já esqueceu da
 * Nexora.
 */

import { createHmac } from "crypto";
import { prisma } from "@/lib/db";
import { calcularCiclo, medianaDoSegmento } from "@/lib/recuperacao/ciclo";
import { classificar } from "@/lib/recuperacao/esteiras";
import { logError } from "@/lib/errors";
import { enviarEmail } from "./email";
import { decidirToque, type Momento, type Sinais } from "./motor";

/** Quantas contas por execução. Régua não precisa ser rápida, precisa ser segura. */
const LOTE = 40;

/**
 * Link de descadastro assinado: sem assinatura, qualquer um descadastraria
 * qualquer empresa só trocando o id na URL.
 */
export function tokenDescadastro(companyId: string): string {
  const segredo = process.env.JWT_SECRET ?? "";
  return createHmac("sha256", segredo).update(`descadastro:${companyId}`).digest("hex").slice(0, 32);
}

export function conferirDescadastro(companyId: string, token: string): boolean {
  const esperado = tokenDescadastro(companyId);
  return token.length === esperado.length && token === esperado;
}

/**
 * Estimativa da receita parada na base dele, para o e-mail poder falar do
 * dinheiro DELE em vez de falar da Nexora. Usa o mesmo motor do Diagnóstico e a
 * mesma faixa conservadora de 15%.
 */
async function estimarBase(companyId: string, hoje: Date) {
  const empresa = await prisma.company.findUnique({
    where: { id: companyId },
    select: { profile: { select: { segments: true } } },
  });
  const segmentos = Array.isArray(empresa?.profile?.segments)
    ? (empresa!.profile!.segments as string[])
    : [];
  const mediana = medianaDoSegmento(
    segmentos[0]?.toLowerCase().replace(/\s+/g, "-") ?? null,
  );

  const clientes = await prisma.customer.findMany({
    where: { companyId, optOut: false },
    select: { visits: { select: { occurredAt: true, valueCents: true } } },
  });

  let sumidos = 0;
  let somaTicket = 0;

  for (const c of clientes) {
    const datas = c.visits.map((v) => v.occurredAt);
    const ciclo = calcularCiclo(datas, mediana);
    const classificacao = classificar({
      ultimaVisita: datas.length ? datas.reduce((a, b) => (a > b ? a : b)) : null,
      ciclo,
      temAgendamentoFuturo: false,
      hoje,
    });
    if (classificacao.esteira === "ATRASO" || classificacao.esteira === "RESGATE") {
      sumidos += 1;
      const gasto = c.visits.reduce((s, v) => s + v.valueCents, 0);
      somaTicket += c.visits.length ? Math.round(gasto / c.visits.length) : 0;
    }
  }

  // Faixa mínima: 15% dos sumidos voltando, uma visita cada. O motor do e-mail
  // deriva o teto a partir daqui — nunca o contrário.
  return { sumidos, recuperavelCents: Math.round(somaTicket * 0.15) };
}

async function sinaisDe(
  empresa: {
    id: string;
    name: string;
    createdAt: Date;
    checkoutAbertoEm: Date | null;
    canceladoEm: Date | null;
    trialEndsAt: Date | null;
    subscriptionStatus: string | null;
    dunningIniciadoEm: Date | null;
    semEmail: boolean;
  },
  hoje: Date,
): Promise<Sinais> {
  const [clientesNaBase, toquesRegistrados, recuperado, enviados] = await Promise.all([
    prisma.customer.count({ where: { companyId: empresa.id } }),
    prisma.recoveryTouch.count({ where: { companyId: empresa.id } }),
    prisma.recoveryEntry.aggregate({
      where: { companyId: empresa.id, attributed: true },
      _sum: { valueCents: true },
    }),
    prisma.reengajamento.findMany({
      where: { companyId: empresa.id },
      select: { momento: true, enviadoEm: true },
      orderBy: { enviadoEm: "desc" },
    }),
  ]);

  const base =
    clientesNaBase > 0 ? await estimarBase(empresa.id, hoje) : { sumidos: 0, recuperavelCents: 0 };

  return {
    nome: empresa.name,
    criadoEm: empresa.createdAt,
    checkoutAbertoEm: empresa.checkoutAbertoEm,
    canceladoEm: empresa.canceladoEm,
    clientesNaBase,
    toquesRegistrados,
    sumidos: base.sumidos,
    recuperavelCents: base.recuperavelCents,
    recuperadoCents: recuperado._sum.valueCents ?? 0,
    trialEndsAt: empresa.trialEndsAt,
    subscriptionStatus: empresa.subscriptionStatus,
    dunningIniciadoEm: empresa.dunningIniciadoEm,
    semEmail: empresa.semEmail,
    jaEnviados: enviados.map((e) => e.momento as Momento),
    ultimoEnvioEm: enviados[0]?.enviadoEm ?? null,
  };
}

export type ResultadoRegua = {
  avaliadas: number;
  enviados: number;
  porMomento: Record<string, number>;
  falhas: number;
};

export async function rodarRegua(hoje = new Date()): Promise<ResultadoRegua> {
  const empresas = await prisma.company.findMany({
    where: { semEmail: false },
    select: {
      id: true,
      name: true,
      email: true,
      createdAt: true,
      checkoutAbertoEm: true,
      canceladoEm: true,
      trialEndsAt: true,
      subscriptionStatus: true,
      dunningIniciadoEm: true,
      semEmail: true,
    },
    orderBy: { createdAt: "asc" },
    take: LOTE,
  });

  const resultado: ResultadoRegua = {
    avaliadas: empresas.length,
    enviados: 0,
    porMomento: {},
    falhas: 0,
  };

  const appUrl = process.env.APP_URL ?? "";

  for (const empresa of empresas) {
    try {
      const toque = decidirToque(await sinaisDe(empresa, hoje), hoje);
      if (!toque) continue;

      const url = `${appUrl}/descadastro?e=${empresa.id}&t=${tokenDescadastro(empresa.id)}`;
      const envio = await enviarEmail(empresa.email, toque, url);

      // Registra mesmo sem envio: ligar o e-mail depois não pode despejar a
      // régua inteira de uma vez em quem já esqueceu da Nexora.
      await prisma.reengajamento.create({
        data: {
          companyId: empresa.id,
          momento: toque.momento,
          erro: envio.enviado ? null : (envio.motivo ?? "falha desconhecida"),
        },
      });

      if (envio.enviado) {
        resultado.enviados += 1;
        resultado.porMomento[toque.momento] = (resultado.porMomento[toque.momento] ?? 0) + 1;
      } else {
        resultado.falhas += 1;
      }
    } catch (erro) {
      resultado.falhas += 1;
      await logError("regua-reengajamento", erro, empresa.id);
    }
  }

  return resultado;
}
