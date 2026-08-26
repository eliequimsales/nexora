import { NextResponse } from "next/server";
import { logError } from "@/lib/errors";
import { appRedirect, buildAuthUrl, createOauthState } from "@/lib/google";
import { clientIp, rateLimit, TOO_MANY_ATTEMPTS } from "@/lib/rate-limit";

export const dynamic = "force-dynamic";

/** Inicia o login/cadastro com Google. */
export async function GET(request: Request) {
  if (!rateLimit(`google:${clientIp(request)}`, { limit: 10, windowMs: 5 * 60_000 })) {
    return NextResponse.json({ error: TOO_MANY_ATTEMPTS }, { status: 429 });
  }

  try {
    const state = await createOauthState();
    return NextResponse.redirect(buildAuthUrl(state));
  } catch (error) {
    await logError("auth-google", error);
    return NextResponse.redirect(appRedirect("/login?erro=google", request.url));
  }
}
