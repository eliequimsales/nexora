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

/**
 * TETO DE CRIATIVOS NO RELATÓRIO.
 *
 * `limparCriativo` aceita qualquer identificador de até 32 caracteres — e é o
 * certo, porque é isso que um identificador de criativo é. Mas a rota que grava
 * é PÚBLICA: alguém manda vinte mil eventos com vinte mil criativos diferentes,
 * todos válidos, e este relatório vira vinte mil blocos. A ferramenta que existe
 * para decidir onde gastar R$ 5.000 fica ilegível.
 *
 * Não se resolve validando mais. Resolve-se limitando o relatório — e dizendo
 * quantos ficaram de fora, porque corte silencioso lê-se como "cobri tudo".
 */
const TETO_CRIATIVOS = 20;

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

  // Ordena por VOLUME e não por nome: com muitos criativos, os que importam são
  // os que trouxeram gente, não os que vêm primeiro no alfabeto.
  const porCriativo = new Map<string | null, number>();
  for (const l of linhas) {
    porCriativo.set(l.criativo, (porCriativo.get(l.criativo) ?? 0) + l._count._all);
  }
  const ordenados = [...porCriativo.entries()].sort((a, b) => b[1] - a[1]).map(([c]) => c);
  const criativos = ordenados.slice(0, TETO_CRIATIVOS);
  const omitidos = ordenados.length - criativos.length;

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
    ...(omitidos > 0
      ? [
          `${omitidos} criativos com menos volume ficaram de fora desta lista.`,
          "Se você não criou tantos, alguém está mandando evento com etiqueta",
          "inventada para a rota pública — os totais em TODOS continuam corretos.",
          "",
        ]
      : []),
    "Sem evento nenhum? O app pode não ter recebido visita, ou o schema não",
    "chegou no banco. Confira nos logs se o `prisma db push` do boot passou.",
  ].join("\n");

  return new NextResponse(corpo, {
    headers: { "Content-Type": "text/plain; charset=utf-8", "Cache-Control": "no-store" },
  });
}
