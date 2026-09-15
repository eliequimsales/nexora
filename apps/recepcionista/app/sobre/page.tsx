import type { Metadata } from "next";
import Link from "next/link";
import { RodapePapel } from "@/components/rodape-papel";
import { FORNECEDOR, identificacaoCompleta, tipoDoDocumento } from "@/lib/legal/identidade";
import { TAMANHO_DA_ONDA } from "@/lib/recuperacao/onda";

export const metadata: Metadata = {
  title: "Sobre — Nexora",
  description:
    "Quem presta o serviço, por que a Nexora existe, o que ela se recusa a fazer e como falar com a gente.",
};

// Quem presta o serviço vem das variáveis do servidor (lib/legal/identidade.ts).
// Gerada no build, esta página sairia sem empresa nenhuma.
export const dynamic = "force-dynamic";

/**
 * SOBRE A NEXORA.
 *
 * A página que um dono desconfiado abre antes de colar a lista de clientes. Por
 * isso ela só afirma o que é verdade hoje: nada de número de clientes, depoimento
 * ou prêmio que não existe, e a empresa identificada pelo documento das variáveis
 * — não por uma frase escrita à mão que envelhece no dia em que o dado muda.
 */

const MANIFESTO = [
  `Não fazemos disparo em massa. São ${TAMANHO_DA_ONDA} mensagens por semana, escolhidas pelo ritmo de cada cliente.`,
  "Quem manda é você, do seu próprio WhatsApp, depois de ler cada mensagem.",
  "Quem tem horário marcado não recebe mensagem de saudade.",
  "Quem pede para parar sai da lista na hora e não volta a receber, nem se a lista for importada de novo.",
  "Lista comprada, alugada ou raspada de site é proibida nos Termos de Uso.",
  "Estimativa é chamada de estimativa. O Dinheiro recuperado só soma o retorno que dá para ligar à mensagem enviada.",
];

export default function PaginaSobre() {
  const identificada = identificacaoCompleta();
  const tipo = tipoDoDocumento(FORNECEDOR.documento);

  return (
    <div className="min-h-screen bg-paper text-paper-ink">
      <header className="border-b border-paper-line">
        <div className="mx-auto flex max-w-page items-center justify-between px-6 py-4">
          <Link href="/" className="flex items-center gap-2.5">
            <span className="flex h-8 w-8 items-center justify-center rounded-lg bg-amber font-display text-base font-bold text-night">
              N
            </span>
            <span className="font-display font-semibold">Nexora</span>
          </Link>
          <nav className="flex gap-5 text-sm text-paper-sub">
            <Link href="/status" className="transition hover:text-paper-ink">
              Status
            </Link>
            <Link href="/termos" className="transition hover:text-paper-ink">
              Termos
            </Link>
          </nav>
        </div>
      </header>

      <main className="mx-auto max-w-3xl px-6 py-16">
        <h1 className="font-display text-4xl font-bold tracking-[-0.03em]">Sobre a Nexora</h1>
        <p className="mt-4 text-lg leading-relaxed text-paper-sub">
          A Nexora existe para um problema que não aparece na agenda: o cliente que para de
          voltar sem avisar.
        </p>

        <div className="mt-14 grid gap-12 leading-[1.75] text-paper-ink/85">
          <section>
            <h2 className="font-display text-xl font-semibold tracking-[-0.01em] text-paper-ink">
              Por que ela existe
            </h2>
            <p className="mt-4">
              Barbearia, salão, clínica e pet shop vivem de cliente que volta. Quando um cliente
              para de voltar, ele não avisa: some da agenda, e a agenda de hoje continua cheia o
              bastante para ninguém perceber. A Nexora olha a lista de clientes que o negócio já
              tem, descobre o ritmo de cada um e aponta quem quebrou esse ritmo, com a mensagem
              pronta para chamar de volta.
            </p>
            <p className="mt-4">
              A primeira versão da Nexora, em 2026, era um atendente automático de WhatsApp. Hoje o
              foco é outro: o cliente que já veio e parou de voltar, que é dinheiro que o negócio já
              conquistou uma vez.
            </p>
          </section>

          <section>
            <h2 className="font-display text-xl font-semibold tracking-[-0.01em] text-paper-ink">
              Contra o disparo em massa
            </h2>
            <p className="mt-4">
              Ferramenta de disparo manda a mesma mensagem para todo mundo, queima o número do
              negócio e ensina o cliente a ignorar. A Nexora foi desenhada para o contrário:
            </p>
            <ul className="mt-5 grid gap-3">
              {MANIFESTO.map((item) => (
                <li key={item} className="flex gap-3">
                  <span className="mt-2.5 h-1.5 w-1.5 shrink-0 rounded-full bg-amber" />
                  <span>{item}</span>
                </li>
              ))}
            </ul>
          </section>

          <section id="empresa">
            <h2 className="font-display text-xl font-semibold tracking-[-0.01em] text-paper-ink">
              Quem presta o serviço
            </h2>
            {identificada ? (
              <p className="mt-4">
                {FORNECEDOR.nome}
                {tipo ? `, ${tipo} ${FORNECEDOR.documento}` : ""}, com endereço em{" "}
                {FORNECEDOR.endereco}. O atendimento é por e-mail.
              </p>
            ) : (
              <p className="mt-4">
                A identificação completa de quem presta o serviço está nos{" "}
                <Link href="/termos" className="underline underline-offset-4">
                  Termos de Uso
                </Link>
                .
              </p>
            )}
          </section>

          <section>
            <h2 className="font-display text-xl font-semibold tracking-[-0.01em] text-paper-ink">
              Seus dados e a LGPD
            </h2>
            <p className="mt-4">
              Sobre os seus dados de cadastro e cobrança, a Nexora é a controladora. Sobre os
              clientes que você sobe, quem controla é você, e a Nexora é operadora: trata esses
              dados seguindo a sua instrução, e nada além dela. Exportar e apagar a sua base são
              botões no painel, não pedidos.
            </p>
            <p className="mt-4">
              O encarregado de dados é {FORNECEDOR.encarregado}. Pedidos sobre dados são
              respondidos em até 15 dias. Os detalhes estão na{" "}
              <Link href="/privacidade" className="underline underline-offset-4">
                Política de Privacidade
              </Link>{" "}
              e no{" "}
              <Link href="/operador" className="underline underline-offset-4">
                Contrato de Operador
              </Link>
              .
            </p>
          </section>

          <section id="contato">
            <h2 className="font-display text-xl font-semibold tracking-[-0.01em] text-paper-ink">
              Contato
            </h2>
            <p className="mt-4">
              Para dúvida, suporte, reclamação ou pedido sobre dados, escreva para{" "}
              {FORNECEDOR.email.includes("@") ? (
                <a href={`mailto:${FORNECEDOR.email}`} className="underline underline-offset-4">
                  {FORNECEDOR.email}
                </a>
              ) : (
                "o e-mail que aparece nos Termos de Uso"
              )}
              .
            </p>
          </section>
        </div>
      </main>

      <RodapePapel />
    </div>
  );
}
