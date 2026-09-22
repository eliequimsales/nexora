import type { Prisma } from "@nexora/recepcionista-prisma";
import { NextResponse } from "next/server";
import { lerDiasFechados } from "@/lib/agenda/horario";
import { localDe } from "@/lib/atendente/datas";
import { ajusteDoAtendente } from "@/lib/atendente/entrada";
import { telaDoAtendente } from "@/lib/atendente/tela";
import { getSessionCompanyId } from "@/lib/auth";
import { prisma } from "@/lib/db";
import { logError } from "@/lib/errors";
import { LIMITES, limitar } from "@/lib/limites";
import { TOO_MANY_ATTEMPTS } from "@/lib/rate-limit";

export const dynamic = "force-dynamic";

/**
 * A tela "Atendente Virtual": GET devolve tudo que ela mostra, montado no
 * servidor (lib/atendente/tela.ts); PUT grava os ajustes que ela permite —
 * nome, jeito, as duas escolhas, endereço e pagamento quando faltam, fechar ou
 * reabrir hoje e dar uma anotação como resolvida — e devolve a tela nova.
 */

const FALHA = "Não consegui abrir o Atendente agora. Tente de novo em instantes.";

export async function GET() {
  const companyId = await getSessionCompanyId();
  if (!companyId) return NextResponse.json({ error: "Não autenticado" }, { status: 401 });

  if (!limitar("atendente", companyId, LIMITES.leitura)) {
    return NextResponse.json({ error: TOO_MANY_ATTEMPTS }, { status: 429 });
  }

  try {
    return NextResponse.json(await telaDoAtendente(companyId));
  } catch (erro) {
    await logError("atendente-tela", erro, companyId);
    return NextResponse.json({ error: FALHA }, { status: 500 });
  }
}

export async function PUT(request: Request) {
  const companyId = await getSessionCompanyId();
  if (!companyId) return NextResponse.json({ error: "Não autenticado" }, { status: 401 });

  if (!limitar("atendente-ajuste", companyId, LIMITES.escrita)) {
    return NextResponse.json({ error: TOO_MANY_ATTEMPTS }, { status: 429 });
  }

  const parsed = ajusteDoAtendente.safeParse(await request.json().catch(() => null));
  if (!parsed.success) {
    return NextResponse.json({ error: parsed.error.issues[0]?.message ?? "Dados inválidos" }, { status: 400 });
  }
  const a = parsed.data;

  try {
    const data: Prisma.CompanyProfileUpdateInput = {
      ...(a.nome !== undefined ? { atendenteNome: a.nome } : {}),
      ...(a.jeito ? { atendenteJeito: a.jeito } : {}),
      ...(a.marcaDireto !== undefined ? { atendenteMarca: a.marcaDireto } : {}),
      ...(a.expediente !== undefined ? { atendenteExpediente: a.expediente } : {}),
      ...(a.endereco !== undefined ? { address: a.endereco } : {}),
      ...(a.pagamento !== undefined ? { paymentMethods: a.pagamento } : {}),
    };

    if (a.fecharHoje !== undefined) {
      const perfil = await prisma.companyProfile.findUnique({ where: { companyId }, select: { diasFechados: true } });
      const hoje = localDe(new Date()).data;
      // A lista só guarda o que ainda vale: os dias que passaram saem.
      const seguintes = lerDiasFechados(perfil?.diasFechados).filter((d) => d > hoje);
      data.diasFechados = a.fecharHoje ? [hoje, ...seguintes] : seguintes;
    }

    if (Object.keys(data).length > 0) {
      await prisma.companyProfile.update({ where: { companyId }, data });
    }
    if (a.resolver) {
      await prisma.atendenteAtendimento.updateMany({
        where: { id: a.resolver, companyId },
        data: { resolvidoEm: new Date() },
      });
    }

    return NextResponse.json(await telaDoAtendente(companyId));
  } catch (erro) {
    await logError("atendente-ajuste", erro, companyId);
    return NextResponse.json({ error: "Não consegui salvar agora. Tente de novo em instantes." }, { status: 500 });
  }
}
