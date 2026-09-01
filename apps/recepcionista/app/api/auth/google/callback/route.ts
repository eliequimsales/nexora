import { NextResponse } from "next/server";
import { randomBytes } from "crypto";
import { prisma } from "@/lib/db";
import { createSessionToken, hashPassword, setSessionCookie } from "@/lib/auth";
import { logError } from "@/lib/errors";
import { VERSAO_DOCUMENTOS } from "@/lib/legal/identidade";
import { appRedirect, exchangeCodeForUser, verifyOauthState } from "@/lib/google";

export const dynamic = "force-dynamic";

/** Callback do Google: valida, encontra ou cria a empresa e abre a sessão. */
export async function GET(request: Request) {
  const url = new URL(request.url);
  const code = url.searchParams.get("code");
  const state = url.searchParams.get("state");
  // Redirects SEMPRE via APP_URL — request.url é localhost:8080 atrás do proxy
  const fail = () => NextResponse.redirect(appRedirect("/login?erro=google", request.url));

  if (!code || !state || !(await verifyOauthState(state))) return fail();

  try {
    const user = await exchangeCodeForUser(code);

    let company = await prisma.company.findUnique({ where: { email: user.email } });
    const isNew = !company;

    if (!company) {
      // Cadastro via Google: senha aleatória interna (login segue via Google);
      // telefone fica vazio até a empresa completar o cadastro no painel.
      company = await prisma.company.create({
        data: {
          name: user.name ?? "Minha Empresa",
          email: user.email,
          phone: "",
          passwordHash: await hashPassword(randomBytes(24).toString("hex")),
          // O botao do Google fica na MESMA tela do checkbox de aceite, que
          // informa que entrar pelo Google tambem aceita os documentos. Sem
          // gravar aqui, o cadastro por Google criaria conta sem registro
          // nenhum de consentimento -- e ele tende a ser o caminho mais usado.
          termosAceitosEm: new Date(),
          termosVersao: VERSAO_DOCUMENTOS,
          profile: { create: {} },
        },
      });
    }

    setSessionCookie(await createSessionToken(company.id));
    return NextResponse.redirect(
      appRedirect(isNew ? "/painel/configuracoes" : "/painel", request.url),
    );
  } catch (error) {
    await logError("auth-google-callback", error);
    return fail();
  }
}
