import Link from "next/link";

function Bubble({
  from,
  time,
  delay,
  children,
}: {
  from: "customer" | "ai";
  time: string;
  delay: number;
  children: React.ReactNode;
}) {
  const isAi = from === "ai";
  return (
    <div
      className={`chat-msg flex ${isAi ? "justify-end" : "justify-start"}`}
      style={{ animationDelay: `${delay}s` }}
    >
      <div
        className={`max-w-[85%] rounded-2xl px-3.5 py-2.5 text-[13px] leading-snug text-white/95 shadow-sm ${
          isAi ? "rounded-br-md bg-wa-out" : "rounded-bl-md bg-wa-in"
        }`}
      >
        {children}
        <span className="mt-1 block text-right font-mono text-[10px] text-white/45">{time}</span>
      </div>
    </div>
  );
}

function PhoneDemo() {
  return (
    <div className="relative mx-auto w-full max-w-[340px]">
      <div className="rounded-[2rem] border border-night-line bg-wa-frame p-3 shadow-[0_24px_80px_-24px_rgba(47,224,139,0.25)]">
        <div className="flex items-center gap-3 rounded-t-3xl border-b border-white/5 px-2 pb-3 pt-1">
          <div className="flex h-9 w-9 items-center justify-center rounded-full bg-leaf-dark font-display text-sm font-bold text-white">
            SE
          </div>
          <div className="flex-1">
            <p className="text-sm font-semibold text-white/95">Sua Empresa</p>
            <p className="text-[11px] text-leaf">online</p>
          </div>
          <span className="font-mono text-[11px] text-amber">02:37</span>
        </div>

        <div className="flex min-h-[360px] flex-col justify-end gap-2.5 px-1 py-4">
          <Bubble from="customer" time="02:37" delay={0.4}>
            Boa noite! Vocês ainda estão abertos? Preciso de um orçamento 🙏
          </Bubble>
          <Bubble from="ai" time="02:37" delay={1.6}>
            Boa noite! 😊 Nosso horário é de segunda a sexta, das 8h às 18h — mas posso adiantar
            seu pedido agora mesmo. Me conta o que você precisa?
          </Bubble>
          <Bubble from="customer" time="02:38" delay={3.2}>
            Preciso do serviço completo ainda esta semana. Meu nome é Marcos
          </Bubble>
          <Bubble from="ai" time="02:38" delay={4.4}>
            Perfeito, Marcos! Registrei seu pedido de orçamento para esta semana. Nossa equipe
            confirma os detalhes com você logo cedo. Posso ajudar em mais alguma coisa?
          </Bubble>
        </div>
      </div>

      <div
        className="lead-chip absolute -bottom-5 left-1/2 flex w-max -translate-x-1/2 items-center gap-2 rounded-full border border-amber/40 bg-night-soft px-4 py-2 shadow-lg"
        style={{ animationDelay: "5.6s" }}
      >
        <span className="h-2 w-2 rounded-full bg-amber" />
        <span className="font-mono text-[11px] text-amber">
          oportunidade registrada — Marcos · orçamento
        </span>
      </div>
    </div>
  );
}

const BENEFITS = [
  {
    title: "Atende 24 horas por dia",
    text: "Seu cliente escreve às 2h da manhã e recebe uma resposta de verdade na hora — não uma mensagem automática vazia.",
  },
  {
    title: "Fala pela SUA empresa",
    text: "O Atendente usa só o que você cadastrou: produtos, serviços, preços, horários e regras. O que ele não sabe, ele não inventa.",
  },
  {
    title: "Captura oportunidades",
    text: "Pergunta o nome, entende o que o cliente procura e registra tudo no painel. Você acorda com a lista de quem quer comprar.",
  },
  {
    title: "Encaminha para sua equipe",
    text: "Pedido para falar com alguém, reclamação ou dúvida fora do combinado: a conversa vai para sua equipe com um clique.",
  },
];

const STEPS = [
  {
    title: "Cadastre sua empresa",
    text: "Produtos, serviços, preços, horários, perguntas frequentes e o tom de voz da sua marca. Leva poucos minutos.",
  },
  {
    title: "Conecte seu WhatsApp",
    text: "Integração simples com o número que você já usa — seus clientes continuam falando com a sua empresa.",
  },
  {
    title: "Seu Atendente assume",
    text: "Ele responde, registra oportunidades e chama sua equipe quando precisa. Você acompanha tudo pelo painel.",
  },
];

