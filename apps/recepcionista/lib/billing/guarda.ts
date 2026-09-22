import { NextResponse } from "next/server";
import { prisma } from "@/lib/db";
import { estadoDaConta, podeExecutar, type Acao, type EstadoConta } from "./acesso";
import { ofertaDaEmpresa } from "./oferta-da-conta";
import { ACOES_DA_PRIMEIRA_ONDA, podeNaPrimeiraOnda } from "./primeira-onda";
import { primeiraOndaDaEmpresa, type PrimeiraOndaDaConta } from "./primeira-onda-da-conta";
import { garantirRelogio } from "./relogio-da-conta";

/**
 * Ponte entre a regra pura e as rotas.
 *
 * A decisão mora em `acesso.ts`, sem banco e sem HTTP, para ser testável e para
 * que as invariantes da Constituição possam ser travadas por teste. Aqui só
 * buscamos o estado e traduzimos a recusa para HTTP.
 */

export async function estadoDaEmpresa(companyId: string): Promise<EstadoConta> {
  const empresa = await prisma.company.findUnique({
    where: { id: companyId },
    select: {
      id: true,
      createdAt: true,
      termosVersao: true,
      subscriptionStatus: true,
      trialEndsAt: true,
      currentPeriodEnd: true,
      cancelAtPeriodEnd: true,
      dunningIniciadoEm: true,
      acessoPagoAte: true,
    },
  });
  // Empresa inexistente não é problema de cobrança — quem chamou já validou a
  // sessão. Tratar como trial evita bloquear por um erro de leitura.
  if (!empresa) return "TRIAL";

  // Conta antiga chega aqui sem prazo. Sem garantir o relógio antes, a regra
  // pura diria GRATIS para quem ainda tem direito ao mês que os Termos dela
  // prometeram.
  const agora = new Date();
  const trialEndsAt = await garantirRelogio(empresa, agora);
  return estadoDaConta({ ...empresa, trialEndsAt }, agora);
}

/** Estados em que a recusa leva a oferta: quem ainda pode escolher um plano. */
const RECUSA_COM_OFERTA: EstadoConta[] = ["GRATIS", "TRIAL_EXPIRADO"];

/**
 * Devolve `null` quando pode seguir, ou a resposta 402 pronta.
 *
 * 402 Payment Required diz a verdade sobre a causa: 401 mandaria o dono logar
 * de novo e 403 diria que ele não tem direito — as duas mandam ele (e o
 * suporte) para o lugar errado.
 */
export async function exigirAcesso(
  companyId: string,
  acao: Acao,
): Promise<NextResponse | null> {
  const estado = await estadoDaEmpresa(companyId);
  const permissao = podeExecutar(estado, acao);
  if (permissao.pode) return null;

  // A PRIMEIRA ONDA POR NOSSA CONTA. A regra pura continua dizendo que GRATIS não
  // age; a exceção mora aqui porque depende da contagem que só o banco tem.
  if (estado === "GRATIS" && ACOES_DA_PRIMEIRA_ONDA.includes(acao)) {
    const primeira = await primeiraOndaDaEmpresa(companyId);
    if (podeNaPrimeiraOnda(estado, acao, primeira.situacao)) return null;
  }

  // "Bloqueado" sem o número dele é parede; com o número é decisão. Mas a oferta
  // nunca derruba a recusa: se o cálculo falhar, a recusa sai sem ela.
  const oferta = RECUSA_COM_OFERTA.includes(estado)
    ? await ofertaDaEmpresa(companyId).catch(() => null)
    : null;

  return NextResponse.json(
    { error: permissao.motivo, acao: permissao.acao, oferta },
    { status: permissao.http },
  );
}

/** Em que ponto está a primeira Onda — só para a conta GRATIS, que é quem a tem. */
export async function primeiraOndaSeGratis(
  companyId: string,
  agora = new Date(),
): Promise<PrimeiraOndaDaConta | null> {
  if ((await estadoDaEmpresa(companyId)) !== "GRATIS") return null;
  return primeiraOndaDaEmpresa(companyId, agora);
}
