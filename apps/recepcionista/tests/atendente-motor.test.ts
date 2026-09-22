import { beforeEach, describe, expect, it, vi, type Mock } from "vitest";
import type { Livre } from "@/lib/agenda/livres";
import type { ResultadoDaMarcacao } from "@/lib/agenda/marcacao";
import type { HistoryMessage, ReceptionistReply } from "@/lib/ai/provider";
import type { Fatos } from "@/lib/atendente/fatos";
import {
  responder,
  type EntradaDoMotor,
  type PedidoDeLivres,
  type PedidoDeMarcacaoDoMotor,
} from "@/lib/atendente/motor";
import type { EstadoDaConversa } from "@/lib/atendente/oferta";

/**
 * O MOTOR DO ATENDENTE — O MESMO NO WHATSAPP E NO SIMULADOR.
 *
 * As conversas abaixo usam dependências falsas: a agenda devolve uma grade
 * fixa, a marcação responde o que o teste mandar e a IA é um espião. Assim cada
 * regra é conferida sem banco, sem WhatsApp e sem modelo.
 */

const emBrasilia = (data: string, h: number, m = 0) => {
  const [a, mes, d] = data.split("-").map(Number);
  return new Date(Date.UTC(a, mes - 1, d, h + 3, m));
};

// Terça, 22/09/2026, 22h em Brasília: loja fechada.
const AGORA = emBrasilia("2026-09-22", 22);
const TERCA_10H = emBrasilia("2026-09-22", 10);

const FATOS: Fatos = {
  empresa: "Barbearia do Léo",
  nome: "Bia",
  jeito: "ACOLHEDOR",
  marcaDireto: true,
  expediente: true,
  servicos: [
    { id: "s1", nome: "Corte", precoCents: 4500, duracaoMin: 40 },
    { id: "s2", nome: "Barba", precoCents: 3500, duracaoMin: 30 },
    { id: "s3", nome: "Luzes", precoCents: 0, duracaoMin: 90 },
  ],
  profissionais: ["Léo"],
  horarios: [
    { day: 0, open: "09:00", close: "19:00", closed: true },
    { day: 1, open: "09:00", close: "19:00", closed: false },
    { day: 2, open: "09:00", close: "19:00", closed: false },
    { day: 3, open: "09:00", close: "19:00", closed: false },
    { day: 4, open: "09:00", close: "19:00", closed: false },
    { day: 5, open: "09:00", close: "19:00", closed: false },
    { day: 6, open: "09:00", close: "14:00", closed: false },
  ],
  diasFechados: [],
  endereco: "Rua das Flores, 100",
  pagamento: "Pix e cartão",
  perguntas: [{ question: "Tem estacionamento?", answer: "Sim, conveniado na rua de trás." }],
  linkAgenda: "https://app.exemplo/agendar/barbearia-do-leo",
};

/** Grade das 9h às 18h30, de meia em meia hora, com o Léo, nos dias pedidos. */
function grade(dias: string[]): Livre[] {
  return dias
    .filter((d) => d !== "2026-09-22")
    .flatMap((dia) =>
      Array.from({ length: 20 }, (_, i) => {
        const inicio = emBrasilia(dia, 9, i * 30);
        return { inicio, fim: new Date(inicio.getTime() + 40 * 60_000), profissional: "Léo" };
      }),
    );
}

type PedidoDaIa = { systemPrompt: string; historico: HistoryMessage[] };

let deps: {
  livres: Mock<[PedidoDeLivres], Promise<Livre[]>>;
  marcar: Mock<[PedidoDeMarcacaoDoMotor], Promise<ResultadoDaMarcacao>>;
  ia: Mock<[PedidoDaIa], Promise<ReceptionistReply>>;
};

beforeEach(() => {
  deps = {
    livres: vi.fn(async ({ dias }: PedidoDeLivres) => grade(dias)),
    marcar: vi.fn(
      async ({ inicio, profissional }: PedidoDeMarcacaoDoMotor): Promise<ResultadoDaMarcacao> => ({
        ok: true,
        profissional: profissional ?? "Léo",
        inicio,
        fim: new Date(inicio.getTime() + 40 * 60_000),
        appointmentId: "ag1",
        clienteId: "cli1",
      }),
    ),
    ia: vi.fn<[PedidoDaIa], Promise<ReceptionistReply>>(),
  };
});

const entrada = (texto: string, p: Partial<EntradaDoMotor> = {}): EntradaDoMotor => ({
  texto,
  historico: [{ role: "CUSTOMER", content: texto }],
  estado: null,
  primeiraDoDia: false,
  clienteNome: "Rafael",
  telefone: "5511988887777",
  fatos: FATOS,
  agora: AGORA,
  contexto: "FECHADO",
  palavrasDoDono: [],
  ...p,
});