const PLANS = [
  {
    name: "Piloto",
    price: "R$ 0",
    period: "para começar",
    features: [
      "1 número de WhatsApp",
      "200 conversas/mês",
      "Conhecimento completo da empresa",
      "Painel de conversas",
    ],
    highlight: false,
    cta: "Começar grátis",
  },
  {
    name: "Profissional",
    price: "R$ 149",
    period: "/mês",
    features: [
      "1 número de WhatsApp",
      "Conversas ilimitadas",
      "Retomada automática de conversas",
      "Relatórios e oportunidades",
      "Encaminhamento para sua equipe",
    ],
    highlight: true,
    cta: "Criar meu Atendente",
  },
  {
    name: "Crescimento",
    price: "R$ 349",
    period: "/mês",
    features: [
      "Até 3 números",
      "Tudo do Profissional",
      "Vários atendentes no painel",
      "Suporte prioritário",
    ],
    highlight: false,
    cta: "Criar meu Atendente",
  },
];

export default function LandingPage() {
  return (
    <div className="min-h-screen bg-night text-mist">
      {/* Navegação */}
      <header className="mx-auto flex max-w-page items-center justify-between px-6 py-5">
        <Link href="/" className="flex items-center gap-2.5">
          <span className="flex h-8 w-8 items-center justify-center rounded-lg bg-leaf font-display text-base font-bold text-night">
            N
          </span>
          <span className="font-display text-lg font-semibold">
            Nexora <span className="font-normal text-mist/60">Atendente</span>
          </span>
        </Link>
        <nav className="hidden items-center gap-8 text-sm text-mist/70 md:flex">
          <a href="#beneficios" className="hover:text-mist">Benefícios</a>
          <a href="#como-funciona" className="hover:text-mist">Como funciona</a>
          <a href="#planos" className="hover:text-mist">Planos</a>
        </nav>
        <div className="flex items-center gap-3">
          <Link href="/login" className="px-3 py-2 text-sm text-mist/80 hover:text-mist">
            Entrar
          </Link>
          <Link
            href="/cadastro"
            className="rounded-lg bg-leaf px-4 py-2 text-sm font-semibold text-night transition hover:brightness-110"
          >
            Criar meu Atendente
          </Link>
        </div>
      </header>

      {/* Hero */}
      <section className="mx-auto grid max-w-page items-center gap-14 px-6 pb-24 pt-12 lg:grid-cols-[1.1fr_0.9fr] lg:pt-20">
        <div>
          <p className="mb-5 inline-flex items-center gap-2 rounded-full border border-amber/30 bg-amber/5 px-3 py-1.5 font-mono text-xs text-amber">
            <span className="h-1.5 w-1.5 animate-pulse rounded-full bg-amber" />
            02:37 — um cliente acabou de escrever
          </p>
          <h1 className="font-display text-4xl font-bold leading-[1.08] tracking-tight sm:text-5xl lg:text-[3.4rem]">
            Nexora <span className="text-leaf">Atendente</span>
          </h1>
          <p className="mt-6 max-w-xl text-lg leading-relaxed text-mist/70">
            Um Atendente Digital que responde seus clientes 24 horas por dia no WhatsApp. Aprende
            sobre sua empresa, responde dúvidas, captura oportunidades e encaminha para sua equipe
            quando necessário.
          </p>
          <div className="mt-9 flex flex-wrap items-center gap-4">
            <Link
              href="/cadastro"
              className="rounded-xl bg-leaf px-7 py-3.5 text-base font-semibold text-night transition hover:brightness-110"
            >
              Criar meu Atendente
            </Link>
            <a
              href="#como-funciona"
              className="rounded-xl border border-night-line px-7 py-3.5 text-base text-mist/80 transition hover:border-leaf/40 hover:text-mist"
            >
              Ver como funciona
            </a>
          </div>
          <p className="mt-6 font-mono text-xs text-mist/40">
            para qualquer empresa · configuração em minutos · sem cartão de crédito
          </p>
        </div>
        <PhoneDemo />
      </section>

      {/* A promessa honesta */}
      <section className="border-y border-night-line bg-night-soft/60">
        <div className="mx-auto max-w-page px-6 py-16 text-center">
          <p className="mx-auto max-w-3xl font-display text-2xl font-medium leading-snug text-mist/90 sm:text-3xl">
            Quando ele não sabe a resposta, ele não inventa —{" "}
            <span className="text-leaf">ele chama a sua equipe.</span>
          </p>
          <p className="mt-4 font-mono text-xs uppercase tracking-widest text-mist/40">
            toda resposta nasce do cadastro da sua empresa
          </p>
        </div>
      </section>

      {/* Benefícios */}
      <section id="beneficios" className="mx-auto max-w-page px-6 py-24">
        <h2 className="font-display text-3xl font-bold tracking-tight sm:text-4xl">
          O que ele faz pelo seu negócio
        </h2>
        <div className="mt-12 grid gap-5 sm:grid-cols-2">
          {BENEFITS.map((benefit) => (
            <div
              key={benefit.title}
              className="rounded-2xl border border-night-line bg-night-soft/50 p-7 transition hover:border-leaf/30"
            >
              <h3 className="font-display text-xl font-semibold text-mist">{benefit.title}</h3>
              <p className="mt-3 leading-relaxed text-mist/65">{benefit.text}</p>
            </div>
          ))}
        </div>
      </section>

      {/* Como funciona */}
      <section id="como-funciona" className="border-t border-night-line bg-night-soft/40">
        <div className="mx-auto max-w-page px-6 py-24">
          <h2 className="font-display text-3xl font-bold tracking-tight sm:text-4xl">
            Como funciona
          </h2>
          <div className="mt-12 grid gap-10 md:grid-cols-3">
            {STEPS.map((step, index) => (
              <div key={step.title} className="relative">
                <span className="font-mono text-sm text-leaf">passo {index + 1}</span>
                <h3 className="mt-3 font-display text-xl font-semibold">{step.title}</h3>
                <p className="mt-3 leading-relaxed text-mist/65">{step.text}</p>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* Planos */}
      <section id="planos" className="mx-auto max-w-page px-6 py-24">
        <h2 className="font-display text-3xl font-bold tracking-tight sm:text-4xl">Planos</h2>
        <p className="mt-3 text-mist/60">Preços de lançamento. Cancele quando quiser.</p>
        <div className="mt-12 grid gap-6 md:grid-cols-3">
          {PLANS.map((plan) => (
            <div
              key={plan.name}
              className={`flex flex-col rounded-2xl border p-8 ${
                plan.highlight
                  ? "border-leaf bg-night-soft shadow-[0_0_60px_-20px_rgba(47,224,139,0.4)]"
                  : "border-night-line bg-night-soft/40"
              }`}
            >
              <h3 className="font-display text-lg font-semibold">{plan.name}</h3>
              <p className="mt-4">
                <span className="font-display text-4xl font-bold">{plan.price}</span>
                <span className="ml-1 text-sm text-mist/50">{plan.period}</span>
              </p>
              <ul className="mt-6 flex-1 space-y-3 text-sm text-mist/75">
                {plan.features.map((feature) => (
                  <li key={feature} className="flex gap-2.5">
                    <span className="mt-0.5 text-leaf">✓</span>
                    {feature}
                  </li>
                ))}
              </ul>
              <Link
                href="/cadastro"
                className={`mt-8 rounded-xl px-5 py-3 text-center text-sm font-semibold transition ${
                  plan.highlight
                    ? "bg-leaf text-night hover:brightness-110"
                    : "border border-night-line text-mist hover:border-leaf/40"
                }`}
              >
                {plan.cta}
              </Link>
            </div>
          ))}
        </div>
      </section>

      {/* Chamada final */}
      <section className="mx-auto max-w-page px-6 pb-24">
        <div className="rounded-3xl border border-leaf/25 bg-gradient-to-br from-night-soft to-night p-12 text-center">
          <h2 className="mx-auto max-w-2xl font-display text-3xl font-bold leading-tight sm:text-4xl">
            Seu próximo cliente vai chamar <span className="text-amber">fora do horário.</span>
          </h2>
          <p className="mx-auto mt-4 max-w-xl text-mist/65">
            Crie seu Atendente em poucos minutos e nunca mais deixe uma conversa sem resposta.
          </p>
          <Link
            href="/cadastro"
            className="mt-8 inline-block rounded-xl bg-leaf px-8 py-4 text-base font-semibold text-night transition hover:brightness-110"
          >
            Criar meu Atendente
          </Link>
        </div>
      </section>

      <footer className="border-t border-night-line">
        <div className="mx-auto flex max-w-page flex-col items-center justify-between gap-4 px-6 py-8 text-sm text-mist/40 sm:flex-row">
          <p>Nexora Atendente — o primeiro produto da plataforma Nexora.</p>
          <p className="font-mono text-xs">atendimento que não dorme</p>
        </div>
      </footer>
    </div>
  );
}
