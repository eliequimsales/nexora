import Link from "next/link";
import { redirect } from "next/navigation";
import { getSessionCompanyId } from "@/lib/auth";
import { estadoDaConta } from "@/lib/billing/acesso";
import { prisma } from "@/lib/db";
import { CabecalhoPainel } from "@/components/painel/cabecalho-painel";
import { PainelNavMobile } from "@/components/painel/navegacao";
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
    <div className="min-h-screen bg-[#F0F2F5] text-panel-ink">
      <RastreadorCadastroNovo />

      {/* Banner de Teste Grátis com Identidade Visual Nexora */}
      {estado === "TRIAL" && (
        <div className="border-b border-amber/30 bg-amber/15 px-4 py-2 text-center text-xs font-medium text-night sm:text-sm">
          <span className="inline-flex items-center gap-1.5">
            <span className="flex h-4 w-4 items-center justify-center rounded-full bg-amber text-[10px] font-black text-night shadow-2xs">
              ✦
            </span>
            <span>
              <strong>Período de teste Nexora:</strong> você tem{" "}
              <strong className="text-amber-deep font-bold">
                {diasRestantes} {diasRestantes === 1 ? "dia restante" : "dias restantes"}
              </strong>{" "}
              com atendimento inteligente liberado no WhatsApp.
            </span>
          </span>{" "}
          <Link
            href="/painel/assinatura"
            className="ml-2 inline-flex items-center font-bold text-amber-deep underline hover:text-night"
          >
            Ver planos →
          </Link>
        </div>
      )}

      {/* Banner de Teste Expirado */}
      {estado === "TRIAL_EXPIRADO" && (
        <div className="border-b border-red-200 bg-red-50 px-4 py-2 text-center text-xs font-medium text-red-700 sm:text-sm">
          <span>
            ⚠️ <strong>Seu período de teste terminou.</strong> Seus clientes e mensagens continuam salvos.
          </span>{" "}
          <Link
            href="/painel/assinatura"
            className="ml-2 inline-flex items-center font-bold text-red-700 underline"
          >
            Liberar envios →
          </Link>
        </div>
      )}

      <CabecalhoPainel empresaNome={company.name} navItems={navItems} />
      <PainelNavMobile items={navItems} />
      <main className="mx-auto max-w-page px-2 sm:px-6 py-4 sm:py-6 pb-28 sm:pb-8">{children}</main>
      <BotaoFeedback
        emailPadrao={company.email}
        telefonePadrao={company.phone}
        nomePadrao={company.name}
      />
    </div>
  );
}
