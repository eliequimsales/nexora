import Link from "next/link";
import { redirect } from "next/navigation";
import { getSessionCompanyId } from "@/lib/auth";
import { estadoDaConta } from "@/lib/billing/acesso";
import { prisma } from "@/lib/db";
import { LogoutButton } from "@/components/logout-button";
import { BotaoBaixarApp } from "@/components/install-prompt";
import { PainelNavDesktop, PainelNavMobile } from "@/components/painel/navegacao";
import { BotaoFeedback } from "@/components/feedback/botao-feedback";
import { RastreadorCadastroNovo } from "@/components/painel/rastreador-cadastro-novo";

// O MENU É O FLUXO DE VALOR, NÃO O ÍNDICE DO SISTEMA.
// As telas /painel/onda (Reativar clientes) e /painel/livro-caixa (Dinheiro recuperado) continuam acessíveis diretamente fora do menu.
const NAV = [
  { href: "/painel/atendente", label: "Atendente Virtual" },
  { href: "/painel/treinamento", label: "Ensinar Atendente" },
  { href: "/painel/clientes/importar", label: "Meus clientes" },
  { href: "/painel/agenda", label: "Agenda" },
  { href: "/painel/assinatura", label: "Planos" },
];

export default async function PainelLayout({ children }: { children: React.ReactNode }) {
  const companyId = await getSessionCompanyId();
  if (!companyId) redirect("/login");

  const company = await prisma.company.findUnique({
    where: { id: companyId },
    select: {
      name: true,
      email: true,
      phone: true,
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

  const duvidasPendentes = await prisma.knowledgeGap.count({
    where: { companyId, status: "OPEN" },
  });

  const navItems = NAV.map((item) => ({
    ...item,
    badge: item.href === "/painel/treinamento" ? duvidasPendentes : undefined,
  }));

  return (
    <div className="min-h-screen bg-panel-bg text-panel-ink">
      <RastreadorCadastroNovo />

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
            <Link href="/painel/atendente" className="flex items-center gap-2">
              <span className="flex h-7 w-7 items-center justify-center rounded-lg bg-amber font-display text-sm font-bold text-night">
                N
              </span>
              <span className="font-display font-semibold">
                Nexora
              </span>
            </Link>
            <PainelNavDesktop items={navItems} />
          </div>
          <div className="flex items-center gap-3">
            <BotaoBaixarApp />
            <span className="hidden text-sm text-panel-sub md:inline">{company.name}</span>
            <LogoutButton />
          </div>
        </div>
      </header>
      <PainelNavMobile items={navItems} />
      <main className="mx-auto max-w-page px-6 py-8">{children}</main>
      <BotaoFeedback
        emailPadrao={company.email}
        telefonePadrao={company.phone}
        nomePadrao={company.name}
      />
    </div>
  );
}
