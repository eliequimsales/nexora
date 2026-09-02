import { NextResponse } from "next/server";
import { clearSessionCookie, getSessionCompanyId, revogarSessoes } from "@/lib/auth";

export const dynamic = "force-dynamic";

/**
 * Sair de verdade.
 *
 * Antes esta rota só apagava o cookie do próprio navegador — o token continuava
 * válido por até 7 dias para quem tivesse uma cópia dele. "Sair" numa máquina
 * emprestada não tirava ninguém de lugar nenhum.
 *
 * Agora incrementa a época da conta, o que invalida TODAS as sessões abertas.
 * Sair de um dispositivo derruba os outros: é mais agressivo do que o normal, e
 * é a escolha certa para quem clica em sair porque desconfia de alguma coisa.
 */
export async function POST() {
  const companyId = await getSessionCompanyId();
  if (companyId) await revogarSessoes(companyId);
  clearSessionCookie();
  return NextResponse.json({ ok: true });
}
