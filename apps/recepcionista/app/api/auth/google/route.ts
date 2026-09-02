import { NextResponse } from "next/server";
import { logError } from "@/lib/errors";
import {
  appRedirect,
  buildAuthUrl,
  createOauthState,
  novoSegredoDeState,
  OAUTH_STATE_COOKIE,
} from "@/lib/google";
import { clientIp, rateLimit, TOO_MANY_ATTEMPTS } from "@/lib/rate-limit";

export const dynamic = "force-dynamic";

/** Inicia o login/cadastro com Google. */
export async function GET(request: Request) {
  if (!rateLimit(`google:${clientIp(request)}`, { limit: 10, windowMs: 5 * 60_000 })) {
    return NextResponse.json({ error: TOO_MANY_ATTEMPTS }, { status: 429 });
  }

  try {
    // O segredo vive no cookie deste navegador; só o HASH dele vai no state.
    // Sem o par, um state capturado não serve em outro navegador — que era
    // exatamente o buraco do login CSRF.
    const segredo = novoSegredoDeState();
    const resposta = NextResponse.redirect(buildAuthUrl(await createOauthState(segredo)));
    resposta.cookies.set(OAUTH_STATE_COOKIE, segredo, {
      httpOnly: true,
      secure: process.env.NODE_ENV === "production",
      sameSite: "lax",
      path: "/",
      maxAge: 600,
    });
    return resposta;
  } catch (error) {
    await logError("auth-google", error);
    return NextResponse.redirect(appRedirect("/login?erro=google", request.url));
  }
}
