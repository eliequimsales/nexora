import Link from "next/link";
import { redirect } from "next/navigation";
import { getSessionCompanyId } from "@/lib/auth";
import { prisma } from "@/lib/db";
import { AvisoVerificarEmail } from "./aviso-verificar";
import { LogoutButton } from "@/components/logout-button";

// A Onda vem primeiro porque é a única tela que gera dinheiro. Ela existia e
// não estava no menu — o loop central do produto era inalcançável.
const NAV = [
  { href: "/painel/onda", label: "Onda de segunda" },
  { href: "/painel/clientes/importar", label: "Minha base" },
  { href: "/painel/conversas", label: "Conversas" },
  { href: "/painel/treinamento", label: "Treinamento" },
  { href: "/painel/configuracoes", label: "Meu Atendente" },
  { href: "/painel/relatorios", label: "Relatórios" },
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
      {!company.emailVerificadoEm && <AvisoVerificarEmail />}

      <header className="border-b border-panel-line bg-panel-card">
        <div className="mx-auto flex max-w-page items-center justify-between px-6 py-3">
          <div className="flex items-center gap-8">
            <Link href="/painel/onda" className="flex items-center gap-2">
              <span className="flex h-7 w-7 items-center justify-center rounded-lg bg-amber font-display text-sm font-bold text-night">
                N
              </span>
              <span className="font-display font-semibold">
                Nexora
              </span>
            </Link>
            <nav className="hidden items-center gap-1 sm:flex">
              {NAV.map((item) => (
                <Link
                  key={item.href}
                  href={item.href}
                  className="rounded-lg px-3 py-1.5 text-sm text-panel-sub transition hover:bg-panel-bg hover:text-panel-ink"
                >
                  {item.label}
                </Link>
              ))}
            </nav>
          </div>
          <div className="flex items-center gap-4">
            <span className="hidden text-sm text-panel-sub md:inline">{company.name}</span>
            <LogoutButton />
          </div>
        </div>
      </header>
      <nav className="flex items-center gap-1 border-b border-panel-line bg-panel-card px-4 py-2 sm:hidden">
        {NAV.map((item) => (
          <Link
            key={item.href}
            href={item.href}
            className="rounded-lg px-3 py-1.5 text-sm text-panel-sub"
          >
            {item.label}
          </Link>
        ))}
      </nav>
      <main className="mx-auto max-w-page px-6 py-8">{children}</main>
    </div>
  );
}
