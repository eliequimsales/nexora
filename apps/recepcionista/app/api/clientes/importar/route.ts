import { NextResponse } from "next/server";
import { z } from "zod";
import { getSessionCompanyId } from "@/lib/auth";
import { logError } from "@/lib/errors";
import { gravarImportacao } from "@/lib/importacao/gravar";
import { importar } from "@/lib/importacao/parsers";
import { rateLimit, TOO_MANY_ATTEMPTS } from "@/lib/rate-limit";

export const dynamic = "force-dynamic";

/**
 * RESGATE DO CADERNO — a rota autenticada que enche a base.
 *
 * Sem isto o produto inteiro não funciona: a Onda de Segunda roda em cima de
 * Customer/Visit, e até agora a única forma de um cliente entrar era ele mesmo
 * agendar pelo link público — ou seja, exatamente quem NÃO sumiu.
 *
 * Duas passadas por desenho:
 *   simular: true  → não escreve nada, devolve o que aconteceria.
 *   simular: false → grava. Idempotente: rodar duas vezes não duplica visita.
 *
 * LGPD: aqui, diferente de /api/diagnostico, os dados FICAM. O dono é o
 * controlador da base dele e a Nexora é operadora; `confirmo` registra que ele
 * declarou ter base legal para tratar esses dados.
 */

const schema = z.object({
  texto: z.string().min(10, "Cole ou envie a lista de clientes").max(2_000_000),
  meuNome: z.string().max(80).optional(),
  simular: z.boolean().default(true),
  confirmo: z.boolean().default(false),
});

export async function POST(request: Request) {
  const companyId = await getSessionCompanyId();
  if (!companyId) return NextResponse.json({ error: "Não autenticado" }, { status: 401 });

  // Importação é cara (lê e escreve muita linha). Limite por empresa, não por IP.
  if (!rateLimit(`importar:${companyId}`, { limit: 12, windowMs: 10 * 60_000 })) {
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
    const { texto, meuNome, simular, confirmo } = parsed.data;

    if (!simular && !confirmo) {
      return NextResponse.json(
        {
          error:
            "Confirme que esses clientes são seus e que você pode falar com eles antes de gravar.",
        },
        { status: 400 },
      );
    }

    const leitura = importar(texto, { meuNome });

    if (leitura.clientes.length === 0) {
      return NextResponse.json(
        {
          error:
            "Não consegui ler nenhum cliente nessa lista. Ela precisa ter pelo menos nome e telefone.",
          exemplosIgnorados: leitura.ignoradas.slice(0, 5),
        },
        { status: 422 },
      );
    }

    const resultado = await gravarImportacao(companyId, leitura.clientes, { simular });

    return NextResponse.json({
      ...resultado,
      origem: leitura.origem,
      // Exportação de conversa não traz telefone nem visita de verdade — o
      // aviso do parser precisa chegar até a tela, senão o dono trata conversa
      // como atendimento e o cálculo inteiro mente.
      aviso: leitura.aviso,
      linhasIgnoradas: leitura.ignoradas.length,
      exemplosIgnorados: leitura.ignoradas.slice(0, 5),
    });
  } catch (error) {
    await logError("importar-clientes", error, companyId);
    return NextResponse.json(
      { error: "Não consegui importar essa lista agora" },
      { status: 500 },
    );
  }
}
