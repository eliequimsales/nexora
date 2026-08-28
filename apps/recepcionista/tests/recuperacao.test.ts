import { describe, expect, it } from "vitest";
import { calcularCiclo, MEDIANA_POR_SEGMENTO } from "@/lib/recuperacao/ciclo";
import { classificar } from "@/lib/recuperacao/esteiras";
import { diagnosticarVazio, montarOnda } from "@/lib/recuperacao/onda";
import { INTERVALOS_TOQUES, mensagemDoToque, proximoToque } from "@/lib/recuperacao/toques";

const d = (iso: string) => new Date(`${iso}T12:00:00.000Z`);

// ---------------------------------------------------------------------------
// CICLO PESSOAL — a base de tudo. Sem ciclo pessoal não existe Esteira 2 nem 3,
// e a recuperação volta a ser lista estática com regra global de "60 dias".
// ---------------------------------------------------------------------------
describe("calcularCiclo", () => {
  it("usa a MEDIANA dos intervalos do próprio cliente, não a média", () => {
    // Intervalos: 20, 22, 90 dias. Média seria 44 (distorcida pela viagem de
    // 3 meses); a mediana é 22, que é o comportamento real dele.
    const ciclo = calcularCiclo(
      [d("2026-01-01"), d("2026-01-21"), d("2026-02-12"), d("2026-05-13")],
      26,
    );
    expect(ciclo.dias).toBe(22);
    expect(ciclo.confianca).toBe("alta");
  });

  it("com 3 ou mais visitas a confiança é alta", () => {
    const ciclo = calcularCiclo([d("2026-01-01"), d("2026-01-25"), d("2026-02-18")], 26);
    expect(ciclo.visitas).toBe(3);
    expect(ciclo.confianca).toBe("alta");
    expect(ciclo.dias).toBe(24);
  });

  it("com menos de 3 visitas cai para a mediana do segmento e ADMITE confiança baixa", () => {
    const ciclo = calcularCiclo([d("2026-01-01"), d("2026-02-10")], 26);
    expect(ciclo.dias).toBe(26);
    expect(ciclo.confianca).toBe("baixa");
    // Verdade acima de marketing: o motivo é dito em português, não escondido.
    expect(ciclo.motivo).toContain("2 visita");
  });

  it("sem nenhuma visita registrada também é confiança baixa, nunca inventa ciclo", () => {
    const ciclo = calcularCiclo([], 30);
    expect(ciclo.dias).toBe(30);
    expect(ciclo.confianca).toBe("baixa");
    expect(ciclo.visitas).toBe(0);
  });

  it("ignora visitas duplicadas no mesmo dia (intervalo zero não é ciclo)", () => {
    const ciclo = calcularCiclo(
      [d("2026-01-01"), d("2026-01-01"), d("2026-01-21"), d("2026-02-10")],
      26,
    );
    expect(ciclo.dias).toBe(20);
  });

  it("aceita visitas fora de ordem", () => {
    const ciclo = calcularCiclo([d("2026-02-18"), d("2026-01-01"), d("2026-01-25")], 26);
    expect(ciclo.dias).toBe(24);
  });

  it("tem mediana conhecida para os segmentos que a Nexora atende", () => {
    expect(MEDIANA_POR_SEGMENTO["barbearia"]).toBeGreaterThan(0);
    expect(MEDIANA_POR_SEGMENTO["odontologia"]).toBeGreaterThan(
      MEDIANA_POR_SEGMENTO["barbearia"],
    );
  });
});

