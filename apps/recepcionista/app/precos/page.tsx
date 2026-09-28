import type { Metadata } from "next";
import { unstable_noStore as noStore } from "next/cache";
import Link from "next/link";
import { CtaLink, TrackViewContent } from "@/components/funil";
import { RodapeFunil } from "@/components/rodape-funil";
import { TemaNexora } from "@/components/tema-nexora";
import { WhatsAppDemoCard } from "@/components/whatsapp-demo-card";
import { GARANTIA_DIAS } from "@/lib/billing/garantia";
import {
  MINUTOS_DA_CHAMADA,
  PRAZO_DA_IMPLANTACAO_DIAS,
  precoDaImplantacao,
  VAGAS_POR_SEMANA,
} from "@/lib/billing/implantacao";
import { PLANOS } from "@/lib/billing/planos";
import {
  emReais,
  PRECO_ANUAL_CENTS,
  PRECO_COMPLETO_CENTS,
  PRECO_IMPLANTACAO_CENTS,
  PRECO_MENSAL_CENTS,
} from "@/lib/billing/preco";
import { DIAS_DA_PRIMEIRA_ONDA } from "@/lib/billing/primeira-onda";
import { PERGUNTAS_DOS_PRECOS } from "@/lib/perguntas";
import { TAMANHO_DA_ONDA } from "@/lib/recuperacao/onda";

export const metadata: Metadata = {
  title: "Preços da Nexora — Planos simples e transparentes",
  description: `Comece com a primeira semana grátis sem cartão de crédito. Nexora Atendente por ${emReais(PRECO_MENSAL_CENTS)}/mês e Nexora Completo por ${emReais(PRECO_COMPLETO_CENTS)}/mês, com Garantia de Satisfação de ${GARANTIA_DIAS} dias.`,
};

const BOTAO_DOURADO =
  "inline-flex items-center justify-center gap-2 rounded-lg bg-nx-gold font-semibold text-nx-bg shadow-nx-glow-sm transition-all hover:bg-nx-gold/90 active:scale-[0.98]";

const PLANO_GRATIS = {
  rotulo: "Para testar",
  nome: "Experimente Grátis",
  descricao: "Veja clientes sumidos na sua lista e teste o Atendente sem colocar cartão de crédito.",
  valor: "R$ 0",
  itens: [
    `Primeira Onda com até ${TAMANHO_DA_ONDA} clientes em até ${DIAS_DA_PRIMEIRA_ONDA} dias`,
    "Diagnóstico automático do faturamento parado na lista",
    "Teste e simulação do Atendente Virtual no WhatsApp",
    "Importação rápida de planilha ou contatos",
    "Sem pedir cartão de crédito",
  ],
};

const PLANO_ATENDENTE = {
  rotulo: "Mais Popular",
  badge: "Recomendado",
  nome: "Nexora Atendente",
  valor: emReais(PRECO_MENSAL_CENTS),
  descricao: "Atendimento automático 24h no seu WhatsApp e agenda inteligente anti-falta.",
  itens: [
    "Atendente Virtual 24 horas no WhatsApp",
    "Respostas imediatas de dia, noite e fins de semana",
    "Agenda inteligente com link próprio e lembretes anti-falta",
    "Conexão via QR Code no seu próprio número de WhatsApp",
    "Até 3 profissionais na equipe",
    "Clientes e conversas ilimitadas",
    `Garantia de Satisfação de ${GARANTIA_DIAS} dias`,
  ],
  pagamento: `${PLANOS.pix_30_dias.dias} dias no Pix: ${emReais(PLANOS.pix_30_dias.valorCents)}, sem renovação automática · Cartão com renovação mensal · Anual à vista: ${emReais(PRECO_ANUAL_CENTS)} (2 meses grátis).`,
};

