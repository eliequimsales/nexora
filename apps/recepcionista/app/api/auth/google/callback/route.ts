import { NextResponse } from "next/server";
import { cookies } from "next/headers";
import { randomBytes } from "crypto";
import { prisma } from "@/lib/db";
import { createSessionToken, hashPassword, setSessionCookie } from "@/lib/auth";
import { logError } from "@/lib/errors";
import { VERSAO_DOCUMENTOS } from "@/lib/legal/identidade";
import { relogioDoCadastro } from "@/lib/billing/relogio";
import { appRedirect, exchangeCodeForUser, OAUTH_STATE_COOKIE, verifyOauthState } from "@/lib/google";
import { decidirVinculoGoogle } from "@/lib/auth/vinculo-google";
import { clientIp, rateLimit } from "@/lib/rate-limit";

export const dynamic = "force-dynamic";

/** Callback do Google: valida, encontra ou cria a empresa e abre a sessão. */
export async function GET(request: Request) {
  const url = new URL(request.url);
  const code = url.searchParams.get("code");
  const state = url.searchParams.get("state");
  // Redirects SEMPRE via APP_URL — request.url é localhost:8080 atrás do proxy
  const fail = () => NextResponse.redirect(appRedirect("/login?erro=google", request.url));

  // Rate limit: sem ele o mesmo link de callback podia ser disparado contra
  // muitas vítimas de uma vez. /api/auth/google já tinha; aqui faltava.
  if (!rateLimit(`google-cb:${clientIp(request)}`, { limit: 20, windowMs: 5 * 60_000 })) {
    return fail();
  }

  const segredo = cookies().get(OAUTH_STATE_COOKIE)?.value;
  if (!code || !state || !(await verifyOauthState(state, segredo))) {
    await logError("auth-google-callback", new Error(`Falha de state/code: code=${Boolean(code)}, state=${Boolean(state)}, segredo=${Boolean(segredo)}`));
    return fail();
  }

  // O cookie é de uso único: some antes da troca do code, aconteça o que
  // acontecer depois. Deixá-lo vivo permitiria reusar o mesmo state.
  cookies().set(OAUTH_STATE_COOKIE, "", { httpOnly: true, path: "/", maxAge: 0 });

  try {
    const user = await exchangeCodeForUser(code);

    // Procura primeiro pela IDENTIDADE do Google, depois pelo e-mail. Achar só
    // por e-mail era o pré-sequestro de conta: quem cadastrasse o e-mail
    // comercial do alvo com senha própria recebia o dono real dentro da conta
    // dele. Ver lib/auth/vinculo-google.ts.
    const existente =
      (await prisma.company.findUnique({
        where: { googleSub: user.sub },
        select: { id: true, googleSub: true, emailVerificadoEm: true },
      })) ??
      (await prisma.company.findUnique({
        where: { email: user.email },
        select: { id: true, googleSub: true, emailVerificadoEm: true },
      }));

    const decisao = decidirVinculoGoogle(existente, user.sub);

    if (decisao.acao === "RECUSAR") {
      await logError("auth-google-callback", new Error(`Vínculo recusado: ${decisao.motivo}`));
      return NextResponse.redirect(appRedirect("/login?erro=google-vinculo", request.url));
    }

    let company: { id: string; sessaoEpoca: number };
    const isNew = decisao.acao === "CRIAR";

    if (decisao.acao === "CRIAR") {
      // Cadastro via Google: senha aleatória interna (login segue via Google);
      // telefone fica vazio até a empresa completar o cadastro no painel.
      company = await prisma.company.create({
        select: { id: true, sessaoEpoca: true },
        data: {
          name: user.name ?? "Minha Empresa",
          email: user.email,
          phone: "",
          // A identidade do Google é gravada AGORA. Conta criada sem ela
          // poderia ser adotada depois por outra identidade com o mesmo e-mail.
          googleSub: user.sub,
          // O Google já provou a posse do e-mail (email_verified é conferido
          // em exchangeCodeForUser), então esta conta nasce verificada.
          emailVerificadoEm: new Date(),
          passwordHash: await hashPassword(randomBytes(24).toString("hex")),
          // O botao do Google fica na MESMA tela do checkbox de aceite, que
          // informa que entrar pelo Google tambem aceita os documentos. Sem
          // gravar aqui, o cadastro por Google criaria conta sem registro
          // nenhum de consentimento -- e ele tende a ser o caminho mais usado.
          termosAceitosEm: new Date(),
          termosVersao: VERSAO_DOCUMENTOS,
          // Mesmo registro do cadastro por senha. Sem isto, metade das contas
          // teria a prova completa do aceite e metade não — e o caminho pelo
          // Google tende a ser o mais usado.
          ipAceite: clientIp(request),
          // Mesma regra do cadastro por senha: o prazo segue a versão dos Termos aceita.
          trialEndsAt: relogioDoCadastro(VERSAO_DOCUMENTOS, new Date()),
          profile: { create: {} },
        },
      });
    } else if (decisao.acao === "VINCULAR") {
      // Conta que vincula com o Google ganha o vínculo e tem o e-mail validado.
      // Confere se o e-mail foi comprovado por envio e clique real de token de verificação,
      // e não apenas por liberação de contorno excepcional (ex: verificar/sem-email).
      const comprovacaoReal = await prisma.verificacaoEmail.findFirst({
        where: { companyId: decisao.companyId, usadoEm: { not: null } },
      });
      const emailRealmenteComprovado = Boolean(existente?.emailVerificadoEm && comprovacaoReal);

      // Se a conta foi pré-criada com senha e o endereço não foi provado por recebimento real,
      // neutralizamos a senha pré-cadastrada com hash criptográfico aleatório.
      // Sempre incrementamos sessaoEpoca para revogar qualquer sessão antiga pré-existente.
      const precisaResetarSenha = !emailRealmenteComprovado;
      const novoHash = precisaResetarSenha
        ? await hashPassword(randomBytes(24).toString("hex"))
        : undefined;

      company = await prisma.company.update({
        where: { id: decisao.companyId },
        data: {
          googleSub: user.sub,
          emailVerificadoEm: new Date(),
          sessaoEpoca: { increment: 1 },
          ...(novoHash ? { passwordHash: novoHash } : {}),
        },
        select: { id: true, sessaoEpoca: true },
      });
    } else {
      const conta = await prisma.company.findUniqueOrThrow({
        where: { id: decisao.companyId },
        select: { id: true, sessaoEpoca: true },
      });
      company = conta;
    }

    setSessionCookie(await createSessionToken(company.id, company.sessaoEpoca));
    return NextResponse.redirect(
      appRedirect(isNew ? "/painel/atendente?novo=1" : "/painel/atendente", request.url),
    );
  } catch (error) {
    await logError("auth-google-callback", error);
    return fail();
  }
}
