import { NextResponse } from "next/server";
import { z } from "zod";
import { prisma } from "@/lib/db";
import { logError } from "@/lib/errors";
import { clientIp, rateLimit, TOO_MANY_ATTEMPTS } from "@/lib/rate-limit";
import { conferirDescadastro } from "@/lib/reengajamento/servico";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

/**
 * Descadastro da régua de e-mails. Público, sem login — quem quer sair não deve
 * ser obrigado a lembrar a senha.
 *
 * É POST, e não GET, por um motivo prático: os antivírus de link do Gmail e do
 * Outlook abrem TODOS os links do e-mail para checar se são maliciosos. Um
 * descadastro no GET seria acionado por essa varredura, e o dono descobriria
 * que "parou de receber sozinho".
 *
 * O token é um HMAC do id da empresa. Sem ele, trocar o id na URL descadastraria
 * qualquer empresa.
 */

const schema = z.object({
  empresa: z.string().min(1).max(64),
  token: z.string().min(8).max(64),
});

export async function POST(request: Request) {
  // clientIp e nao a leitura crua: o primeiro elemento de X-Forwarded-For e o
  // que o CLIENTE mandou, e com ele o atacante trocava de identidade a cada
  // requisicao. Duas rotas ainda tinham a versao antiga copiada.
  const ip = clientIp(request);
  if (!rateLimit(`descadastro:${ip}`, { limit: 20, windowMs: 10 * 60_000 })) {
    return NextResponse.json({ error: TOO_MANY_ATTEMPTS }, { status: 429 });
  }

  try {
    const parsed = schema.safeParse(await request.json());
    if (!parsed.success) {
      return NextResponse.json({ error: "Link inválido" }, { status: 400 });
    }
    const { empresa, token } = parsed.data;

    if (!conferirDescadastro(empresa, token)) {
      return NextResponse.json({ error: "Link inválido ou expirado" }, { status: 403 });
    }

    // updateMany em vez de update: id inexistente não deve virar 500 nem
    // revelar se a empresa existe.
    await prisma.company.updateMany({ where: { id: empresa }, data: { semEmail: true } });

    return NextResponse.json({ ok: true });
  } catch (erro) {
    await logError("descadastro", erro);
    return NextResponse.json({ error: "Não consegui processar agora" }, { status: 500 });
  }
}