describe("saudação e apresentação", () => {
  it("a primeira do dia se apresenta, diz quando a equipe volta e convida", async () => {
    const s = await responder(entrada("oi", { primeiraDoDia: true }), deps);
    expect(s.mensagens).toHaveLength(1);
    expect(s.mensagens[0]).toContain("Boa noite, Rafael!");
    expect(s.mensagens[0]).toContain("Eu sou Bia, atendente virtual da Barbearia do Léo");
    expect(s.mensagens[0]).toContain("A equipe volta amanhã às 9h");
    expect(s.mensagens[0]).toContain("Quer que eu te mostre os horários livres?");
    expect(s.estado?.tipo).toBe("CONVITE");
    expect(s.usouIa).toBe(false);
  });

  it("a segunda do dia não se apresenta de novo", async () => {
    const s = await responder(entrada("oi"), deps);
    expect(s.mensagens.join(" ")).not.toContain("Eu sou Bia");
  });

  it("no expediente, diz que a equipe está atendendo", async () => {
    const s = await responder(entrada("oi", { primeiraDoDia: true, contexto: "EXPEDIENTE", agora: TERCA_10H }), deps);
    expect(s.mensagens[0]).toContain("Bom dia, Rafael!");
    expect(s.mensagens[0]).toContain("A equipe está no atendimento agora");
  });
});

