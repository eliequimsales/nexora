import { describe, expect, it } from "vitest";
import {
  chaveDaSemana,
  momentoDaOnda,
  deveChamarParaOnda,
  textoDaChamada,
  type SinaisDaOnda,
} from "@/lib/reengajamento/onda-semanal";

/**
 * O GATILHO EXTERNO DO RITUAL DE SEGUNDA.
 *
 * Os onze momentos da régua são todos de ciclo de vida — TRIAL_ACABANDO,
 * CANCELOU, SEM_USO. Um assinante ATIVO nunca mais recebe nada. Ou seja: a
 * "Onda de segunda" depende inteiramente de o barbeiro lembrar sozinho, na
 * segunda de manhã, que é o dia mais cheio da semana dele.
 *
 * Hábito sem gatilho externo não é hábito. E a matemática diz que isso vale
 * muito: com 6 meses de vida média são precisos 27 assinantes para o anúncio
 * se pagar; com 12 meses, 13. Dobrar a retenção vale tanto quanto dobrar a
 * conversão, e é mais barato.
 *
 * A REGRA MAIS IMPORTANTE AQUI É QUANDO NÃO MANDAR. Anunciar uma onda vazia
 * ensina que o e-mail não vale a pena abrir — e derruba junto a entregabilidade
 * do PAGAMENTO_FALHOU, que é o e-mail que não pode faltar.
 */

const d = (iso: string) => new Date(`${iso}T12:00:00.000Z`);

function sinais(over: Partial<SinaisDaOnda> = {}): SinaisDaOnda {
  return {
    // `in` e nao `??`: null é um valor VÁLIDO e significativo aqui (conta sem
    // assinatura nenhuma), e `null ?? "active"` engoliria justamente o caso
    // que o teste quer exercitar.
    subscriptionStatus: "subscriptionStatus" in over ? over.subscriptionStatus! : "active",
    semEmail: over.semEmail ?? false,
    clientesNaBase: over.clientesNaBase ?? 120,
    cartoesNaOnda: over.cartoesNaOnda ?? 12,
    jaEnviadoNestaSemana: over.jaEnviadoNestaSemana ?? false,
  };
}

describe("a chave da semana isola um envio por semana", () => {
  it("tem ano e número da semana", () => {
    expect(chaveDaSemana(d("2026-09-02"))).toMatch(/^\d{4}-W\d{2}$/);
  });

  it("dias da mesma semana dão a mesma chave", () => {
    // Segunda 31/08/2026 e domingo 06/09/2026 são a mesma semana ISO.
    expect(chaveDaSemana(d("2026-08-31"))).toBe(chaveDaSemana(d("2026-09-06")));
  });

  it("semanas diferentes dão chaves diferentes", () => {
    expect(chaveDaSemana(d("2026-08-31"))).not.toBe(chaveDaSemana(d("2026-09-07")));
  });

  it("a virada de ano não colapsa duas semanas numa só", () => {
    // O erro clássico: usar o ano do calendário em vez do ano ISO faz a última
    // semana de dezembro colidir com a primeira de janeiro.
    const dez = chaveDaSemana(d("2026-12-28"));
    const jan = chaveDaSemana(d("2027-01-04"));
    expect(dez).not.toBe(jan);
  });

  it("o momento carrega a semana, para o unique do banco fazer o trabalho", () => {
    // Reengajamento tem @@unique([companyId, momento]) — pôr a semana no nome
    // garante um envio por semana sem migração e sem consulta extra.
    const m = momentoDaOnda(d("2026-09-02"));
    expect(m).toContain("ONDA:");
    expect(m).toContain(chaveDaSemana(d("2026-09-02")));
  });
});

