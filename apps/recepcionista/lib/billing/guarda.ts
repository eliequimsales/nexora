import { NextResponse } from "next/server";
import { prisma } from "@/lib/db";
import { estadoDaConta, podeExecutar, type Acao, type EstadoConta } from "./acesso";

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
      subscriptionStatus: true,
      trialEndsAt: true,
      currentPeriodEnd: true,
      cancelAtPeriodEnd: true,
      dunningIniciadoEm: true,
    },
  });
  // Empresa inexistente não é problema de cobrança — quem chamou já validou a
  // sessão. Tratar como trial evita bloquear por um erro de leitura.
  if (!empresa) return "TRIAL";
  return estadoDaConta(empresa, new Date());
}

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
  const permissao = podeExecutar(await estadoDaEmpresa(companyId), acao);
  if (permissao.pode) return null;

  return NextResponse.json(
    { error: permissao.motivo, acao: permissao.acao },
    { status: permissao.http },
  );
}