describe("pedido de horário", () => {
  it("com o serviço citado: três horários de verdade, com preço, duração e o número para marcar", async () => {
    const s = await responder(entrada("tem horário amanhã pra corte?", { primeiraDoDia: true }), deps);
    expect(s.mensagens).toHaveLength(2);
    expect(s.mensagens[0]).toContain("Eu sou Bia");
    const oferta = s.mensagens[1];
    expect(oferta).toContain("Tenho estes horários para Corte (R$ 45,00, 40 min) amanhã:");
    expect(oferta).toContain("1 · qua 23/09, 9h com Léo");
    expect(oferta).toContain("2 · qua 23/09, 10h30 com Léo");
    expect(oferta).toContain("3 · qua 23/09, 12h com Léo");
    expect(oferta).toContain("É só responder com o número");
    expect(s.estado?.tipo).toBe("HORARIO");
    expect(deps.livres.mock.calls[0][0].servico).toMatchObject({ id: "s1", duracaoMin: 40 });
    expect(deps.ia).not.toHaveBeenCalled();
  });

  it("com vários serviços e nenhum citado, pergunta qual — e a escolha segue para os horários", async () => {
    const s = await responder(entrada("tem horário amanhã?"), deps);
    expect(s.mensagens[0]).toContain("Qual desses você quer?");
    expect(s.mensagens[0]).toContain("1 · Corte (R$ 45,00)");
    expect(s.mensagens[0]).toContain("3 · Luzes");
    expect(s.estado?.tipo).toBe("SERVICO");

    const depois = await responder(entrada("2", { estado: s.estado }), deps);
    expect(depois.mensagens[0]).toContain("Tenho estes horários para Barba (R$ 35,00, 30 min) amanhã:");
    expect(depois.estado?.tipo).toBe("HORARIO");
  });

  it("o \"2\" marca na agenda, sem passar pela IA", async () => {
    const oferta = await responder(entrada("tem horário amanhã pra corte?"), deps);
    const s = await responder(entrada("2", { estado: oferta.estado }), deps);
    expect(deps.marcar).toHaveBeenCalledTimes(1);
    const pedido = deps.marcar.mock.calls[0][0];
    expect(pedido.inicio).toEqual(emBrasilia("2026-09-23", 10, 30));
    expect(pedido.profissional).toBe("Léo");
    expect(pedido.cliente).toEqual({ nome: "Rafael", telefone: "5511988887777" });
    expect(s.mensagens[0]).toContain("Quarta, 23/09, às 10h30");
    expect(s.mensagens[0]).toContain("Já está na agenda");
    expect(s.marcou).toMatchObject({ valorCents: 4500, appointmentId: "ag1" });
    expect(s.estado).toBeNull();
    expect(deps.ia).not.toHaveBeenCalled();
  });

  it("horário ocupado no meio: avisa e oferece os próximos três", async () => {
    const oferta = await responder(entrada("tem horário amanhã pra corte?"), deps);
    deps.marcar.mockResolvedValueOnce({ ok: false, motivo: "OCUPADO" });
    const s = await responder(entrada("2", { estado: oferta.estado }), deps);
    expect(s.mensagens[0]).toContain("acabou de ser ocupado");
    expect(s.estado?.tipo).toBe("HORARIO");
    expect(s.marcou).toBeUndefined();
    // A agenda falsa ainda devolve as 10h30 como livre: o motor tira mesmo assim.
    const tomado = emBrasilia("2026-09-23", 10, 30).toISOString();
    expect(s.estado?.tipo === "HORARIO" && s.estado.opcoes.map((o) => o.inicio)).not.toContain(tomado);
    expect(s.mensagens[0]).not.toContain("10h30");
  });

  it("com \"marcar direto\" desligado, mostra os horários com o link e não marca", async () => {
    const fatos = { ...FATOS, marcaDireto: false };
    const oferta = await responder(entrada("tem horário amanhã pra corte?", { fatos }), deps);
    expect(oferta.mensagens[0]).toContain("https://app.exemplo/agendar/barbearia-do-leo");
    const s = await responder(entrada("2", { estado: oferta.estado, fatos }), deps);
    expect(deps.marcar).not.toHaveBeenCalled();
    expect(s.anotar?.motivo).toContain("Corte");
  });

  it("sem link e sem marcar direto, a escolha vira anotação para a equipe confirmar", async () => {
    const fatos = { ...FATOS, marcaDireto: false, linkAgenda: null };
    const oferta = await responder(entrada("tem horário amanhã pra corte?", { fatos }), deps);
    expect(oferta.mensagens[0]).toContain("deixo anotado para a equipe confirmar");
    const s = await responder(entrada("1", { estado: oferta.estado, fatos }), deps);
    expect(s.mensagens[0]).toContain("Anotei: quarta, 23/09, às 9h");
    expect(s.anotar).toBeDefined();
  });

  it("sem vaga nenhuma, avisa e anota para a equipe chamar", async () => {
    deps.livres.mockResolvedValueOnce([]);
    const s = await responder(entrada("tem horário amanhã pra corte?"), deps);
    expect(s.mensagens[0]).toContain("Não encontrei horário livre");
    expect(s.anotar).toBeDefined();
    expect(s.estado).toBeNull();
  });

  // Sem serviço, o horário é de 30 minutos — mas o cliente não lê um serviço
  // que o dono nunca cadastrou ("horários para Atendimento").
  it("sem serviço cadastrado, oferece horários sem inventar nome de serviço", async () => {
    const fatos = { ...FATOS, servicos: [] };
    const oferta = await responder(entrada("tem horário amanhã?", { fatos }), deps);
    expect(oferta.mensagens[0]).toContain("Tenho estes horários amanhã:");
    expect(oferta.mensagens[0]).not.toMatch(/Atendimento|30 min/);
    expect(deps.livres.mock.calls[0][0].servico.duracaoMin).toBe(30);

    const s = await responder(entrada("2", { estado: oferta.estado, fatos }), deps);
    expect(s.mensagens[0]).toContain("Prontinho! Quarta, 23/09, às 10h30 com Léo.");
    expect(s.mensagens[0]).not.toContain("Atendimento");
  });

  it("o \"sim\" depois do convite mostra os horários", async () => {
    const convite: EstadoDaConversa = { tipo: "CONVITE", criadoEm: AGORA.toISOString() };
    const fatos = { ...FATOS, servicos: [FATOS.servicos[0]] };
    const s = await responder(entrada("sim", { estado: convite, fatos }), deps);
    expect(s.mensagens[0]).toContain("Tenho estes horários para Corte");
  });
});

describe("preço, horário, endereço e pagamento — do cadastro, sem IA", () => {
  it("preço do serviço citado, com o convite", async () => {
    const s = await responder(entrada("quanto custa a barba?"), deps);
    expect(s.mensagens[0]).toContain("Barba sai por R$ 35,00 e leva 30 min.");
    expect(s.mensagens[0]).toContain("horários livres");
    expect(s.estado?.tipo).toBe("CONVITE");
  });

  it("serviço sem preço: não inventa e anota", async () => {
    const s = await responder(entrada("quanto custa as luzes?"), deps);
    expect(s.mensagens[0]).toContain("O valor de Luzes eu não tenho confirmado");
    expect(s.anotar).toBeDefined();
  });

  it("horário de funcionamento falado", async () => {
    const s = await responder(entrada("qual o horário de vocês?"), deps);
    expect(s.mensagens[0]).toContain("seg a sex das 9h às 19h; sáb das 9h às 14h; dom fechado");
  });

  it("endereço e pagamento", async () => {
    expect((await responder(entrada("onde fica?"), deps)).mensagens[0]).toContain("Rua das Flores, 100");
    expect((await responder(entrada("aceita pix?"), deps)).mensagens[0]).toContain("Pix e cartão");
  });

  it("sem endereço cadastrado, diz que não tem e anota", async () => {
    const s = await responder(entrada("onde fica?", { fatos: { ...FATOS, endereco: "" } }), deps);
    expect(s.mensagens[0]).toContain("não tenho confirmada");
    expect(s.anotar).toBeDefined();
  });
});

