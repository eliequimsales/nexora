import { describe, expect, it } from "vitest";
import {
  diaCurto,
  horaFalada,
  lerPedidoDeDia,
  localDe,
  proximaAbertura,
  quandoFalado,
  textoDaVolta,
} from "@/lib/atendente/datas";
import { detectarIntencao, lerEscolha, type ContextoDaIntencao } from "@/lib/atendente/intencao";

/**
 * O QUE O CLIENTE QUER, DECIDIDO POR CÓDIGO.
 *
 * Horário, escolha de opção, preço, urgência, pedido de pessoa e reclamação são
 * decididos por palavra, antes de qualquer IA: é mais rápido, mais barato e não
 * alucina. As datas são sempre de Brasília, com o "agora" injetado.
 */

// Terça, 22/09/2026, 22h em Brasília.
const AGORA = new Date("2026-09-23T01:00:00.000Z");
const emBrasilia = (data: string, h: number, m = 0) => {
  const [a, mes, d] = data.split("-").map(Number);
  return new Date(Date.UTC(a, mes - 1, d, h + 3, m));
};

const HORARIOS = [
  { day: 0, open: "09:00", close: "19:00", closed: true },
  { day: 1, open: "09:00", close: "19:00", closed: false },
  { day: 2, open: "09:00", close: "19:00", closed: false },
  { day: 3, open: "09:00", close: "19:00", closed: false },
  { day: 4, open: "09:00", close: "19:00", closed: false },
  { day: 5, open: "09:00", close: "19:00", closed: false },
  { day: 6, open: "09:00", close: "14:00", closed: false },
];

describe("localDe — a hora de Brasília", () => {
  it("dia, dia da semana e minutos locais", () => {
    expect(localDe(AGORA)).toEqual({ data: "2026-09-22", diaDaSemana: 2, minutos: 22 * 60 });
  });
});

describe("lerPedidoDeDia", () => {
  it("hoje, amanhã e depois de amanhã", () => {
    expect(lerPedidoDeDia("tem horário hoje?", AGORA).dia).toBe("2026-09-22");
    expect(lerPedidoDeDia("tem horário amanhã?", AGORA).dia).toBe("2026-09-23");
    expect(lerPedidoDeDia("e depois de amanhã?", AGORA).dia).toBe("2026-09-24");
  });

  it("dia da semana é o próximo; o mesmo dia só se ainda for cedo", () => {
    expect(lerPedidoDeDia("sábado", AGORA).dia).toBe("2026-09-26");
    expect(lerPedidoDeDia("pode ser sexta-feira?", AGORA).dia).toBe("2026-09-25");
    expect(lerPedidoDeDia("terça", AGORA).dia).toBe("2026-09-29");
    expect(lerPedidoDeDia("terça", emBrasilia("2026-09-22", 10)).dia).toBe("2026-09-22");
  });

  it("dia do mês e data com barra", () => {
    expect(lerPedidoDeDia("dia 25", AGORA).dia).toBe("2026-09-25");
    expect(lerPedidoDeDia("dia 5", AGORA).dia).toBe("2026-10-05");
    expect(lerPedidoDeDia("25/09", AGORA).dia).toBe("2026-09-25");
    expect(lerPedidoDeDia("10/10", AGORA).dia).toBe("2026-10-10");
    expect(lerPedidoDeDia("01/01", AGORA).dia).toBe("2027-01-01");
  });

  it("período do dia, sem confundir com o cumprimento", () => {
    expect(lerPedidoDeDia("amanhã de manhã", AGORA).periodo).toBe("MANHA");
    expect(lerPedidoDeDia("sábado à tarde", AGORA).periodo).toBe("TARDE");
    expect(lerPedidoDeDia("quinta à noite", AGORA).periodo).toBe("NOITE");
    expect(lerPedidoDeDia("boa noite, tem horário?", AGORA).periodo).toBeUndefined();
  });

  it("a partir de uma hora", () => {
    expect(lerPedidoDeDia("depois das 18h", AGORA).aPartirDe).toBe(18 * 60);
    expect(lerPedidoDeDia("a partir das 14:30", AGORA).aPartirDe).toBe(14 * 60 + 30);
  });
});

