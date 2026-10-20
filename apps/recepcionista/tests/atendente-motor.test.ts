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
  descricao: "",
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
  it("a primeira saudação se apresenta e abre espaço para a necessidade do cliente", async () => {
    const s = await responder(entrada("oi", { primeiraDoDia: true }), deps);
    expect(s.mensagens).toHaveLength(1);
    expect(s.mensagens[0]).toContain("Boa noite, Rafael!");
    expect(s.mensagens[0]).toContain("Eu sou Bia, atendente virtual da Barbearia do Léo");
    expect(s.mensagens[0]).toContain("Como posso ajudar?");
    expect(s.mensagens[0]).not.toMatch(/equipe volta|horários livres/);
    expect(s.estado).toBeNull();
    expect(s.usouIa).toBe(false);
  });

  it("a segunda do dia não se apresenta de novo", async () => {
    const s = await responder(entrada("oi"), deps);
    expect(s.mensagens.join(" ")).not.toContain("Eu sou Bia");
  });

  it("no expediente, não presume o que a equipe está fazendo", async () => {
    const s = await responder(entrada("oi", { primeiraDoDia: true, contexto: "EXPEDIENTE", agora: TERCA_10H }), deps);
    expect(s.mensagens[0]).toContain("Bom dia, Rafael!");
    expect(s.mensagens[0]).not.toContain("A equipe está no atendimento agora");
    expect(s.mensagens[0]).toContain("Como posso ajudar?");
  });
});

describe("pedido de horário", () => {
  it("com o serviço citado: três horários de verdade, com preço, duração e o número para marcar", async () => {
    const s = await responder(entrada("tem horário amanhã pra corte?", { primeiraDoDia: true }), deps);
    expect(s.mensagens).toHaveLength(1);
    const oferta = s.mensagens[0];
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
    expect(s.mensagens[0]).toContain("não está mais disponível");
    expect(s.estado?.tipo).toBe("HORARIO");
    expect(s.marcou).toBeUndefined();
    // A agenda falsa ainda devolve as 10h30 como livre: o motor tira mesmo assim.
    const tomado = emBrasilia("2026-09-23", 10, 30).toISOString();
    expect(s.estado?.tipo === "HORARIO" && s.estado.opcoes.map((o) => o.inicio)).not.toContain(tomado);
    expect(s.mensagens[0]).not.toContain("10h30");
  });

  it("com \"marcar direto\" desligado, envia o link direto para o cliente agendar online", async () => {
    const fatos = { ...FATOS, marcaDireto: false };
    const oferta = await responder(entrada("tem horário amanhã pra corte?", { fatos }), deps);
    expect(oferta.mensagens[0]).toContain("https://app.exemplo/agendar/barbearia-do-leo");
    expect(oferta.mensagens[0]).not.toContain("1 ·");
    expect(oferta.estado).toBeNull();
    expect(deps.marcar).not.toHaveBeenCalled();
  });

  it("sem link e sem marcar direto, a escolha vira anotação para a equipe confirmar", async () => {
    const fatos = { ...FATOS, marcaDireto: false, linkAgenda: null };
    const oferta = await responder(entrada("tem horário amanhã pra corte?", { fatos }), deps);
    expect(oferta.mensagens[0]).toContain("ainda precisa de confirmação da equipe");
    const s = await responder(entrada("1", { estado: oferta.estado, fatos }), deps);
    expect(s.mensagens[0]).toContain("Você escolheu quarta, 23/09, às 9h");
    expect(s.mensagens[0]).toContain("ainda precisa de confirmação");
    expect(deps.marcar).not.toHaveBeenCalled();
    expect(s.anotar).toBeDefined();
  });

  it("sem vaga nenhuma, avisa e anota para a equipe chamar", async () => {
    deps.livres.mockResolvedValueOnce([]);
    const s = await responder(entrada("tem horário amanhã pra corte?"), deps);
    expect(s.mensagens[0]).toContain("Não encontrei horário livre");
    expect(s.anotar).toBeDefined();
    expect(s.estado).toBeNull();
  });

  it("sem serviço cadastrado, não inventa serviço nem duração para reservar", async () => {
    const fatos = { ...FATOS, servicos: [] };
    const oferta = await responder(entrada("tem horário amanhã?", { fatos }), deps);
    expect(oferta.mensagens[0]).toContain("Não tenho essa informação confirmada");
    expect(oferta.mensagens[0]).not.toMatch(/Atendimento|30 min/);
    expect(oferta.estado).toBeNull();
    expect(deps.livres).not.toHaveBeenCalled();
    expect(deps.marcar).not.toHaveBeenCalled();
  });

  it("o \"sim\" depois do convite mostra os horários", async () => {
    const convite: EstadoDaConversa = { tipo: "CONVITE", criadoEm: AGORA.toISOString() };
    const fatos = { ...FATOS, servicos: [FATOS.servicos[0]] };
    const s = await responder(entrada("sim", { estado: convite, fatos }), deps);
    expect(s.mensagens[0]).toContain("Tenho estes horários para Corte");
  });
});

