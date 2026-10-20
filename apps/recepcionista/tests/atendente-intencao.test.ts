import { describe, expect, it } from "vitest";
import {
  diaCurto,
  diaFalado,
  horaFalada,
  horarioFalado,
  lerPedidoDeDia,
  localDe,
  proximaAbertura,
  quandoFalado,
  textoDaVolta,
} from "@/lib/atendente/datas";
import { acharServicos, detectarIntencao, detectarIntencoes, lerEscolha, type ContextoDaIntencao } from "@/lib/atendente/intencao";

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

describe("diaFalado e horarioFalado", () => {
  it("o dia pedido como o cliente fala", () => {
    expect(diaFalado("2026-09-22", AGORA)).toBe("hoje");
    expect(diaFalado("2026-09-23", AGORA)).toBe("amanhã");
    expect(diaFalado("2026-09-26", AGORA)).toBe("sábado, 26/09");
  });

  it("a semana de funcionamento falada, com os dias iguais juntos", () => {
    expect(horarioFalado(HORARIOS)).toBe("seg a sex das 9h às 19h; sáb das 9h às 14h; dom fechado");
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

describe("compreensão profissional com contexto", () => {
  it.each(["Você é uma IA?", "Você é humano?", "Você é um robô?", "Estou falando com uma pessoa?"])("responde à identidade sem encaminhar: %s", (texto) => {
    expect(tipo(texto)).toBe("IDENTIDADE");
  });

  it("duração não é preço nem escolha de horário", () => {
    expect(tipo("Quanto tempo dura a barba?")).toBe("DURACAO");
    expect(tipo("Quanto dura a opção 2?", { estado: "HORARIO", opcoes: [{ n: 2, minutos: 660 }] })).toBe("DURACAO");
    expect(tipo("Vocês aceitam crianças?")).toBe("LIVRE");
  });

  it("resolve referência apenas ao serviço mencionado pelo cliente", () => {
    const historico = [
      { role: "CUSTOMER", content: "Queria fazer barba" },
      { role: "AI", content: "O corte custa R$ 999." },
      { role: "CUSTOMER", content: "E quanto custa?" },
    ];
    expect(detectarIntencao("E quanto custa?", { ...CTX, historico }).servicoId).toBe("s3");
    expect(detectarIntencao("Quanto custa esse serviço?", { ...CTX, historico: [historico[1]] }).servicoId).toBeUndefined();
    expect(detectarIntencao("Quanto tempo demora?", { ...CTX, historico: [
      { role: "CUSTOMER", content: "Quanto custa corte?" },
      { role: "AI", content: "O corte sai por R$ 45." },
    ] }).servicoId).toBe("s1");
  });

  it("não atribui referência ambígua, assunto abandonado ou serviço desconhecido ao anterior", () => {
    const historico = [{ role: "CUSTOMER", content: "Quanto custa corte e quanto custa barba?" }];
    expect(detectarIntencao("Quanto dura esse serviço?", { ...CTX, historico }).servicoId).toBeUndefined();
    expect(detectarIntencao("Quanto custa?", { ...CTX, historico: [
      { role: "CUSTOMER", content: "quero corte" },
      { role: "CUSTOMER", content: "esquece, outro assunto" },
    ] }).servicoId).toBeUndefined();
    expect(detectarIntencao("Quanto custa luzes?", { ...CTX, servicoAtualId: "s1" }).servicoId).toBeUndefined();
    expect(detectarIntencao("Quanto custa?", { ...CTX, servicoAtualId: "s1", historico: [
      { role: "CUSTOMER", content: "quero corte" },
      { role: "CUSTOMER", content: "e depilação?" },
    ] }).servicoId).toBeUndefined();
  });

  it("usa serviço escolhido confiável e dá preferência à correção atual", () => {
    expect(detectarIntencao("Quanto dura esse serviço?", { ...CTX, servicoAtualId: "s1" }).servicoId).toBe("s1");
    expect(detectarIntencao("Não quero corte, quero barba", { ...CTX, servicoAtualId: "s1" }).servicoId).toBe("s3");
    expect(detectarIntencao("Corte, na verdade barba", CTX).servicoId).toBe("s3");
    expect(detectarIntencao("Quero barba em vez de corte", CTX).servicoId).toBe("s3");
    expect(detectarIntencao("Não quero corte e sim barba", CTX).servicoId).toBe("s3");
    expect(detectarIntencao("Quero barba, não corte", CTX).servicoId).toBe("s3");
  });

  it("uma troca recente do cliente supera oferta antiga, mas respeita nova escolha numérica", () => {
    const historico = [
      { role: "CUSTOMER", content: "quero corte" },
      { role: "AI", content: "Tenho horários para corte." },
      { role: "CUSTOMER", content: "Quanto custa barba?" },
      { role: "AI", content: "Barba sai por R$ 35." },
    ];
    expect(detectarIntencao("Quanto tempo demora?", { ...CTX, servicoAtualId: "s1", historico }).servicoId).toBe("s3");
    expect(detectarIntencao("Quanto tempo demora?", { ...CTX, servicoAtualId: "s1", historico: [
      ...historico, { role: "CUSTOMER", content: "1" },
    ] }).servicoId).toBe("s1");
    expect(detectarIntencao("Quanto tempo demora?", { ...CTX, servicoAtualId: "s1", historico: [
      ...historico, { role: "CUSTOMER", content: "Esquece, não quero mais" },
    ] }).servicoId).toBeUndefined();
  });

  it("corrige dia sem somar o dia rejeitado ao pedido", () => {
    expect(detectarIntencao("quinta não, sexta à tarde", CTX).pedido).toMatchObject({ dia: "2026-09-25", periodo: "TARDE" });
    expect(detectarIntencao("não amanhã, sábado", CTX).pedido.dia).toBe("2026-09-26");
    expect(tipo("quinta não, sexta à tarde")).toBe("HORARIO");
  });

  it("não escolhe variação de serviço por ordem de cadastro", () => {
    const servicos = [{ id: "a", nome: "Corte masculino" }, { id: "b", nome: "Corte feminino" }];
    expect(acharServicos("quanto custa corte?", servicos)).toEqual([]);
    expect(acharServicos("quanto custa corte feminino?", servicos)).toEqual(["b"]);
    expect(acharServicos("quanto custa a cortesia?", CTX.servicos)).toEqual([]);
    expect(acharServicos("quero cortar", CTX.servicos)).toEqual(["s1"]);
    expect(acharServicos("quanto custa massagem 60?", [
      { id: "m30", nome: "Massagem 30" }, { id: "m60", nome: "Massagem 60" },
    ])).toEqual(["m60"]);
  });

  it("perguntar o preço durante uma oferta não confirma nem recusa a operação", () => {
    expect(tipo("2, quanto custa?", { estado: "HORARIO", opcoes: [{ n: 2, minutos: 660 }] })).toBe("PRECO");
    expect(tipo("Não, qual o preço?", { estado: "CONVITE" })).toBe("PRECO");
    expect(tipo("Não quero agendar agora, qual o preço do corte?")).toBe("PRECO");
  });

  it("pergunta não reconhecida e recusa não confirmam escolha", () => {
    const ctx = { estado: "HORARIO" as const, opcoes: [{ n: 1, minutos: 600 }, { n: 2, minutos: 660 }] };
    expect(tipo("2, tem estacionamento?", ctx)).not.toBe("ESCOLHA");
    expect(tipo("2, estacionamento?", ctx)).not.toBe("ESCOLHA");
    expect(tipo("Não quero a primeira", ctx)).toBe("NEGA");
  });
});

describe("perguntas compostas", () => {
  it("preserva texto original da pergunta única para registrar a pendência", () => {
    expect(detectarIntencoes("Tem estacionamento?", CTX)[0].texto).toBe("Tem estacionamento?");
  });

  it("separa três perguntas mesmo com vírgula, sem trocar funcionamento por agenda", () => {
    const intencoes = detectarIntencoes("Quanto é o corte, que horas vocês abrem amanhã e aceita cartão?", CTX);
    expect(intencoes.map((i) => i.tipo)).toEqual(["PRECO", "FUNCIONAMENTO", "PAGAMENTO"]);
    expect(intencoes[0].servicoId).toBe("s1");
    expect(intencoes[1].pedido.dia).toBe("2026-09-23");
  });
  it("preserva preço, duração e pergunta desconhecida com seu texto", () => {
    const intencoes = detectarIntencoes("Quanto custa corte? E quanto dura? E tem estacionamento?", CTX);
    expect(intencoes.map((i) => i.tipo)).toEqual(["PRECO", "DURACAO", "LIVRE"]);
    expect(intencoes[0].servicoId).toBe("s1");
    expect(intencoes[1].servicoId).toBe("s1");
    expect(intencoes[2].texto).toBe("tem estacionamento");
  });

  it("mantém o serviço de cada pergunta e não confunde duas perguntas com combo", () => {
    const intencoes = detectarIntencoes("Quanto custa corte e quanto custa barba?", CTX);
    expect(intencoes.map((i) => [i.tipo, i.servicoId])).toEqual([["PRECO", "s1"], ["PRECO", "s3"]]);
    expect(detectarIntencoes("Quanto custa corte e barba?", CTX)[0].servicoId).toBe("s2");
    expect(detectarIntencoes("Aceita Pix e cartão?", CTX)).toHaveLength(1);
  });

  it("preço e disponibilidade permanecem juntos sem confirmar uma reserva", () => {
    const intencoes = detectarIntencoes("Quanto custa corte e tem vaga amanhã?", CTX);
    expect(intencoes.map((i) => i.tipo)).toEqual(["PRECO", "HORARIO"]);
    expect(intencoes[1].pedido.dia).toBe("2026-09-23");
    expect(intencoes[1].servicoId).toBe("s1");
    expect(detectarIntencoes("Quanto custa corte e tem vaga para luzes amanhã?", CTX)[1].servicoId).toBeUndefined();
    expect(detectarIntencoes("Quanto custa barba e tem vaga amanhã?", { ...CTX,
      servicoAtualId: "s1", historico: [{ role: "CUSTOMER", content: "quero corte" }],
    })[1].servicoId).toBe("s3");
    expect(detectarIntencoes("Quanto custa corte? E tem depilação? Quanto dura?", CTX)[2].servicoId).toBeUndefined();
  });

  it("urgência e pedido de pessoa mantêm precedência", () => {
    expect(detectarIntencoes("Quanto custa corte? Meu filho está sangrando", CTX).map((i) => i.tipo)).toEqual(["URGENCIA"]);
    expect(detectarIntencoes("Você é uma IA? Quero falar com uma pessoa", CTX).map((i) => i.tipo)).toEqual(["PESSOA"]);
  });
});