// ---------------------------------------------------------------------------
// AS TRÊS ESTEIRAS — a solução do valor episódico. O estoque (Resgate) esgota
// de propósito; Atraso e Pré-atraso se regeneram toda semana, para sempre.
// ---------------------------------------------------------------------------
describe("classificar — as três esteiras", () => {
  const cicloAlto = { dias: 24, confianca: "alta" as const, visitas: 9, motivo: "" };
  const hoje = d("2026-06-01");

  it("quem já tem agendamento futuro NUNCA entra em nenhuma esteira", () => {
    // Mandar mensagem de saudade para quem marcou ontem destrói a confiança
    // no produto inteiro na primeira mensagem.
    const r = classificar({
      ultimaVisita: d("2026-01-01"),
      ciclo: cicloAlto,
      temAgendamentoFuturo: true,
      hoje,
    });
    expect(r.esteira).toBe("EM_DIA");
  });

  it("PRE_ATRASO: a data de voltar cai nos próximos 7 dias e ele não marcou", () => {
    // Última visita 20 dias atrás, ciclo 24 → vence em 4 dias.
    const r = classificar({
      ultimaVisita: d("2026-05-12"),
      ciclo: cicloAlto,
      temAgendamentoFuturo: false,
      hoje,
    });
    expect(r.esteira).toBe("PRE_ATRASO");
  });

  it("EM_DIA quando ainda falta mais de uma semana para o ciclo vencer", () => {
    const r = classificar({
      ultimaVisita: d("2026-05-28"),
      ciclo: cicloAlto,
      temAgendamentoFuturo: false,
      hoje,
    });
    expect(r.esteira).toBe("EM_DIA");
  });

  it("ATRASO: passou de 1,5x o ciclo DELE — nunca uma regra global de 60 dias", () => {
    // 40 dias sem vir, ciclo 24 → limiar de atraso é 36.
    const r = classificar({
      ultimaVisita: d("2026-04-22"),
      ciclo: cicloAlto,
      temAgendamentoFuturo: false,
      hoje,
    });
    expect(r.esteira).toBe("ATRASO");
    expect(r.diasDesdeUltima).toBe(40);
  });

  it("o mesmo número de dias classifica diferente conforme o ciclo do cliente", () => {
    // 40 dias sem vir é ATRASO para quem corta o cabelo a cada 24 dias, mas é
    // só PRE_ATRASO para quem vai ao salão a cada 45 — esse ainda nem passou
    // da data dele, está prestes a passar. É por isso que uma regra global de
    // "60 dias" erra em todo mundo ao mesmo tempo.
    const cicloLongo = { dias: 45, confianca: "alta" as const, visitas: 6, motivo: "" };
    const rCurto = classificar({
      ultimaVisita: d("2026-04-22"),
      ciclo: cicloAlto,
      temAgendamentoFuturo: false,
      hoje,
    });
    const rLongo = classificar({
      ultimaVisita: d("2026-04-22"),
      ciclo: cicloLongo,
      temAgendamentoFuturo: false,
      hoje,
    });
    expect(rCurto.esteira).toBe("ATRASO");
    expect(rLongo.esteira).toBe("PRE_ATRASO");
  });

  it("com ciclo bem longo, os mesmos 40 dias ainda são EM_DIA", () => {
    // Odontologia: recall semestral. 40 dias não é sumiço nenhum.
    const cicloOdonto = { dias: 180, confianca: "alta" as const, visitas: 4, motivo: "" };
    const r = classificar({
      ultimaVisita: d("2026-04-22"),
      ciclo: cicloOdonto,
      temAgendamentoFuturo: false,
      hoje,
    });
    expect(r.esteira).toBe("EM_DIA");
  });

  it("RESGATE: estoque histórico, além de 3x o ciclo", () => {
    // 96 dias, ciclo 24 → 4x. É o Marcos do diagnóstico.
    const r = classificar({
      ultimaVisita: d("2026-02-25"),
      ciclo: cicloAlto,
      temAgendamentoFuturo: false,
      hoje,
    });
    expect(r.esteira).toBe("RESGATE");
    expect(r.diasDesdeUltima).toBe(96);
  });

  it("cliente importado sem nenhuma visita registrada cai em RESGATE", () => {
    const r = classificar({
      ultimaVisita: null,
      ciclo: { dias: 26, confianca: "baixa", visitas: 0, motivo: "" },
      temAgendamentoFuturo: false,
      hoje,
    });
    expect(r.esteira).toBe("RESGATE");
  });

  it("informa quantos dias além do ciclo dele, que é o texto do porquê auditável", () => {
    const r = classificar({
      ultimaVisita: d("2026-03-25"),
      ciclo: cicloAlto,
      temAgendamentoFuturo: false,
      hoje,
    });
    expect(r.diasDesdeUltima).toBe(68);
    expect(r.diasAlemDoCiclo).toBe(44);
  });
});

