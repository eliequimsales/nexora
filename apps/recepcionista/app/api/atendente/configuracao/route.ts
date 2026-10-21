import { NextResponse } from "next/server";
import { z } from "zod";
import { getSessionCompanyId } from "@/lib/auth";
import { logError } from "@/lib/errors";
import { LIMITES, limitar } from "@/lib/limites";
import { TOO_MANY_ATTEMPTS } from "@/lib/rate-limit";
import { validarOrigemECsrfe } from "@/lib/seguranca/origem";
import { ConfiguracaoErro, confirmarTesteConfiguracao, getConfiguracao, importarCadastroConfiguracao, publicarConfiguracao, salvarConfiguracao, salvarConfiguracaoSchema } from "@/lib/atendente/configuracao";

export const dynamic = "force-dynamic";
// Uma sessão de preenchimento pode salvar várias vezes por minuto. O rascunho
// usa uma cota própria para não consumir as leituras nem bloquear ações finais.
const limiteDoRascunho = { limit: 120, windowMs: 60_000 };
const acao = z.discriminatedUnion("acao", [
  z.object({ acao: z.literal("PUBLICAR"), revisao: z.number().int().min(0) }).strict(),
  z.object({ acao: z.literal("IMPORTAR_CADASTRO"), revisao: z.number().int().min(0) }).strict(),
  z.object({ acao: z.literal("REVISAR_TESTE"), revisao: z.number().int().min(0), testeId: z.string().min(1).max(120), correto: z.boolean() }).strict(),
]);
function camposInvalidos(erro: z.ZodError) {
  const etapas: Record<string, number> = { negocio: 0, informacoes: 1, atendimento: 2, conhecimento: 3 };
  return erro.issues.map((item) => {
    const caminho = item.path[0] === "rascunho" ? item.path.slice(1) : item.path;
    return { campo: caminho.join("."), mensagem: "Confira o valor informado neste campo.", etapa: etapas[String(caminho[0])] ?? 0, bloqueia: true };
  });
}
async function responder(request: Request, metodo: "GET" | "PUT" | "POST") {
  if (metodo !== "GET") {
    const erroOrigem = validarOrigemECsrfe(request, { exigirJson: true });
    if (erroOrigem) return erroOrigem;
  }
  const companyId = await getSessionCompanyId();
  if (!companyId) return NextResponse.json({ error: "Não autenticado" }, { status: 401 });
  const politica = metodo === "GET" ? LIMITES.leitura : metodo === "PUT" ? limiteDoRascunho : LIMITES.escrita;
  if (!limitar(`atendente-configuracao:${metodo}`, companyId, politica)) return NextResponse.json({ error: TOO_MANY_ATTEMPTS }, { status: 429 });
  try {
    if (metodo === "GET") return NextResponse.json(await getConfiguracao(companyId));
    const body = await request.json().catch(() => null);
    if (metodo === "PUT") {
      const input = salvarConfiguracaoSchema.safeParse(body);
      if (!input.success) return NextResponse.json({ error: "Confira os dados da configuração.", pendencias: camposInvalidos(input.error) }, { status: 400 });
      return NextResponse.json(await salvarConfiguracao(companyId, input.data));
    }
    const input = acao.safeParse(body);
    if (!input.success) return NextResponse.json({ error: "Ação inválida." }, { status: 400 });
    if (input.data.acao === "PUBLICAR") return NextResponse.json(await publicarConfiguracao(companyId, input.data.revisao));
    if (input.data.acao === "IMPORTAR_CADASTRO") return NextResponse.json(await importarCadastroConfiguracao(companyId, input.data.revisao));
    return NextResponse.json(await confirmarTesteConfiguracao(companyId, input.data));
  } catch (error) {
    if (error instanceof ConfiguracaoErro) return NextResponse.json({ error: error.message, pendencias: error.pendencias }, { status: error.status });
    if (error && typeof error === "object" && "code" in error && error.code === "P2034") return NextResponse.json({ error: "O cadastro mudou durante a publicação. Recarregue e revise antes de tentar novamente." }, { status: 409 });
    await logError("atendente-configuracao", error, companyId);
    return NextResponse.json({ error: "Não consegui salvar a configuração agora. Seus dados anteriores foram preservados." }, { status: 500 });
  }
}
export const GET = (request: Request) => responder(request, "GET");
export const PUT = (request: Request) => responder(request, "PUT");
export const POST = (request: Request) => responder(request, "POST");