describe("como o Atendente fala de hora e de dia", () => {
  it("hora falada", () => {
    expect(horaFalada(570)).toBe("9h30");
    expect(horaFalada(540)).toBe("9h");
    expect(horaFalada(840)).toBe("14h");
  });

  it("dia curto e data completa da confirmação", () => {
    expect(diaCurto("2026-09-23")).toBe("qua 23/09");
    expect(quandoFalado(emBrasilia("2026-09-23", 11))).toBe("quarta, 23/09, às 11h");
    expect(quandoFalado(emBrasilia("2026-09-26", 9, 30))).toBe("sábado, 26/09, às 9h30");
  });
});

describe("proximaAbertura e textoDaVolta — quando a equipe volta", () => {
  it("terça às 22h, a loja abre quarta às 9h", () => {
    const abre = proximaAbertura(HORARIOS, [], AGORA);
    expect(abre).toEqual(emBrasilia("2026-09-23", 9));
    expect(textoDaVolta(abre, AGORA)).toBe("amanhã às 9h");
  });

  it("sábado depois das 14h, só segunda", () => {
    const sabado = emBrasilia("2026-09-26", 15);
    const abre = proximaAbertura(HORARIOS, [], sabado);
    expect(abre).toEqual(emBrasilia("2026-09-28", 9));
    expect(textoDaVolta(abre, sabado)).toBe("segunda às 9h");
  });

  it("de madrugada, a abertura do mesmo dia é hoje", () => {
    const madrugada = emBrasilia("2026-09-23", 3);
    expect(textoDaVolta(proximaAbertura(HORARIOS, [], madrugada), madrugada)).toBe("hoje às 9h");
  });

  it("dia fechado pelo botão é pulado", () => {
    expect(proximaAbertura(HORARIOS, ["2026-09-23"], AGORA)).toEqual(emBrasilia("2026-09-24", 9));
  });

  it("sem abertura conhecida, nada é dito", () => {
    expect(textoDaVolta(null, AGORA)).toBeNull();
    const semana = HORARIOS.map((h) => ({ ...h, closed: true }));
    expect(proximaAbertura(semana, [], AGORA)).toBeNull();
  });
});

const CTX: ContextoDaIntencao = {
  servicos: [
    { id: "s1", nome: "Corte" },
    { id: "s2", nome: "Corte + Barba" },
    { id: "s3", nome: "Barba" },
  ],
  profissionais: ["Léo", "Diego"],
  palavrasDoDono: ["falar com o dono"],
  estado: null,
  agora: AGORA,
};

const tipo = (texto: string, ctx: Partial<ContextoDaIntencao> = {}) =>
  detectarIntencao(texto, { ...CTX, ...ctx }).tipo;

