import { NextResponse } from "next/server";
import { EVENTOS, type NomeDeEvento } from "@/lib/funil";
import { prisma } from "@/lib/db";
import { safeEqual } from "@/lib/rate-limit";

export const dynamic = "force-dynamic";

/**
 * O FUNIL EM TEXTO, para quem paga o anúncio.
 *
 * Instrumentação que ninguém lê é igual a não ter instrumentação. Esta rota
 * existe para responder, em dez segundos, a única pergunta que decide se
 * continua gastando: ONDE as pessoas desistem.
 *
 * NÃO é tela do assinante. É ferramenta de dono, protegida pelo mesmo
 * CRON_SECRET das rotas de cron — header, nunca query string, porque segredo em
 * URL vaza em log de acesso e em Referer.
 *
 *   curl -H "x-cron-secret: $CRON_SECRET" https://SEU-APP/api/funil/resumo
 *
 * Texto puro e sem gráfico, de propósito: o Artigo X proíbe painel de vaidade.
 * O que importa aqui é a taxa entre duas etapas, e ela cabe numa linha.
 */

const DIAS = 14;

const ROTULO: Record<NomeDeEvento, string> = {
  chegou: "chegou na página",
  comecou_entrada: "começou a escrever",
  viu_numero: "viu o número",
  clicou_mensagem: "clicou para mandar",
  criou_conta: "criou conta",
};

export async function GET(request: Request) {
  const segredo = process.env.CRON_SECRET;
  const enviado = request.headers.get("x-cron-secret") ?? "";
  // Falha fechado, como as rotas de cron: sem segredo no ambiente, ninguém entra.
  if (!segredo || !safeEqual(enviado, segredo)) {
    return NextResponse.json({ error: "Não autorizado" }, { status: 401 });
  }

  const desde = new Date(Date.now() - DIAS * 24 * 60 * 60 * 1000);

  const linhas = await prisma.eventoFunil.groupBy({
    by: ["nome", "criativo"],
    where: { criadoEm: { gte: desde } },
    _count: { _all: true },
  });

  const total = (nome: string, criativo?: string | null) =>
    linhas
      .filter((l) => l.nome === nome && (criativo === undefined || l.criativo === criativo))
      .reduce((s, l) => s + l._count._all, 0);

  const criativos = [...new Set(linhas.map((l) => l.criativo))].sort((a, b) =>
    (a ?? "").localeCompare(b ?? ""),
  );

  const bloco = (titulo: string, criativo?: string | null) => {
    const base = total("chegou", criativo);
    const saida = [titulo];
    for (const e of EVENTOS) {
      const n = total(e, criativo);
      const pct = base > 0 ? ((100 * n) / base).toFixed(1).padStart(5) : "    -";
      saida.push(`  ${String(n).padStart(6)}  ${pct}%  ${ROTULO[e]}`);
    }
    // A taxa que decide tudo: a porta abriu?
    const chegou = total("chegou", criativo);
    const viu = total("viu_numero", criativo);
    if (chegou > 0) {
      saida.push(`  ---> porta: ${((100 * viu) / chegou).toFixed(1)}% dos que chegaram viram um número`);
    }
    return saida.join("\n");
  };

  const corpo = [
    `NEXORA — funil dos últimos ${DIAS} dias`,
    "",
    bloco("TODOS"),
    "",
    ...(criativos.length > 1
      ? criativos.map((c) => bloco(`CRIATIVO: ${c ?? "(sem etiqueta)"}`, c))
      : []),
    "",
    "Sem evento nenhum? O app pode não ter recebido visita, ou o schema não",
    "chegou no banco. Confira nos logs se o `prisma db push` do boot passou.",
  ].join("\n");

  return new NextResponse(corpo, {
    headers: { "Content-Type": "text/plain; charset=utf-8", "Cache-Control": "no-store" },
  });
}