// ---------------------------------------------------------------------------
// A ONDA DE SEGUNDA — tamanho fixo, composição variável. É isso que faz o
// mês 2 entregar DIFERENTE em vez de entregar MENOS.
// ---------------------------------------------------------------------------
describe("montarOnda", () => {
  const cli = (
    id: string,
    esteira: "PRE_ATRASO" | "ATRASO" | "RESGATE",
    valorCents: number,
    toqueVencido = false,
  ) => ({ id, esteira, valorCents, toqueVencido, confianca: "alta" as const });

  it("tem tamanho fixo de 12 — protege o WhatsApp do dono e a mão dele", () => {
    const candidatos = Array.from({ length: 40 }, (_, i) => cli(`c${i}`, "RESGATE", 5000));
    expect(montarOnda(candidatos)).toHaveLength(12);
  });

  it("follow-up vencido do Protocolo 4 Toques vem na frente de tudo", () => {
    // Não mandar o toque 2 é jogar fora a maior alavanca disponível (+81%).
    const onda = montarOnda([
      cli("novo", "PRE_ATRASO", 90000),
      cli("followup", "RESGATE", 1000, true),
    ]);
    expect(onda[0].id).toBe("followup");
  });

  it("respeita a ordem das esteiras: pré-atraso, depois atraso, depois estoque", () => {
    const onda = montarOnda([
      cli("estoque", "RESGATE", 90000),
      cli("atrasado", "ATRASO", 90000),
      cli("prevencao", "PRE_ATRASO", 1000),
    ]);
    expect(onda.map((c) => c.id)).toEqual(["prevencao", "atrasado", "estoque"]);
  });

  it("dentro da mesma esteira, ordena por dinheiro em jogo", () => {
    const onda = montarOnda([
      cli("barato", "ATRASO", 3000),
      cli("caro", "ATRASO", 30000),
      cli("medio", "ATRASO", 12000),
    ]);
    expect(onda.map((c) => c.id)).toEqual(["caro", "medio", "barato"]);
  });

  it("completa com estoque histórico quando o fluxo da semana não enche 12", () => {
    const onda = montarOnda([
      cli("p1", "PRE_ATRASO", 5000),
      cli("a1", "ATRASO", 5000),
      ...Array.from({ length: 20 }, (_, i) => cli(`r${i}`, "RESGATE", 1000)),
    ]);
    expect(onda).toHaveLength(12);
    expect(onda.filter((c) => c.esteira === "RESGATE")).toHaveLength(10);
  });

  it("devolve menos de 12 quando não há candidatos de qualidade, sem completar com lixo", () => {
    // Encher a onda com cliente marginal mata a confiança na primeira mensagem
    // que o dono manda para alguém que esteve lá semana passada.
    const onda = montarOnda([cli("a", "ATRASO", 5000), cli("b", "RESGATE", 2000)]);
    expect(onda).toHaveLength(2);
  });

  it("aceita tamanho customizado, para a onda reduzida de resgate de cliente travado", () => {
    const candidatos = Array.from({ length: 30 }, (_, i) => cli(`c${i}`, "ATRASO", 5000));
    expect(montarOnda(candidatos, 5)).toHaveLength(5);
  });
});

// ---------------------------------------------------------------------------
// PROTOCOLO 4 TOQUES — 4 a 5 tentativas recuperam ~81% a mais que uma só.
// ---------------------------------------------------------------------------
describe("proximoToque", () => {
  const hoje = d("2026-06-01");

  it("cliente nunca contatado começa no toque 1", () => {
    const t = proximoToque([], hoje);
    expect(t?.numero).toBe(1);
    expect(t?.vencido).toBe(true);
  });

  it("os intervalos são D0, D+4, D+11 e D+25 — ângulos diferentes, não repetição", () => {
    expect(INTERVALOS_TOQUES).toEqual([0, 4, 11, 25]);
  });

  it("toque 2 só vence 4 dias depois do toque 1", () => {
    const aindaNao = proximoToque([{ touchNumber: 1, sentAt: d("2026-05-29") }], hoje);
    expect(aindaNao?.numero).toBe(2);
    expect(aindaNao?.vencido).toBe(false);

    const jaVenceu = proximoToque([{ touchNumber: 1, sentAt: d("2026-05-26") }], hoje);
    expect(jaVenceu?.vencido).toBe(true);
  });

  it("depois do toque 4 a sequência acaba — nunca vira perseguição", () => {
    const toques = [1, 2, 3, 4].map((n) => ({ touchNumber: n, sentAt: d("2026-04-01") }));
    expect(proximoToque(toques, hoje)).toBeNull();
  });
});

