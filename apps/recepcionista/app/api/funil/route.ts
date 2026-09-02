import { NextResponse } from "next/server";
import { z } from "zod";
import { cabeMaisEvento, ehEventoValido, limparCriativo } from "@/lib/funil";
import { prisma } from "@/lib/db";
import { clientIp, rateLimit } from "@/lib/rate-limit";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

/**
 * Registro de evento de funil. Pública, sem sessão — o funil começa antes de
 * existir conta.
 *
 * Responde 204 SEMPRE, inclusive quando recusa. Analytics não pode informar ao
 * cliente se gravou: um 4xx daria a quem está sondando um mapa do que a rota
 * aceita, e um erro visível na tela por causa de métrica seria trocar produto
 * por instrumentação.
 *
 * Nunca recebe conteúdo. O corpo tem três campos e o schema recusa o resto —
 * a página promete que a lista não é gravada, e isto aqui é gravação.
 */
const schema = z.object({
  nome: z.string().max(32),
  criativo: z.string().max(64).optional().nullable(),
  sessao: z.string().max(64).optional().nullable(),
});

/**
 * FUNÇÃO, e não constante de módulo.
 *
 * `const OK = new NextResponse(...)` no topo seria compartilhado por TODAS as
 * requisições do processo. Resposta é objeto com corpo e headers mutáveis;
 * devolver a mesma instância concorrentemente leva a "Body is unusable" ou a
 * header de uma requisição aparecendo em outra.
 */
const ok = () => new NextResponse(null, { status: 204 });

/** Janela do teto global, alinhada com a do limite por IP. */
const JANELA_MS = 10 * 60_000;

export async function POST(request: Request) {
  // Teto por IP: é rota pública de escrita. Generoso porque uma visita legítima
  // dispara até cinco eventos, mas não infinito.
  if (!rateLimit(`funil:${clientIp(request)}`, { limit: 60, windowMs: 10 * 60_000 })) {
    return ok();
  }

  try {
    const parsed = schema.safeParse(await request.json());
    if (!parsed.success) return ok();

    const { nome } = parsed.data;
    if (!ehEventoValido(nome)) return ok();

    // DISJUNTOR GLOBAL. O limite por IP não segura tráfego distribuído: mil
    // IPs passam por ele sem esforço, e esta é a única rota pública que
    // ESCREVE. Perder métrica num pico é irrelevante; perder o banco não é.
    const jaGravados = await prisma.eventoFunil.count({
      where: { criadoEm: { gte: new Date(Date.now() - JANELA_MS) } },
    });
    if (!cabeMaisEvento(jaGravados)) return ok();

    await prisma.eventoFunil.create({
      data: {
        nome,
        criativo: limparCriativo(parsed.data.criativo),
        // Só letras e números, curto. Vem do cliente e vira coluna indexada.
        sessao: /^[a-z0-9]{6,32}$/.test(parsed.data.sessao ?? "") ? parsed.data.sessao! : null,
      },
    });
  } catch {
    // Falha de métrica nunca vira erro para quem está usando o produto.
  }

  return ok();
}