describe("pessoa, reclamação e urgência — texto fixo, anotação e a conversa passa para a equipe", () => {
  it("pedido de pessoa diz quando a equipe volta", async () => {
    const s = await responder(entrada("quero falar com um atendente"), deps);
    expect(s.mensagens[0]).toContain("A equipe volta amanhã às 9h");
    expect(s.anotar?.motivo).toMatch(/falar com alguém/i);
    expect(s.equipe).toBe(true);
  });

  it("reclamação é acolhida e anotada", async () => {
    const s = await responder(entrada("péssimo atendimento, quero reclamar"), deps);
    expect(s.mensagens[0]).toContain("Sinto muito");
    expect(s.anotar?.motivo).toMatch(/Reclamação/);
    expect(s.equipe).toBe(true);
  });

  it("urgência vem antes de tudo, mesmo na primeira do dia", async () => {
    const s = await responder(entrada("meu filho está sangrando", { primeiraDoDia: true }), deps);
    expect(s.mensagens).toHaveLength(1);
    expect(s.mensagens[0]).toContain("192");
    expect(s.urgente).toBe(true);
    expect(s.anotar).toBeDefined();
    expect(s.equipe).toBe(true);
  });

  // Quem quer remarcar ainda pode pedir horário novo: o Atendente continua ajudando.
  it("desmarcar é anotado, e o Atendente segue na conversa", async () => {
    const s = await responder(entrada("quero desmarcar meu horário de amanhã"), deps);
    expect(s.anotar?.motivo).toMatch(/desmarcar/i);
    expect(s.equipe).toBeUndefined();
  });

  it("dúvida sem resposta é anotada sem tirar o Atendente da conversa", async () => {
    const s = await responder(entrada("onde fica?", { fatos: { ...FATOS, endereco: "" } }), deps);
    expect(s.equipe).toBeUndefined();
  });
});

describe("pergunta livre — a IA escreve, o verificador confere", () => {
  it("resposta com fatos do cadastro sai como veio", async () => {
    deps.ia.mockResolvedValueOnce({
      resposta: "Temos estacionamento conveniado na rua de trás.",
      transferir_humano: false,
      motivo_transferencia: "",
      nome_cliente: "",
      interesse: "",
    });
    const s = await responder(entrada("tem onde parar o carro?", { primeiraDoDia: true }), deps);
    expect(s.mensagens).toEqual([expect.stringContaining("Eu sou Bia"), "Temos estacionamento conveniado na rua de trás."]);
    expect(s.usouIa).toBe(true);
    const prompt = deps.ia.mock.calls[0][0].systemPrompt as string;
    expect(prompt).toContain("Corte — R$ 45,00, 40 min");
    expect(prompt).toContain("atendente virtual");
  });

  it("número inventado derruba a resposta: sai a resposta segura e a anotação", async () => {
    deps.ia.mockResolvedValueOnce({
      resposta: "Fazemos sim, sai por R$ 80,00.",
      transferir_humano: false,
      motivo_transferencia: "",
      nome_cliente: "",
      interesse: "",
    });
    const s = await responder(entrada("vocês fazem progressiva?"), deps);
    expect(s.mensagens.join(" ")).not.toContain("R$ 80");
    expect(s.mensagens[0]).toContain("não tenho confirmada");
    expect(s.anotar?.pergunta).toBe("vocês fazem progressiva?");
  });

  it("quando a IA pede a equipe, anota a pergunta", async () => {
    deps.ia.mockResolvedValueOnce({
      resposta: "Não tenho essa informação confirmada aqui, mas deixei anotado para a equipe.",
      transferir_humano: true,
      motivo_transferencia: "Pergunta fora do cadastro",
      nome_cliente: "",
      interesse: "",
    });
    const s = await responder(entrada("vocês fazem progressiva?"), deps);
    expect(s.anotar).toMatchObject({ motivo: "Pergunta fora do cadastro", pergunta: "vocês fazem progressiva?" });
  });

  it("se a IA falhar, a resposta segura sai e a pergunta fica anotada", async () => {
    deps.ia.mockRejectedValueOnce(new Error("fora do ar"));
    const s = await responder(entrada("vocês fazem progressiva?"), deps);
    expect(s.mensagens[0]).toContain("não tenho confirmada");
    expect(s.anotar?.pergunta).toBe("vocês fazem progressiva?");
  });
});
