import Link from "next/link";
import { redirect } from "next/navigation";
import { getSessionCompanyId } from "@/lib/auth";
import { estadoDaConta } from "@/lib/billing/acesso";
import { prisma } from "@/lib/db";
import { emailConfigurado } from "@/lib/reengajamento/email";
import { AvisoVerificarEmail } from "./aviso-verificar";
import { LogoutButton } from "@/components/logout-button";
import { BotaoBaixarApp } from "@/components/install-prompt";
import { PainelNavDesktop, PainelNavMobile } from "@/components/painel/navegacao";

// O MENU É O FLUXO DE VALOR, NÃO O ÍNDICE DO SISTEMA.
const NAV = [
  { href: "/painel/clientes/importar", label: "Meus clientes" },
  { href: "/painel/onda", label: "Reativar clientes" },
  { href: "/painel/livro-caixa", label: "Dinheiro recuperado" },
];

export default async function PainelLayout({ children }: { children: React.ReactNode }) {
  const companyId = await getSessionCompanyId();
  if (!companyId) redirect("/login");

  const company = await prisma.company.findUnique({
    where: { id: companyId },
    select: {
      name: true,
      plan: true,
      emailVerificadoEm: true,
      subscriptionStatus: true,
      trialEndsAt: true,
      currentPeriodEnd: true,
      cancelAtPeriodEnd: true,
      dunningIniciadoEm: true,
      acessoPagoAte: true,
    },
  });
  if (!company) redirect("/login");

  const agora = new Date();
  const estado = estadoDaConta(company, agora);
  const diasRestantes = company.trialEndsAt
    ? Math.max(1, Math.ceil((company.trialEndsAt.getTime() - agora.getTime()) / 86_400_000))
    : 7;

  return (
    <div className="min-h-screen bg-panel-bg text-panel-ink">
      {/*
        Aviso de e-mail não confirmado.
      */}
      {!company.emailVerificadoEm && <AvisoVerificarEmail semEnvioDeEmail={!emailConfigurado()} />}

      {/* Banner de Teste Grátis */}
      {estado === "TRIAL" && (
        <div className="border-b border-amber/30 bg-amber/10 px-4 py-2 text-center text-xs font-medium text-panel-ink sm:text-sm">
          <span>
            ⚡ <strong>Período de teste gratuito:</strong> você tem{" "}
            <strong className="text-amber">{diasRestantes} {diasRestantes === 1 ? "dia restante" : "dias restantes"}</strong> com envio de mensagens liberado.
          </span>{" "}
          <Link
            href="/painel/assinatura"
            className="ml-2 inline-flex items-center font-bold text-amber hover:underline"
          >
            Garantir plano por R$ 97/mês →
          </Link>
        </div>
      )}

      {/* Banner de Teste Expirado */}
      {estado === "TRIAL_EXPIRADO" && (
        <div className="border-b border-red-500/30 bg-red-500/10 px-4 py-2 text-center text-xs font-medium text-panel-ink sm:text-sm">
          <span>
            ⚠️ <strong>Seu período de teste terminou.</strong> Seus clientes e mensagens continuam salvos.
          </span>{" "}
          <Link
            href="/painel/assinatura"
            className="ml-2 inline-flex items-center font-bold text-red-400 hover:underline"
          >
            Liberar envios por R$ 97/mês →
          </Link>
        </div>
      )}

      <header className="border-b border-panel-line bg-panel-card">
        <div className="mx-auto flex max-w-page items-center justify-between px-6 py-3">
          <div className="flex items-center gap-8">
            <Link href="/painel/clientes/importar" className="flex items-center gap-2">
              <span className="flex h-7 w-7 items-center justify-center rounded-lg bg-amber font-display text-sm font-bold text-night">
                N
              </span>
              <span className="font-display font-semibold">
                Nexora
              </span>
            </Link>
            <PainelNavDesktop items={NAV} />
          </div>
          <div className="flex items-center gap-3">
            <BotaoBaixarApp />
            <Link
              href="/painel/agenda"
              className="inline-flex items-center gap-1.5 rounded-lg border border-amber/30 bg-amber/10 px-3 py-1.5 text-xs font-bold text-amber transition hover:bg-amber/20"
            >
              <span>🗓️</span>
              <span>Agenda</span>
            </Link>
            <span className="hidden text-sm text-panel-sub md:inline">{company.name}</span>
            <LogoutButton />
          </div>
        </div>
      </header>
      <PainelNavMobile items={NAV} />
      <main className="mx-auto max-w-page px-6 py-8">{children}</main>
    </div>
  );
}