describe("detectarIntencao", () => {
  it("pedido de horário, com dia, período, serviço e profissional", () => {
    const i = detectarIntencao("tem horário amanhã?", CTX);
    expect(i.tipo).toBe("HORARIO");
    expect(i.pedido.dia).toBe("2026-09-23");

    const j = detectarIntencao("quero marcar corte e barba sábado de manhã", CTX);
    expect(j.tipo).toBe("HORARIO");
    expect(j.servicoId).toBe("s2");
    expect(j.pedido).toMatchObject({ dia: "2026-09-26", periodo: "MANHA" });

    expect(detectarIntencao("tem vaga com o Diego?", CTX).profissional).toBe("Diego");
    expect(tipo("dá pra cortar amanhã?")).toBe("HORARIO");
  });

  it("perguntar o horário de funcionamento não é pedir horário", () => {
    expect(tipo("qual o horário de vocês?")).toBe("FUNCIONAMENTO");
    expect(tipo("que horas abre amanhã?")).toBe("FUNCIONAMENTO");
    expect(tipo("vocês abrem domingo?")).toBe("FUNCIONAMENTO");
  });

  it("preço, endereço e pagamento", () => {
    const preco = detectarIntencao("quanto custa a barba?", CTX);
    expect(preco.tipo).toBe("PRECO");
    expect(preco.servicoId).toBe("s3");
    expect(tipo("qual o valor?")).toBe("PRECO");
    expect(tipo("onde fica?")).toBe("ENDERECO");
    expect(tipo("aceita pix?")).toBe("PAGAMENTO");
  });

  it("pedido de pessoa, com os termos de sempre e os do dono", () => {
    expect(tipo("quero falar com um atendente")).toBe("PESSOA");
    expect(tipo("posso falar com o dono?")).toBe("PESSOA");
    // "atendente virtual" é quem ele é, não um pedido de pessoa.
    expect(tipo("você é atendente virtual?")).not.toBe("PESSOA");
  });

  it("reclamação e desmarcar", () => {
    expect(tipo("péssimo atendimento, quero reclamar")).toBe("RECLAMACAO");
    expect(tipo("quero desmarcar meu horário de amanhã")).toBe("DESMARCAR");
  });

  it("urgência só com termo de saúde ou segurança", () => {
    expect(tipo("meu filho está sangrando")).toBe("URGENCIA");
    expect(tipo("preciso de um horário urgente")).toBe("HORARIO");
    const emocional = detectarIntencao("não aguento mais, penso em me matar", CTX);
    expect(emocional.tipo).toBe("URGENCIA");
    expect(emocional.emocional).toBe(true);
  });

  it("com três horários oferecidos, número e hora viram escolha", () => {
    const opcoes = [
      { n: 1, minutos: 570 },
      { n: 2, minutos: 660 },
      { n: 3, minutos: 1000 },
    ];
    const ctx = { estado: "HORARIO" as const, opcoes };
    expect(detectarIntencao("2", { ...CTX, ...ctx })).toMatchObject({ tipo: "ESCOLHA", escolha: 2 });
    expect(detectarIntencao("a 3", { ...CTX, ...ctx }).escolha).toBe(3);
    expect(detectarIntencao("o das 11", { ...CTX, ...ctx }).escolha).toBe(2);
    expect(detectarIntencao("16h40", { ...CTX, ...ctx }).escolha).toBe(3);
    expect(detectarIntencao("quero a primeira", { ...CTX, ...ctx }).escolha).toBe(1);
    // "segunda" sozinho é o dia da semana, não a segunda opção.
    expect(detectarIntencao("segunda", { ...CTX, ...ctx })).toMatchObject({ tipo: "HORARIO" });
  });

  it("com serviços oferecidos, o número ou o nome escolhem", () => {
    const ctx = { estado: "SERVICO" as const, opcoes: [{ n: 1, minutos: -1 }, { n: 2, minutos: -1 }, { n: 3, minutos: -1 }] };
    expect(detectarIntencao("1", { ...CTX, ...ctx })).toMatchObject({ tipo: "ESCOLHA", escolha: 1 });
    expect(detectarIntencao("barba", { ...CTX, ...ctx })).toMatchObject({ tipo: "ESCOLHA", escolha: 3 });
  });

  it("sim e não só contam depois de um convite", () => {
    expect(tipo("sim", { estado: "CONVITE" })).toBe("CONFIRMA");
    expect(tipo("pode ser", { estado: "CONVITE" })).toBe("CONFIRMA");
    expect(tipo("não, obrigado", { estado: "CONVITE" })).toBe("NEGA");
    expect(tipo("sim")).toBe("LIVRE");
  });

  it("saudação, agradecimento e o resto", () => {
    expect(tipo("oi")).toBe("SAUDACAO");
    expect(tipo("boa noite!")).toBe("SAUDACAO");
    expect(tipo("boa noite, tem horário amanhã?")).toBe("HORARIO");
    expect(tipo("obrigado!")).toBe("AGRADECIMENTO");
    expect(tipo("vocês fazem luzes?")).toBe("LIVRE");
  });
});

describe("lerEscolha", () => {
  const opcoes = [
    { n: 1, minutos: 570 },
    { n: 2, minutos: 660 },
  ];

  it("número fora das opções não é escolha", () => {
    expect(lerEscolha("7", opcoes)).toBeNull();
  });

  it("hora que não bate com nenhuma opção não é escolha", () => {
    expect(lerEscolha("às 15h", opcoes)).toBeNull();
  });
});
