import { NextResponse } from "next/server";
import { z } from "zod";
import { gerarDiagnostico, type ClienteBase } from "@/lib/importacao/diagnostico";
import { importar } from "@/lib/importacao/parsers";
import { medianaDoSegmento } from "@/lib/recuperacao/ciclo";
import { logError } from "@/lib/errors";
import { rateLimit, TOO_MANY_ATTEMPTS } from "@/lib/rate-limit";

export const dynamic = "force-dynamic";

/**
 * DIAGNÓSTICO DE RECEITA PARADA — rota pública, sem login.
 *
 * É a porta de entrada da empresa: o prospect cola a lista dele e vê, na tela,
 * os próprios clientes sumidos com nome e valor. Prova de primeira pessoa —
 * a única que não se desconta, e a que substitui o depoimento que ainda não
 * existe.
 *
 * LGPD: a base é dado pessoal de terceiros. NADA é gravado aqui — o texto é
 * processado em memória e descartado com a resposta. Se um dia isso mudar,
 * precisa de consentimento explícito e política de retenção.
 */

const schema = z.object({
  // O CSV, a colagem do Excel ou a exportação de conversa — como vier.
  texto: z.string().min(10, "Cole ou envie a lista de clientes").max(2_000_000),
  segmento: z.string().max(60).optional(),
  meuNome: z.string().max(80).optional(),
  // Preenchido pelo dono quando a lista não traz o valor de cada atendimento —
  // sem isso a exportação do WhatsApp nunca produz número, e ela é o caminho de
  // menor fricção. Entre R$ 5 e R$ 5.000.
  ticketPadraoCents: z.number().int().min(500).max(500_000).optional(),
});

export async function POST(request: Request) {
  const ip = request.headers.get("x-forwarded-for")?.split(",")[0]?.trim() ?? "anon";
  if (!rateLimit(`diagnostico:${ip}`, { limit: 8, windowMs: 10 * 60_000 })) {
    return NextResponse.json({ error: TOO_MANY_ATTEMPTS }, { status: 429 });
  }

  try {
    const parsed = schema.safeParse(await request.json());
    if (!parsed.success) {
      return NextResponse.json(
        { error: parsed.error.issues[0]?.message ?? "Dados inválidos" },
        { status: 400 },
      );
    }
    const { texto, segmento, meuNome, ticketPadraoCents } = parsed.data;

    const importacao = importar(texto, { meuNome });

    if (importacao.clientes.length === 0) {
      return NextResponse.json(
        {
          error:
            "Não consegui ler nenhum cliente nessa lista. Ela precisa ter pelo menos nome e telefone. " +
            "Se estiver difícil, me manda do jeito que estiver que eu converto na mão.",
          // Mesmo nome de campo do 200. O 422 devolvia `ignoradas` e o 200
          // `exemplosIgnorados`, e a tela lia um e perdia o outro em silêncio.
          exemplosIgnorados: importacao.ignoradas.slice(0, 5),
          ignoradas: importacao.ignoradas.slice(0, 5),
        },
        { status: 422 },
      );
    }

    const base: ClienteBase[] = importacao.clientes.map((c) => ({
      nome: c.nome,
      telefone: c.telefone,
      visitas: c.visitas,
    }));

    const diagnostico = gerarDiagnostico(base, {
      // medianaDoSegmento normaliza acento e caixa por dentro. Antes disso,
      // "Salão de beleza" caía no padrão de 30 dias em silêncio.
      medianaSegmentoDias: medianaDoSegmento(segmento ?? null),
      ticketPadraoCents,
    });

    return NextResponse.json({
      diagnostico,
      importacao: {
        lidos: importacao.clientes.length,
        origem: importacao.origem,
        aviso: importacao.aviso,
        // Dizer o que não deu para ler é parte do contrato: falhar em silêncio
        // é o que faz o dono descobrir o buraco depois de já ter confiado.
        ignoradas: importacao.ignoradas.length,
        exemplosIgnorados: importacao.ignoradas.slice(0, 3),
      },
    });
  } catch (error) {
    await logError("diagnostico", error);
    return NextResponse.json(
      { error: "Não consegui processar essa lista agora" },
      { status: 500 },
    );
  }
}
