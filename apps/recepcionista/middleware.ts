import { NextResponse, type NextRequest } from "next/server";
import { jwtVerify } from "jose";

const SESSION_COOKIE = "rd_session";

export async function middleware(request: NextRequest) {
  const token = request.cookies.get(SESSION_COOKIE)?.value;
  const loginUrl = new URL("/login", request.url);
  loginUrl.searchParams.set("next", request.nextUrl.pathname);

  if (!token) return NextResponse.redirect(loginUrl);

  // FALHA FECHADO. Antes era `JWT_SECRET ?? ""`: sem a variável, a verificação
  // rodava contra uma chave HMAC vazia — que é uma chave válida. lib/auth.ts
  // lança erro no mesmo caso; era o middleware que destoava.
  const segredo = process.env.JWT_SECRET;
  if (!segredo) return NextResponse.redirect(loginUrl);

  try {
    // `algorithms` explícito: sem isso a verificação aceitaria qualquer
    // algoritmo que a chave suporte.
    const { payload } = await jwtVerify(token, new TextEncoder().encode(segredo), {
      algorithms: ["HS256"],
    });
    // Token assinado mas sem dono não identifica ninguém.
    if (!payload.sub) return NextResponse.redirect(loginUrl);

    // A ÉPOCA da sessão não é conferida aqui: o middleware não fala com o
    // banco. Isto é só o redirecionamento amigável — quem decide acesso de
    // verdade é getSessionCompanyId, em cada rota e em cada página, e lá a
    // revogação é conferida.
    return NextResponse.next();
  } catch {
    return NextResponse.redirect(loginUrl);
  }
}

export const config = {
  matcher: ["/painel/:path*"],
};
