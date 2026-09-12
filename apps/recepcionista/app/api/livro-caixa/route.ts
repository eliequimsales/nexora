import { NextResponse } from "next/server";
import { getSessionCompanyId } from "@/lib/auth";
import { prisma } from "@/lib/db";
import { logError } from "@/lib/errors";
import { neutralizarFormula } from "@/lib/dados/exportar";
import { LIMITES, limitar } from "@/lib/limites";
import { TOO_MANY_ATTEMPTS } from "@/lib/rate-limit";

export const dynamic = "force-dynamic";

/**
 * LIVRO-CAIXA DA RECUPERAÇÃO
 *
 * O extrato do que voltou de verdade. Comprovado é quando a pessoa sentou e
 * pagou — não quando respondeu "vou ver".
 *
 * É a única prova social que a Nexora tem hoje: prova de si mesmo. O dono não
 * precisa de depoimento de terceiro se tem o extrato do próprio caixa. E é a
 * resposta dele, no mês 6, para "esse software vale a mensalidade?".
 *
 * O acumulado NUNCA zera e nunca é resetado por inatividade — substitui o
 * streak, porque o número que sobe é dinheiro, e dinheiro não é punitivo.
 */

/** Mesma convenção de lib/dados/exportar.ts: Excel pt-BR lê ponto-e-vírgula. */
const SEP_CSV = ";";
/** Sem BOM o Excel abre em Latin-1 e "Situação" vira "SituaÃ§Ã£o". */
const BOM_CSV = "﻿";

/** O nome que a Onda já usa na tela. O enum do banco não vai para a planilha. */
const SITUACAO: Record<string, string> = {
  PRE_ATRASO: "Prestes a sumir",
  ATRASO: "Atrasado",
  RESGATE: "Sumido há muito",
};

const dataBR = new Intl.DateTimeFormat("pt-BR", {
  timeZone: "America/Sao_Paulo",
  day: "2-digit",
  month: "2-digit",
  year: "numeric",
});

export async function GET(request: Request) {
  const companyId = await getSessionCompanyId();
  if (!companyId) return NextResponse.json({ error: "Não autenticado" }, { status: 401 });

  if (!limitar("livro-caixa", companyId, LIMITES.pesado)) {
    return NextResponse.json({ error: TOO_MANY_ATTEMPTS }, { status: 429 });
  }

  try {
    const url = new URL(request.url);
    const formato = url.searchParams.get("formato");

    const entradas = await prisma.recoveryEntry.findMany({
      where: { companyId },
      orderBy: { returnedAt: "desc" },
      select: {
        id: true,
        returnedAt: true,
        valueCents: true,
        daysAway: true,
        esteira: true,
        touchNumber: true,
        attributed: true,
        customer: { select: { name: true } },
      },
    });

    // Exportar é livre e sem fricção: a base e o histórico são dele. Saída Limpa.
    //
    // O nome do cliente é neutralizado antes de entrar na célula: ele vem da
    // lista que o dono colou, que veio da agenda dele — texto de terceiro. Um
    // nome começando com = + - @ é executado como FÓRMULA pelo Excel, e as
    // aspas do CSV não impedem: o Excel tira a marcação e avalia o conteúdo.
    // Sem isto, abrir o próprio extrato é o vetor de ataque.
    if (formato === "csv") {
      // Quem abre este arquivo é o dono, no Excel, e às vezes o contador dele.
      // Antes saía `dias_sumido,esteira,toque,atribuido` — nome de coluna de
      // banco de dados, separado por vírgula (que o Excel brasileiro joga numa
      // célula só) e sem BOM (que faz "excluído" virar "excluÃ­do").
      const linhas = [
        [
          "Data",
          "Cliente",
          "Dias sumido",
          "Situação",
          "Qual mensagem",
          "Valor (R$)",
          "Conta como recuperado?",
        ].join(SEP_CSV),
        ...entradas.map((e) =>
          [
            dataBR.format(e.returnedAt),
            // customer é nulo quando o titular exerceu o direito de exclusão:
            // o valor permanece no extrato, a pessoa não.
            `"${neutralizarFormula(e.customer?.name ?? "cliente que você apagou").replace(/"/g, '""')}"`,
            e.daysAway,
            SITUACAO[e.esteira] ?? e.esteira,
            `${e.touchNumber}ª mensagem`,
            // Vírgula decimal e sem "R$": assim o Excel soma a coluna.
            (e.valueCents / 100).toFixed(2).replace(".", ","),
            e.attributed ? "sim" : "não",
          ].join(SEP_CSV),
        ),
      ].join("\n");

      return new NextResponse(BOM_CSV + linhas, {
        headers: {
          "Content-Type": "text/csv; charset=utf-8",
          "Content-Disposition": 'attachment; filename="livro-caixa-nexora.csv"',
        },
      });
    }

    const inicioDoMes = new Date();
    inicioDoMes.setDate(1);
    inicioDoMes.setHours(0, 0, 0, 0);

    const comprovadas = entradas.filter((e) => e.attributed);
    const doMes = comprovadas.filter((e) => e.returnedAt >= inicioDoMes);

    const primeira = entradas.at(-1)?.returnedAt ?? null;
    const semanas = primeira
      ? Math.max(1, Math.ceil((Date.now() - primeira.getTime()) / (7 * 24 * 60 * 60 * 1000)))
      : 0;

    // Contatos ainda sem resposta, com o toque em que estão — é o "3 de 12"
    // inacabado que puxa o dono de volta no meio da semana.
    const aguardando = await prisma.recoveryTouch.count({
      where: { companyId, outcome: "AGUARDANDO" },
    });

    return NextResponse.json({
      mes: {
        totalCents: doMes.reduce((s, e) => s + e.valueCents, 0),
        clientes: doMes.length,
      },
      acumulado: {
        totalCents: comprovadas.reduce((s, e) => s + e.valueCents, 0),
        clientes: comprovadas.length,
        semanas,
      },
      semAtribuicao: {
        totalCents: entradas
          .filter((e) => !e.attributed)
          .reduce((s, e) => s + e.valueCents, 0),
        clientes: entradas.filter((e) => !e.attributed).length,
      },
      aguardandoResposta: aguardando,
      extrato: entradas.map((e) => ({
        id: e.id,
        data: e.returnedAt.toISOString().slice(0, 10),
        cliente: e.customer?.name ?? "cliente excluído",
        diasSumido: e.daysAway,
        esteira: e.esteira,
        toque: e.touchNumber,
        valorCents: e.valueCents,
        atribuido: e.attributed,
      })),
    });
  } catch (error) {
    await logError("livro-caixa", error, companyId);
    return NextResponse.json({ error: "Não consegui carregar o extrato" }, { status: 500 });
  }
}
