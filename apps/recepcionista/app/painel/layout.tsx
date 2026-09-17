import Link from "next/link";
import { redirect } from "next/navigation";
import { getSessionCompanyId } from "@/lib/auth";
import { prisma } from "@/lib/db";
import { emailConfigurado } from "@/lib/reengajamento/email";
import { AvisoVerificarEmail } from "./aviso-verificar";
import { LogoutButton } from "@/components/logout-button";
import { PainelNavDesktop, PainelNavMobile } from "@/components/painel/navegacao";

// O MENU É O FLUXO DE VALOR, NÃO O ÍNDICE DO SISTEMA.
//
// A Onda vem primeiro porque é a única tela que gera dinheiro. Logo depois, a
// prova de que gerou: ela tem que estar no caminho de todo dia, não atrás do
// botão de cancelar (que era onde morava).
//
// Conversas, Treinamento e Relatórios saíram daqui em 12/09/2026 — as rotas e as
// telas continuam de pé, alcançáveis por link direto. Com oito abas o painel
// parecia um ERP: quem entra procura o que fazer HOJE e encontrava sete caminhos
// que não trazem cliente de volta. tests/painel-nav.test.ts segura os dois lados:
// cinco itens no menu, e as três telas ainda existindo em disco.
const NAV = [
  // "Meus clientes", e não "Minha base": base é palavra de CRM. O dono chama de
  // lista, de caderno, de agenda — nunca de base.
  { href: "/painel/clientes/importar", label: "Meus clientes" },
  { href: "/painel/onda", label: "Reativar clientes" },
  { href: "/painel/livro-caixa", label: "Dinheiro recuperado" },
  { href: "/painel/assinatura", label: "Minha conta" },
];

export default async function PainelLayout({ children }: { children: React.ReactNode }) {
  const companyId = await getSessionCompanyId();
  if (!companyId) redirect("/login");

  const company = await prisma.company.findUnique({
    where: { id: companyId },
    select: { name: true, plan: true, emailVerificadoEm: true },
  });
  if (!company) redirect("/login");

  return (
    <div className="min-h-screen bg-panel-bg text-panel-ink">
      {/*
        Aviso de e-mail não confirmado.
        Fica no topo de TODO o painel, e não escondido em configurações, porque
        a pessoa só descobriria o problema na hora de assinar — que é o pior
        momento possível para encontrar fricção. Não bloqueia nada aqui: o
        primeiro minuto do produto é onde o dono decide se fica.
      */}
      {!company.emailVerificadoEm && <AvisoVerificarEmail semEnvioDeEmail={!emailConfigurado()} />}

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
          <div className="flex items-center gap-4">
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