describe("mensagemDoToque", () => {
  const ctx = { primeiroNome: "Marcos", negocio: "Barbearia do Zé", link: "nexora.app/agendar/ze" };

  it("cada toque tem um ângulo diferente, nunca a mesma mensagem repetida", () => {
    const textos = [1, 2, 3, 4].map((n) => mensagemDoToque(n, ctx));
    expect(new Set(textos).size).toBe(4);
  });

  it("o toque 1 é leve e não oferece desconto", () => {
    const t = mensagemDoToque(1, ctx);
    expect(t).toContain("Marcos");
    expect(t.toLowerCase()).not.toContain("desconto");
    expect(t.toLowerCase()).not.toContain("promoção");
  });

  it("o toque 4 SEMPRE oferece saída explícita — exigência de CDC/LGPD", () => {
    const t = mensagemDoToque(4, ctx);
    expect(t.toLowerCase()).toContain("parar");
  });

  it("usa o primeiro nome, nunca o nome completo", () => {
    const t = mensagemDoToque(1, { ...ctx, primeiroNome: "Marcos" });
    expect(t).toContain("Marcos");
  });
});

// ---------------------------------------------------------------------------
// ONDA VAZIA — quatro situações completamente diferentes colapsavam num único
// `cards: []`, e a tela dizia a mesma frase para todas: "ninguém da sua base
// está atrasado". Para quem acabou de se cadastrar e não importou nada, isso é
// MENTIRA — e é a primeira tela que ele vê. Verdade acima de marketing.
// ---------------------------------------------------------------------------
describe("diagnosticarVazio", () => {
  it("base nunca importada é SEM_BASE, não 'ninguém atrasado'", () => {
    const v = diagnosticarVazio({ total: 0, ativos: 0, elegiveis: 0 });
    expect(v.motivo).toBe("SEM_BASE");
    expect(v.explicacao.toLowerCase()).not.toContain("está atrasado");
  });

  it("base inteira em opt-out não é confundida com base vazia", () => {
    const v = diagnosticarVazio({ total: 40, ativos: 0, elegiveis: 0 });
    expect(v.motivo).toBe("TODOS_OPT_OUT");
  });

  it("todo mundo já recebeu os 4 toques é SEQUENCIA_ESGOTADA", () => {
    const v = diagnosticarVazio({ total: 40, ativos: 40, elegiveis: 0 });
    expect(v.motivo).toBe("SEQUENCIA_ESGOTADA");
  });

  it("base saudável é a única que pode dizer 'hoje você não precisa abrir'", () => {
    const v = diagnosticarVazio({ total: 40, ativos: 40, elegiveis: 12 });
    expect(v.motivo).toBe("NINGUEM_ATRASADO");
  });

  // Regra Zero: tela que só informa é proibida. Nenhum dos quatro estados pode
  // deixar o dono sem nada para clicar.
  it("TODO estado vazio termina numa ação executável", () => {
    const casos = [
      { total: 0, ativos: 0, elegiveis: 0 },
      { total: 40, ativos: 0, elegiveis: 0 },
      { total: 40, ativos: 40, elegiveis: 0 },
      { total: 40, ativos: 40, elegiveis: 12 },
    ];
    for (const caso of casos) {
      const v = diagnosticarVazio(caso);
      expect(v.acao.texto.length).toBeGreaterThan(0);
      expect(v.acao.href.startsWith("/")).toBe(true);
      expect(v.titulo.length).toBeGreaterThan(0);
    }
  });
});