describe("preço, horário, endereço e pagamento — do cadastro, sem IA", () => {
  it("preço do serviço citado sem convite compulsório nem duração não solicitada", async () => {
    const s = await responder(entrada("quanto custa a barba?"), deps);
    expect(s.mensagens).toEqual(["Barba sai por R$ 35,00."]);
    expect(s.estado).toBeNull();
  });

  it("serviço sem preço: não inventa e anota", async () => {
    const s = await responder(entrada("quanto custa as luzes?"), deps);
    expect(s.mensagens[0]).toContain("Não tenho o valor de Luzes confirmado");
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

  it("dúvida ensinada sobre preço responde na hora com o valor ensinado", async () => {
    const fatos = {
      ...FATOS,
      perguntas: [
        { question: "Qual o preço do plano?", answer: "Nosso plano sai por R$ 740,00 por mês." },
      ],
    };
    const s = await responder(entrada("qual o preço?", { fatos }), deps);
    expect(s.mensagens[0]).toContain("740,00");
    expect(s.fontes[0]).toContain("Dúvida que você ensinou");
  });

  it("sinônimos de preço (quanto custa / qual o valor) acham a resposta ensinada", async () => {
    const fatos = {
      ...FATOS,
      perguntas: [
        { question: "Tabela de preços", answer: "O valor é 740 reais." },
      ],
    };
    const s1 = await responder(entrada("quanto custa?", { fatos }), deps);
    expect(s1.mensagens[0]).toContain("740 reais");

    const s2 = await responder(entrada("qual o valor?", { fatos }), deps);
    expect(s2.mensagens[0]).toContain("740 reais");
  });

  it("quando há serviço padrão sem preço e o dono ensinou preço nas perguntas, não diz que falta preço", async () => {
    const fatos = {
      ...FATOS,
      servicos: [{ id: "serv_default", nome: "Atendimento", precoCents: 0, duracaoMin: 30 }],
      perguntas: [
        { question: "Qual o valor cobrado?", answer: "Trabalhamos com o plano de R$ 740,00." },
      ],
    };
    const s = await responder(entrada("qual o preço", { fatos }), deps);
    expect(s.mensagens[0]).toContain("740,00");
    expect(s.mensagens[0]).not.toContain("O valor de Atendimento eu não tenho confirmado");
  });
});

describe("pessoa, reclamação e urgência — texto fixo, anotação e a conversa passa para a equipe", () => {
  it("pedido de pessoa informa a abertura sem prometer resposta nesse horário", async () => {
    const s = await responder(entrada("quero falar com um atendente"), deps);
    expect(s.mensagens[0]).toContain("A próxima abertura é amanhã às 9h");
    expect(s.mensagens[0]).toContain("não tenho um prazo de resposta confirmado");
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

  it("desmarcar requer equipe e não confirma alteração inexistente", async () => {
    const s = await responder(entrada("quero desmarcar meu horário de amanhã"), deps);
    expect(s.anotar?.motivo).toMatch(/desmarcar/i);
    expect(s.equipe).toBe(true);
    expect(s.mensagens[0]).toContain("ainda não significa que o horário foi cancelado ou alterado");
    expect(deps.marcar).not.toHaveBeenCalled();
  });

  it("dúvida sem resposta é anotada sem tirar o Atendente da conversa", async () => {
    const s = await responder(entrada("onde fica?", { fatos: { ...FATOS, endereco: "" } }), deps);
    expect(s.equipe).toBeUndefined();
  });
});

describe("pergunta livre — a IA seleciona fontes, o motor usa o cadastro", () => {
  it("usa o texto da fonte autorizada em vez da redação livre do modelo", async () => {
    deps.ia.mockResolvedValueOnce({
      resposta: "Temos estacionamento conveniado na rua de trás.",
      transferir_humano: false,
      motivo_transferencia: "",
      nome_cliente: "",
      interesse: "",
      fontes_ids: ["faq:0"],
      duvida_pendente: false,
    });
    const s = await responder(entrada("tem onde parar o carro?", { primeiraDoDia: true }), deps);
    expect(s.mensagens).toEqual(["Sim, conveniado na rua de trás."]);
    expect(s.usouIa).toBe(true);
    const prompt = deps.ia.mock.calls[0][0].systemPrompt as string;
    expect(prompt).toContain('"id":"servico:s1:preco"');
    expect(prompt).toContain("Corte custa R$ 45,00.");
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
    expect(s.mensagens[0]).toContain("Não tenho essa informação confirmada");
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
    expect(s.anotar).toMatchObject({ motivo: "A resposta não indicou fontes autorizadas", pergunta: "vocês fazem progressiva?" });
    expect(s.mensagens.join(" ")).not.toContain("deixei anotado");
  });

  it("se a IA falhar, a resposta segura sai e a pergunta fica anotada", async () => {
    deps.ia.mockRejectedValueOnce(new Error("fora do ar"));
    const s = await responder(entrada("vocês fazem progressiva?"), deps);
    expect(s.mensagens[0]).toContain("Não tenho essa informação confirmada");
    expect(s.anotar?.pergunta).toBe("vocês fazem progressiva?");
  });
});
