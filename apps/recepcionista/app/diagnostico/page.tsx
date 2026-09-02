import type { Metadata } from "next";
import Link from "next/link";
import { formasDePagamentoTexto } from "@/lib/billing/preco";
import { PainelDiagnostico } from "./painel";
import { EventoAoMontar } from "@/components/funil";
import { FRASE_SOCORRO, temCanalDeSocorro } from "@/lib/contato";
import { lerParametros } from "@/lib/diagnostico/parametros";

export const metadata: Metadata = {
  title: "Descubra quais clientes seus sumiram — Nexora",
  description:
    "Cole a lista de clientes que você já tem e veja, com nome e sobrenome, quem parou de voltar e quanto dinheiro isso é. De graça, sem cadastro, e sua lista não é gravada.",
};

/**
 * A PORTA DE ENTRADA DA EMPRESA.
 *
 * Server component: a metade de venda é HTML estático (indexável e rápida), e
 * todo o estado vive num único client island. Isso não é preferência de
 * arquitetura — o texto colado é dado pessoal de terceiros, e ele precisa
 * existir em exatamente UM lugar na memória para poder ser apagado numa linha
 * quando o dono clicar em "apagar minha lista".
 *
 * Ordem de scroll deliberada: a caixa de colar fica ACIMA da dobra e o
 * mecanismo vem DEPOIS dela. O público está consciente do PROBLEMA e não da
 * SOLUÇÃO — ele não sabe que existe software para isso. Se a página abrir
 * explicando o que é um CRM de recuperação, ele não se reconhece e sai; se a
 * educação vier antes da caixa, quem já estava pronto rola e desiste.
 */

const PASSOS = [
  {
    titulo: "Eu descubro o ritmo de cada cliente",
    corpo:
      "Não uso uma regra de '60 dias sem aparecer'. Olho de quanto em quanto tempo AQUELE cliente costumava voltar. Quem ia toda semana e sumiu há um mês está muito mais atrasado que quem ia de três em três meses.",
  },
  {
    titulo: "Separo quem sumiu de quem é assim mesmo",
    corpo:
      "Tem cliente que aparece de vez em quando e sempre foi assim — esse não sumiu. Sumiu é quem quebrou a rotina dele. Essa diferença é a razão de a lista sair pequena e certeira em vez de grande e inútil.",
  },
  {
    titulo: "Te entrego a mensagem pronta, com o nome dele",
    corpo:
      "Doze clientes por semana, uma mensagem pronta para cada, escrita para aquela pessoa. Você lê, muda se quiser e manda do SEU WhatsApp. Quem manda é você, não um robô.",
  },
];

const OBJECOES = [
  {
    p: "Isso vai mandar mensagem para os meus clientes sozinho?",
    r: "Não. A Nexora escreve e você manda, do seu próprio número, copiando e colando. É de propósito: disparo em massa faz o WhatsApp banir o número, e o número da sua barbearia é a sua agenda inteira. Não vale o risco.",
  },
  {
    p: "Eu não tenho planilha, tenho um caderno.",
    // A frase de socorro só entra quando o canal existe. Ver lib/contato.ts:
    // prometer atendimento sem porta quebra justamente com quem mais precisa.
    r:
      "Serve. Nem precisa do caderno agora: escreve três nomes que você lembra que " +
      "sumiram e eu escrevo a mensagem para cada um. Se tiver a lista à mão, também " +
      "aceito colagem do Excel, CSV e arquivo de texto." +
      (temCanalDeSocorro() ? ` ${FRASE_SOCORRO}` : ""),
  },
  {
    p: "Vocês vão vender para os meus clientes?",
    r: "Não temos como. A lista que você cola aqui não é gravada em lugar nenhum — ela é lida na memória e descartada junto com a resposta. Depois, se você criar a conta, os dados ficam na sua conta e continuam seus: dá para exportar e apagar quando quiser.",
  },
  {
    p: "E se não voltar ninguém?",
    r: "Aí você não paga. O primeiro mês é grátis e não pedimos cartão para começar. Você decide se assina depois de ver o resultado na tela, com nome de quem voltou e quanto pagou.",
  },
  {
    p: "Quanto tempo isso toma por semana?",
    r: "Uns nove minutos. São doze mensagens de copiar e colar, uma vez por semana. Não é um sistema para você aprender a usar — é uma lista para você executar.",
  },
  {
    p: "Já tenho um sistema de agendamento.",
    r: "A Nexora não substitui. Sistema de agendamento cuida de quem já está vindo; ela cuida de quem parou de vir. São problemas diferentes, e o segundo não aparece na agenda de ninguém — porque a agenda de hoje continua cheia.",
  },
];