const PLANO_COMPLETO = {
  rotulo: "Mais Completo",
  badge: "Atendente + Recuperador",
  nome: "Nexora Completo",
  valor: emReais(PRECO_COMPLETO_CENTS),
  descricao: "Tudo do Atendente 24h + o Recuperador semanal de clientes para encher sua agenda.",
  itens: [
    "Tudo do Nexora Atendente (WhatsApp 24h e Agenda Inteligente)",
    `O Recuperador: ${TAMANHO_DA_ONDA} clientes resgatados toda semana`,
    "Painel de acompanhamento do faturamento recuperado em tempo real",
    "Profissionais ilimitados na equipe",
    "Suporte prioritário direto no WhatsApp",
    `Garantia de Satisfação de ${GARANTIA_DIAS} dias`,
  ],
  pagamento: `${PLANOS.pix_30_dias.dias} dias no Pix: ${emReais(PRECO_COMPLETO_CENTS)}, sem renovação automática · Cartão com renovação mensal · Anual à vista: ${emReais(PRECO_COMPLETO_CENTS * 10)}.`,
};

export default function Precos() {
  noStore();
  const temImplantacao = precoDaImplantacao(process.env) !== null;

  return (
    <TemaNexora>
      <TrackViewContent name="Precos" />
      {/* HEADER LIMPO */}
      <header className="sticky top-0 z-40 border-b border-nx-border bg-nx-bg/85 backdrop-blur-md">
        <div className="mx-auto flex max-w-6xl items-center justify-between px-6 py-3.5">
          <Link href="/" className="flex items-center gap-2.5">
            <span className="flex h-8 w-8 items-center justify-center rounded-lg bg-nx-gold text-base font-bold text-nx-bg">
              N
            </span>
            <span className="font-semibold text-nx-primary">Nexora</span>
          </Link>
          <div className="flex items-center gap-4">
            <Link
              href="/login"
              className="text-sm font-medium text-nx-secondary transition-colors hover:text-nx-primary"
            >
              Entrar
            </Link>
            <CtaLink href="/cadastro" ctaName="precos_header" className={`${BOTAO_DOURADO} px-4 py-2 text-sm`}>
              Começar grátis <span aria-hidden="true">→</span>
            </CtaLink>
          </div>
        </div>
      </header>

      <main>
        {/* HERO LIMPO E DIRETO */}
        <section className="px-6 pt-16 pb-12 sm:pt-20 sm:pb-16 text-center">
          <div className="mx-auto max-w-3xl">
            <div className="inline-flex items-center gap-2 rounded-full border border-nx-gold/30 bg-nx-gold/10 px-3.5 py-1 text-xs font-semibold text-nx-gold">
              <span>✦</span> Planos simples e transparentes
            </div>
            <h1 className="mt-5 text-4xl font-bold leading-tight tracking-tight text-nx-primary sm:text-5xl">
              Escolha o plano ideal para a sua empresa
            </h1>
            <p className="mt-4 text-lg leading-relaxed text-nx-secondary">
              A primeira semana é por nossa conta, sem pedir cartão de crédito. Cancele quando quiser, sem fidelidade nem letras miúdas.
            </p>
          </div>
        </section>

        {/* OS 3 CARDS DE PLANOS LADO A LADO */}
        <section id="planos" className="scroll-mt-20 px-6 pb-20">
          <div className="mx-auto max-w-6xl">
            <div className="grid items-stretch gap-8 lg:grid-cols-3">
              {/* CARD 1: GRÁTIS */}
              <div className="flex flex-col justify-between rounded-3xl border border-nx-border bg-nx-surface p-7 shadow-sm transition-all sm:p-8">
                <div>
                  <div className="flex items-center justify-between">
                    <span className="rounded-full border border-nx-border bg-nx-surface-2 px-3 py-1 text-xs font-semibold uppercase tracking-wider text-nx-muted">
                      {PLANO_GRATIS.rotulo}
                    </span>
                  </div>
                  <h2 className="mt-4 text-2xl font-bold text-nx-primary">{PLANO_GRATIS.nome}</h2>
                  <p className="mt-2 text-sm leading-relaxed text-nx-secondary">
                    {PLANO_GRATIS.descricao}
                  </p>
                  <p className="mt-6 flex items-baseline gap-1.5">
                    <span className="text-4xl font-extrabold tracking-tight text-nx-primary sm:text-5xl tabular-nums">
                      {PLANO_GRATIS.valor}
                    </span>
                    <span className="text-sm font-medium text-nx-muted">/ mês</span>
                  </p>

                  <CtaLink
                    href="/cadastro"
                    ctaName="precos_gratis"
                    className="mt-6 flex w-full items-center justify-center gap-2 rounded-xl border border-nx-border bg-nx-surface-2 px-6 py-3.5 text-sm font-semibold text-nx-primary transition-all hover:border-nx-border-2 hover:bg-nx-surface-3 active:scale-[0.98]"
                  >
                    Começar grátis sem cartão <span aria-hidden="true">→</span>
                  </CtaLink>

                  <div className="mt-8 border-t border-nx-border pt-6">
                    <p className="text-xs font-semibold uppercase tracking-wider text-nx-muted">
                      O que está incluso:
                    </p>
                    <ul className="mt-4 grid gap-3">
                      {PLANO_GRATIS.itens.map((item) => (
                        <li key={item} className="flex gap-3 text-sm leading-relaxed text-nx-secondary">
                          <span aria-hidden="true" className="mt-0.5 text-nx-muted">
                            ○
                          </span>
                          {item}
                        </li>
                      ))}
                    </ul>
                  </div>
                </div>

                <div className="mt-8 border-t border-nx-border pt-4">
                  <p className="text-xs leading-relaxed text-nx-muted">
                    Teste sem compromisso. Nenhum dado de cartão exigido.
                  </p>
                </div>
              </div>

              {/* CARD 2: NEXORA ATENDENTE (MAIS POPULAR) */}
              <div className="relative flex flex-col justify-between rounded-3xl border-2 border-nx-gold/60 bg-gradient-to-b from-nx-surface via-nx-surface to-nx-surface-2 p-7 shadow-nx-glow-sm transition-all sm:p-8">
                <div>
                  <div className="flex items-center justify-between">
                    <span className="rounded-full border border-nx-gold/40 bg-nx-gold/15 px-3 py-1 text-xs font-semibold uppercase tracking-wider text-nx-gold">
                      {PLANO_ATENDENTE.rotulo}
                    </span>
                    <span className="rounded-full bg-nx-gold px-2.5 py-0.5 text-[11px] font-bold uppercase tracking-wider text-nx-bg shadow-nx-glow-sm">
                      {PLANO_ATENDENTE.badge}
                    </span>
                  </div>
                  <h2 className="mt-4 text-2xl font-bold text-nx-primary">{PLANO_ATENDENTE.nome}</h2>
                  <p className="mt-2 text-sm leading-relaxed text-nx-secondary">
                    {PLANO_ATENDENTE.descricao}
                  </p>
                  <p className="mt-6 flex items-baseline gap-1.5">
                    <span className="text-4xl font-extrabold tracking-tight text-nx-gold sm:text-5xl tabular-nums">
                      {PLANO_ATENDENTE.valor}
                    </span>
                    <span className="text-sm font-medium text-nx-secondary">/ mês</span>
                  </p>

                  <CtaLink
                    href="/cadastro?plano=atendente"
                    ctaName="precos_plano"
                    className={`${BOTAO_DOURADO} mt-6 w-full py-3.5 text-sm sm:text-base`}
                  >
                    ✦ Assinar Nexora Atendente <span aria-hidden="true">→</span>
                  </CtaLink>

                  <div className="mt-8 border-t border-nx-border pt-6">
                    <p className="text-xs font-semibold uppercase tracking-wider text-nx-gold">
                      Tudo do teste grátis, e:
                    </p>
                    <ul className="mt-4 grid gap-3">
                      {PLANO_ATENDENTE.itens.map((item) => (
                        <li key={item} className="flex gap-3 text-sm leading-relaxed text-nx-secondary">
                          <span aria-hidden="true" className="mt-0.5 font-bold text-nx-success">
                            ✓
                          </span>
                          {item}
                        </li>
                      ))}
                    </ul>
                  </div>
                </div>

                <div className="mt-8 border-t border-nx-border pt-4">
                  <p className="text-xs leading-relaxed text-nx-muted">{PLANO_ATENDENTE.pagamento}</p>
                </div>
              </div>

              {/* CARD 3: NEXORA COMPLETO (ATENDENTE + RECUPERADOR) */}
              <div className="relative flex flex-col justify-between rounded-3xl border-2 border-nx-border-2 bg-gradient-to-b from-nx-surface via-nx-surface to-nx-surface-2 p-7 shadow-sm transition-all sm:p-8">
                <div>
                  <div className="flex items-center justify-between">
                    <span className="rounded-full border border-nx-border-2 bg-nx-surface-3 px-3 py-1 text-xs font-semibold uppercase tracking-wider text-nx-primary">
                      {PLANO_COMPLETO.rotulo}
                    </span>
                    <span className="rounded-full border border-nx-gold/40 bg-nx-gold/10 px-2.5 py-0.5 text-[11px] font-bold uppercase tracking-wider text-nx-gold">
                      {PLANO_COMPLETO.badge}
                    </span>
                  </div>
                  <h2 className="mt-4 text-2xl font-bold text-nx-primary">{PLANO_COMPLETO.nome}</h2>
                  <p className="mt-2 text-sm leading-relaxed text-nx-secondary">
                    {PLANO_COMPLETO.descricao}
                  </p>
                  <p className="mt-6 flex items-baseline gap-1.5">
                    <span className="text-4xl font-extrabold tracking-tight text-nx-gold sm:text-5xl tabular-nums">
                      {PLANO_COMPLETO.valor}
                    </span>
                    <span className="text-sm font-medium text-nx-secondary">/ mês</span>
                  </p>

                  <CtaLink
                    href="/cadastro?plano=completo"
                    ctaName="precos_plano_completo"
                    className="mt-6 flex w-full items-center justify-center gap-2 rounded-xl border border-nx-gold/60 bg-nx-surface-3 px-6 py-3.5 text-sm font-semibold text-nx-gold transition-all hover:bg-nx-gold hover:text-nx-bg active:scale-[0.98]"
                  >
                    ✦ Assinar Nexora Completo <span aria-hidden="true">→</span>
                  </CtaLink>

                  <div className="mt-8 border-t border-nx-border pt-6">
                    <p className="text-xs font-semibold uppercase tracking-wider text-nx-gold">
                      Tudo do Nexora Atendente, mais:
                    </p>
                    <ul className="mt-4 grid gap-3">
                      {PLANO_COMPLETO.itens.map((item) => (
                        <li key={item} className="flex gap-3 text-sm leading-relaxed text-nx-secondary">
                          <span aria-hidden="true" className="mt-0.5 font-bold text-nx-success">
                            ✓
                          </span>
                          {item}
                        </li>
                      ))}
                    </ul>
                  </div>
                </div>

                <div className="mt-8 border-t border-nx-border pt-4">
                  <p className="text-xs leading-relaxed text-nx-muted">{PLANO_COMPLETO.pagamento}</p>
                </div>
              </div>
            </div>

            {/* FAIXA DE TRANSPARÊNCIA: O QUE NUNCA COBRAMOS */}
            <div className="mt-12 rounded-2xl border border-nx-border bg-nx-surface p-6 text-center sm:p-8">
              <h3 className="text-sm font-semibold uppercase tracking-wider text-nx-gold">
                Transparência total
              </h3>
              <p className="mt-2 text-base font-semibold text-nx-primary sm:text-lg">
                Sem surpresas no final do mês: tudo o que você precisa já está incluso.
              </p>
              <div className="mt-4 flex flex-wrap items-center justify-center gap-x-8 gap-y-2 text-sm text-nx-secondary">
                <span className="flex items-center gap-2">
                  <span className="text-nx-success">✓</span> Sem cobrança por mensagem enviada
                </span>
                <span className="flex items-center gap-2">
                  <span className="text-nx-success">✓</span> Sem taxa por cliente na lista
                </span>
                <span className="flex items-center gap-2">
                  <span className="text-nx-success">✓</span> Sem porcentagem do dinheiro recuperado
                </span>
                <span className="flex items-center gap-2">
                  <span className="text-nx-success">✓</span> Sistema completo de agenda incluso
                </span>
              </div>
            </div>

            {/* DEMO NO WHATSAPP */}
            <div className="mt-12">
              <WhatsAppDemoCard origem="precos" />
            </div>
          </div>
        </section>

        {/* IMPLANTAÇÃO OPCIONAL (SE HABILITADA) */}
        {temImplantacao && (
          <section className="border-t border-nx-border px-6 py-16">
            <div className="mx-auto max-w-3xl">
              <h2 className="text-2xl font-bold text-nx-primary sm:text-3xl">Precisa de ajuda na configuração?</h2>
              <p className="mt-3 text-base text-nx-secondary">
                Oferecemos uma implantação individual assistida para deixar tudo pronto no seu negócio.
              </p>
              <div className="mt-6 rounded-2xl border border-nx-border bg-nx-surface p-6 sm:p-7">
                <div className="flex flex-wrap items-baseline justify-between gap-4">
                  <div>
                    <h3 className="text-lg font-semibold text-nx-primary">Implantação Assistida Individual</h3>
                    <p className="mt-1 text-sm text-nx-secondary">
                      Numa chamada de até {MINUTOS_DA_CHAMADA} minutos deixamos sua agenda e Atendente 100% prontos com você.
                    </p>
                  </div>
                  <span className="text-xl font-bold text-nx-gold tabular-nums">
                    {emReais(PRECO_IMPLANTACAO_CENTS)}, uma vez
                  </span>
                </div>
                <p className="mt-4 border-t border-nx-border pt-4 text-xs text-nx-muted">
                  Vagas limitadas a {VAGAS_POR_SEMANA} empresas por semana. Se não acontecer em {PRAZO_DA_IMPLANTACAO_DIAS} dias, devolvemos o valor integral.
                </p>
              </div>
            </div>
          </section>
        )}

        {/* GARANTIA DE 30 DIAS */}
        <section className="border-y border-nx-border bg-nx-surface-2/30 px-6 py-16">
          <div className="mx-auto max-w-3xl text-center">
            <span className="inline-flex items-center justify-center rounded-full bg-nx-gold/15 p-3 text-2xl text-nx-gold">
              🛡️
            </span>
            <h2 className="mt-4 text-3xl font-bold leading-tight text-nx-primary sm:text-4xl">
              Garantia de Satisfação de {GARANTIA_DIAS} dias
            </h2>
            <p className="mt-4 text-lg leading-relaxed text-nx-secondary">
              Use o Atendente Virtual no WhatsApp da sua empresa por {GARANTIA_DIAS} dias. Se você achar que ele não atendeu como você esperava ou não valeu a pena para o seu negócio, nós devolvemos 100% do que você pagou.
            </p>
            <p className="mt-3 text-sm text-nx-muted">
              Risco zero para você testar e aprovar. Simples assim, sem burocracia nem perguntas.
            </p>
          </div>
        </section>

        {/* PERGUNTAS FREQUENTES */}
        <section id="perguntas" className="scroll-mt-20 px-6 py-20">
          <div className="mx-auto max-w-3xl">
            <h2 className="text-3xl font-bold leading-tight text-nx-primary sm:text-4xl text-center">
              Dúvidas frequentes sobre o Atendente e os planos
            </h2>
            <dl className="mt-10">
              {PERGUNTAS_DOS_PRECOS.map((p) => (
                <div key={p.pergunta} className="border-t border-nx-border py-6 last:border-b">
                  <dt className="text-base font-semibold text-nx-primary">{p.pergunta}</dt>
                  <dd className="mt-2 text-sm leading-relaxed text-nx-secondary">{p.resposta}</dd>
                </div>
              ))}
            </dl>
          </div>
        </section>

        {/* CTA FINAL */}
        <section className="px-6 pb-24">
          <div className="mx-auto max-w-3xl border-t border-nx-border pt-14 text-center">
            <h2 className="text-3xl font-bold leading-tight text-nx-primary sm:text-4xl">
              Pronto para ter seu Atendente Virtual 24h?
            </h2>
            <p className="mx-auto mt-4 max-w-xl text-lg leading-relaxed text-nx-secondary">
              Crie sua conta em 2 minutos. A primeira semana de recuperação é por nossa conta, sem cartão de crédito.
            </p>
            <CtaLink href="/cadastro" ctaName="precos_final" className={`${BOTAO_DOURADO} mt-8 px-8 py-4 text-base sm:text-lg`}>
              Começar grátis agora <span aria-hidden="true">→</span>
            </CtaLink>
          </div>
        </section>
      </main>

      <RodapeFunil />

      {/* MOBILE STICKY CTA */}
      <div className="fixed inset-x-0 bottom-0 z-50 border-t border-nx-border bg-nx-bg/95 p-3 backdrop-blur-md sm:hidden">
        <CtaLink href="/cadastro" ctaName="precos_mobile_sticky" className={`${BOTAO_DOURADO} w-full px-5 py-3.5`}>
          Começar grátis <span aria-hidden="true">→</span>
        </CtaLink>
      </div>
    </TemaNexora>
  );
}