describe("quando chamar para a Onda", () => {
  it("assinante ativo, com base e com onda montada: chama", () => {
    expect(deveChamarParaOnda(sinais())).toBe(true);
  });

  it("quem está no teste também é chamado", () => {
    // É justamente quem mais precisa ver o produto funcionando.
    expect(deveChamarParaOnda(sinais({ subscriptionStatus: "trialing" }))).toBe(true);
  });

  it("onda vazia NÃO gera e-mail", () => {
    // Anunciar zero nomes ensina que o e-mail não vale a pena abrir, e derruba
    // a entregabilidade do aviso de cobrança junto.
    expect(deveChamarParaOnda(sinais({ cartoesNaOnda: 0 }))).toBe(false);
  });

  it("base vazia NÃO gera e-mail", () => {
    expect(deveChamarParaOnda(sinais({ clientesNaBase: 0 }))).toBe(false);
  });

  it("quem pediu para não receber não recebe, em nenhuma hipótese", () => {
    expect(deveChamarParaOnda(sinais({ semEmail: true }))).toBe(false);
  });

  it("já enviado nesta semana: não manda de novo", () => {
    expect(deveChamarParaOnda(sinais({ jaEnviadoNestaSemana: true }))).toBe(false);
  });

  for (const status of ["canceled", "incomplete", "incomplete_expired", null]) {
    it(`assinatura "${status}" não recebe chamada semanal`, () => {
      // Cancelado tem a própria régua (CANCELOU, CANCELOU_14D). Mandar a onda
      // seria continuar tratando como cliente quem já saiu.
      expect(deveChamarParaOnda(sinais({ subscriptionStatus: status }))).toBe(false);
    });
  }

  it("past_due continua recebendo: ele ainda tem acesso e ainda é cliente", () => {
    expect(deveChamarParaOnda(sinais({ subscriptionStatus: "past_due" }))).toBe(true);
  });
});

describe("o texto fala do dinheiro dele, não da Nexora", () => {
  it("diz quantos nomes e quanto tempo leva", () => {
    const t = textoDaChamada({ nome: "Zé", cartoes: 12, potencialCents: 148_000, vencidos: 4 });
    expect(t.corpo).toContain("12");
    expect(t.corpo.toLowerCase()).toContain("minuto");
  });

  it("usa o nome do dono", () => {
    const t = textoDaChamada({ nome: "Barbearia do Zé", cartoes: 12, potencialCents: 0, vencidos: 0 });
    expect(t.corpo).toContain("Barbearia do Zé");
  });

  it("sem valor confiável, não inventa cifra", () => {
    const t = textoDaChamada({ nome: "Zé", cartoes: 12, potencialCents: 0, vencidos: 0 });
    expect(t.corpo).not.toContain("R$");
  });

  it("com valor, mostra a faixa e diz que é estimativa", () => {
    const t = textoDaChamada({ nome: "Zé", cartoes: 12, potencialCents: 148_000, vencidos: 0 });
    expect(t.corpo).toContain("R$");
    expect(t.corpo.toLowerCase()).toMatch(/estimad|pela sua|conta da sua/);
  });

  it("menciona follow-ups vencidos quando existem", () => {
    const t = textoDaChamada({ nome: "Zé", cartoes: 12, potencialCents: 0, vencidos: 4 });
    expect(t.corpo).toContain("4");
  });

  it("não menciona vencidos quando não há", () => {
    const t = textoDaChamada({ nome: "Zé", cartoes: 12, potencialCents: 0, vencidos: 0 });
    expect(t.corpo.toLowerCase()).not.toContain("vencid");
  });

  it("termina numa ação, e a ação é a Onda", () => {
    const t = textoDaChamada({ nome: "Zé", cartoes: 12, potencialCents: 0, vencidos: 0 });
    expect(t.acao.href).toBe("/painel/onda");
  });

  it("nome vazio não produz saudação quebrada", () => {
    const t = textoDaChamada({ nome: "   ", cartoes: 12, potencialCents: 0, vencidos: 0 });
    expect(t.corpo).not.toMatch(/^\s*,/);
    expect(t.corpo).not.toContain(" ,");
  });
});
