import { NextResponse } from "next/server";
import { z } from "zod";
import { getSessionCompanyId } from "@/lib/auth";
import { ConfiguracaoErro, getConfiguracao, salvarConfiguracao } from "@/lib/atendente/configuracao";
import { proporPreenchimento } from "@/lib/atendente/preenchimento";
import { logError } from "@/lib/errors";
import { LIMITES, limitar } from "@/lib/limites";
import { TOO_MANY_ATTEMPTS } from "@/lib/rate-limit";
import { validarOrigemECsrfe } from "@/lib/seguranca/origem";

export const dynamic = "force-dynamic";
const entrada = z.object({
  revisao: z.number().int().min(0).max(Number.MAX_SAFE_INTEGER),
  mensagem: z.string().trim().min(1).max(6000),
}).strict();

export async function POST(request: Request) {
  const erroOrigem = validarOrigemECsrfe(request, { exigirJson: true });
  if (erroOrigem) return erroOrigem;
  const companyId = await getSessionCompanyId();
  if (!companyId) return NextResponse.json({ error: "Não autenticado" }, { status: 401 });
  if (!limitar("atendente-preencher", companyId, LIMITES.escrita)) {
    return NextResponse.json({ error: TOO_MANY_ATTEMPTS }, { status: 429 });
  }
  const dados = entrada.safeParse(await request.json().catch(() => null));
  if (!dados.success) return NextResponse.json({ error: "Envie uma mensagem de até 6.000 caracteres e a revisão atual da configuração." }, { status: 400 });
  try {
    const tela = await getConfiguracao(companyId);
    if (tela.revisao !== dados.data.revisao) {
      return NextResponse.json({ error: "A configuração mudou em outra janela. Atualize antes de continuar." }, { status: 409 });
    }
    const proposta = proporPreenchimento(tela.rascunho, dados.data.mensagem);
    const novaTela = proposta.alterou
      ? await salvarConfiguracao(companyId, { revisao: dados.data.revisao, rascunho: proposta.rascunho, etapa: tela.etapa })
      : tela;
    return NextResponse.json({ tela: novaTela, mensagem: proposta.mensagem });
  } catch (erro) {
    if (erro instanceof ConfiguracaoErro) return NextResponse.json({ error: erro.message }, { status: erro.status });
    if (erro instanceof z.ZodError) return NextResponse.json({ error: "Divida as informações em mensagens menores para preparar a proposta." }, { status: 400 });
    await logError("atendente-preencher", erro, companyId);
    return NextResponse.json({ error: "Não consegui preparar a proposta agora. Seus dados de atendimento não foram aplicados por esta operação." }, { status: 500 });
  }
}