/**
 * Como o ramo aparece no título. "Barbeiro: você tem clientes que sumiram"
 * conversa com quem clicou num anúncio de barbearia; o genérico conversa com
 * ninguém em específico.
 */
const VOCATIVO: Record<string, string> = {
  barbearia: "Barbeiro",
  salao: "Dono de salão",
  estetica: "Dono de clínica de estética",
  petshop: "Dono de pet shop",
  odontologia: "Dentista",
  fisioterapia: "Fisioterapeuta",
  academia: "Dono de academia",
  clinica: "Dono de clínica",
};

export default function PaginaDiagnostico({
  searchParams,
}: {
  searchParams: Record<string, string | string[] | undefined>;
}) {
  const { ramo, ticketReais } = lerParametros(searchParams);
  const vocativo = ramo ? VOCATIVO[ramo] : null;

  return (
    <div className="min-h-screen bg-night text-mist">
      {/* Sem isto, "quanto custou trazer alguem" e chute. Ver lib/funil.ts. */}
      <EventoAoMontar nome="chegou" />
      <header className="border-b border-night-line">
        <div className="mx-auto flex max-w-page items-center justify-between px-6 py-4">
          <Link href="/" className="flex items-center gap-2.5">
            <span className="flex h-8 w-8 items-center justify-center rounded-lg bg-amber font-display text-base font-bold text-night">
              N
            </span>
            <span className="font-display font-semibold">Nexora</span>
          </Link>
          <Link href="/login" className="text-sm text-mist/70 hover:text-mist">
            Entrar
          </Link>
        </div>
      </header>

      {/* ATO 1 — o problema, e a ferramenta na mesma tela. */}
      <section className="mx-auto max-w-page px-6 pb-20 pt-14 sm:pt-20">
        <div className="grid gap-12 lg:grid-cols-[1fr_1.05fr] lg:gap-16">
          <div>
            <p className="font-mono text-xs uppercase tracking-[0.16em] text-amber">
              Sem cadastro · Sem cartão · Sua lista não é gravada
            </p>
            <h1 className="mt-5 font-display text-4xl font-bold leading-[1.08] tracking-tight sm:text-5xl">
              {vocativo ? `${vocativo}: você tem clientes que sumiram e não sabe quem são.` : "Você tem clientes que sumiram e não sabe quem são."}
            </h1>
            <p className="mt-6 text-lg leading-relaxed text-mist/70">
              Cola aqui a lista que você já tem — planilha do Excel, caderno digitado, até o
              texto exportado de uma conversa do WhatsApp. Em menos de um minuto eu te digo,
              com nome e sobrenome, quem parou de voltar e quanto dinheiro isso é.
            </p>

            <p className="mt-8 border-l-2 border-amber pl-4 text-sm leading-relaxed text-mist/60">
              O prejuízo de cliente que some é o único que não faz barulho. Ninguém cancela
              nada, ninguém reclama — a pessoa só vai espaçando até parar. E como o movimento
              do dia continua, você não percebe.
            </p>
          </div>

          <PainelDiagnostico ramoInicial={ramo} ticketInicial={ticketReais} />
        </div>
      </section>

      {/* ATO 2 — o mecanismo. Vem depois da caixa de propósito. */}
      <section className="border-t border-night-line bg-night-soft/30">
        <div className="mx-auto max-w-page px-6 py-20">
          <h2 className="font-display text-2xl font-bold sm:text-3xl">
            Como eu descubro isso
          </h2>
          <div className="mt-10 grid gap-8 md:grid-cols-3">
            {PASSOS.map((p, i) => (
              <div key={p.titulo}>
                <span className="font-mono text-xs text-amber">
                  {String(i + 1).padStart(2, "0")}
                </span>
                <h3 className="mt-3 font-display text-lg font-semibold">{p.titulo}</h3>
                <p className="mt-2 text-sm leading-relaxed text-mist/65">{p.corpo}</p>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* ATO 3 — separar do que ele já conhece e não quer. */}
      <section className="mx-auto max-w-page px-6 py-20">
        <div className="rounded-2xl border border-night-line bg-night-soft/40 p-8 sm:p-10">
          <h2 className="font-display text-2xl font-bold">Isso não é disparo em massa</h2>
          <p className="mt-4 max-w-2xl leading-relaxed text-mist/70">
            Ferramenta de disparo manda a mesma mensagem para a lista inteira. Duas coisas
            acontecem: o WhatsApp bane o número, e quem esteve na sua loja ontem recebe uma
            mensagem de saudade — e percebe que é robô.
          </p>
          <p className="mt-4 max-w-2xl leading-relaxed text-mist/70">
            A Nexora manda <strong className="text-mist">doze por semana</strong>, escolhidas
            pelo ritmo de cada um, e quem tem horário marcado nunca entra na lista. Você lê
            cada uma antes de mandar. É mais devagar de propósito.
          </p>
        </div>
      </section>

      {/* ATO 4 — preço, garantia e quem responde por ela. */}
      <section className="border-y border-night-line bg-night-soft/30">
        <div className="mx-auto max-w-page px-6 py-20">
          <h2 className="font-display text-2xl font-bold sm:text-3xl">Quanto custa</h2>
          <p className="mt-6">
            <span className="font-display text-5xl font-bold">R$ 97</span>
            <span className="ml-2 text-mist/50">/mês, impostos inclusos</span>
          </p>
          <ul className="mt-8 grid max-w-2xl gap-3 text-mist/75">
            {[
              "O primeiro mês é grátis e não pedimos cartão para começar.",
              "Cancele quando quiser — você fica com o período que já pagou.",
              "Sua base é sua: dá para exportar e apagar a qualquer momento, inclusive depois de cancelar.",
              `Pagamento por ${formasDePagamentoTexto()}.`,
            ].map((item) => (
              <li key={item} className="flex gap-3">
                <span className="mt-1 text-amber">✓</span>
                {item}
              </li>
            ))}
          </ul>
          {/*
            Este parágrafo afirmava que a Nexora "é operada por pessoa jurídica
            registrada" e que "o CNPJ fica visível no rodapé e no e-mail de
            confirmação". Nenhuma das três coisas era verdade: não há CNPJ, o
            rodapé nunca mostrou nada, e não existe e-mail de confirmação de
            assinatura no produto. Mentir no parágrafo cuja função é tranquilizar
            juridicamente é o pior lugar possível para errar — e é o tipo de frase
            que um cliente lesado leva impressa para o Procon.
          */}
          <p className="mt-8 max-w-2xl text-sm leading-relaxed text-mist/55">
            O serviço é prestado por pessoa física, e o contrato é com ela. A
            identificação de quem presta o serviço, o preço total e as condições de
            cancelamento estão nos{" "}
            <Link href="/termos" className="text-mist/80 underline underline-offset-4">
              Termos de Uso
            </Link>
            , e o que fazemos com os dados está na{" "}
            <Link href="/privacidade" className="text-mist/80 underline underline-offset-4">
              Política de Privacidade
            </Link>
            .
          </p>
        </div>
      </section>

      {/* ATO 5 — objeções, na ordem em que aparecem de verdade. */}
      <section className="mx-auto max-w-page px-6 py-20">
        <h2 className="font-display text-2xl font-bold sm:text-3xl">
          O que costumam me perguntar
        </h2>
        <div className="mt-10 grid gap-6 md:grid-cols-2">
          {OBJECOES.map((o) => (
            <div key={o.p} className="rounded-xl border border-night-line p-6">
              <h3 className="font-display font-semibold">{o.p}</h3>
              <p className="mt-2 text-sm leading-relaxed text-mist/65">{o.r}</p>
            </div>
          ))}
        </div>
      </section>

      <footer className="border-t border-night-line">
        <div className="mx-auto max-w-page px-6 py-10 text-sm text-mist/45">
          <p>
            Nexora — recuperação de clientes inativos para pequenos negócios de serviço.
          </p>
          <p className="mt-2">
            A lista colada nesta página não é gravada: ela é processada na memória do
            servidor e descartada junto com a resposta.
          </p>
        </div>
      </footer>
    </div>
  );
}
