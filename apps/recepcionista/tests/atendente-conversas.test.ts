import { describe, expect, it, vi } from "vitest";
import type { Fatos } from "@/lib/atendente/fatos";
import { responder, type DependenciasDoMotor, type EntradaDoMotor } from "@/lib/atendente/motor";
import { catalogoDeRespostas, validarSelecaoDeFontes } from "@/lib/atendente/conhecimento";
import { textoDeMidiaNaoInterpretada } from "@/lib/whatsapp/midia";

// Todos os dados deste arquivo são cenários fictícios; nenhuma operação externa é chamada.
const fatos: Fatos = {
  empresa: "Barbearia Exemplo", nome: "Bia", jeito: "ACOLHEDOR", marcaDireto: true, expediente: true,
  servicos: [
    { id: "corte", nome: "Corte", precoCents: 4500, duracaoMin: 40 },
    { id: "barba", nome: "Barba", precoCents: 3500, duracaoMin: 30 },
  ],
  profissionais: [], horarios: [{ day: 3, open: "09:00", close: "19:00", closed: false }], diasFechados: [],
  endereco: "Rua Exemplo, 100", pagamento: "Pix e cartão de crédito", descricao: "",
  perguntas: [{ question: "Tem estacionamento?", answer: "Não temos estacionamento próprio." }], linkAgenda: null,
};
const entrada = (texto: string, extra: Partial<EntradaDoMotor> = {}): EntradaDoMotor => ({
  texto, fatos, estado: null, historico: [{ role: "CUSTOMER", content: texto }], primeiraDoDia: false,
  clienteNome: null, telefone: "5511999990000", agora: new Date("2026-09-22T15:00:00-03:00"),
  contexto: "EXPEDIENTE", palavrasDoDono: [], ...extra,
});
function dependencias() {
  const deps = {
    livres: vi.fn<Parameters<DependenciasDoMotor["livres"]>, ReturnType<DependenciasDoMotor["livres"]>>()
      .mockResolvedValue([{ inicio: new Date("2026-09-23T12:00:00Z"), fim: new Date("2026-09-23T12:40:00Z"), profissional: null }]),
    marcar: vi.fn<Parameters<DependenciasDoMotor["marcar"]>, ReturnType<DependenciasDoMotor["marcar"]>>()
      .mockResolvedValue({ ok: false, motivo: "RESULTADO_DESCONHECIDO" }),
    ia: vi.fn<Parameters<DependenciasDoMotor["ia"]>, ReturnType<DependenciasDoMotor["ia"]>>()
      .mockResolvedValue({ resposta: "Texto livre nunca autorizado", transferir_humano: false,
        motivo_transferencia: "", nome_cliente: "", interesse: "", fontes_ids: [], duvida_pendente: true }),
  };
  return deps;
}

describe("conversas profissionais completas", () => {
  it("responde três perguntas sem criar uma oferta de agendamento", async () => {
    const deps = dependencias();
    const s = await responder(entrada("Quanto é o corte, que horas vocês abrem amanhã e aceita cartão?"), deps);
    expect(s.mensagens).toHaveLength(1);
    expect(s.mensagens[0]).toContain("Corte sai por R$ 45,00.");
    expect(s.mensagens[0]).toContain("09:00 às 19:00");
    expect(s.mensagens[0]).toContain("Pix e cartão de crédito");
    expect(s.mensagens[0]).not.toMatch(/débito|quer.*horário|horários livres/i);
    expect(deps.livres).not.toHaveBeenCalled();
    expect(deps.ia).not.toHaveBeenCalled();
  });

  it("preço seguido de duração recupera o serviço citado pelo cliente", async () => {
    const deps = dependencias();
    const s1 = await responder(entrada("Quanto custa o corte?"), deps);
    const s2 = await responder(entrada("Quanto tempo demora?", { historico: [
      { role: "CUSTOMER", content: "Quanto custa o corte?" }, { role: "AI", content: s1.mensagens[0] },
      { role: "CUSTOMER", content: "Quanto tempo demora?" },
    ] }), deps);
    expect(s2.mensagens).toEqual(["Corte leva 40 min."]);
    expect(deps.ia).not.toHaveBeenCalled();
  });

  it("preço e disponibilidade usam o mesmo serviço sem duplicar perguntas", async () => {
    const deps = dependencias();
    const s = await responder(entrada("Quanto custa corte e tem vaga amanhã?"), deps);
    expect(s.mensagens[0]).toContain("R$ 45,00");
    expect(s.estado?.tipo).toBe("HORARIO");
    expect(deps.livres).toHaveBeenCalledWith(expect.objectContaining({ servico: fatos.servicos[0] }));
    expect(deps.marcar).not.toHaveBeenCalled();
  });

  it("mantém a escolha pendente quando cliente pergunta preço ou agradece", async () => {
    const deps = dependencias();
    const oferta = await responder(entrada("Tem vaga amanhã pra corte?"), deps);
    for (const texto of ["Quanto custa?", "Obrigado"]) {
      const s = await responder(entrada(texto, { estado: oferta.estado }), deps);
      expect(s.estado).toEqual(oferta.estado);
    }
    expect(deps.marcar).not.toHaveBeenCalled();
  });

  it("dúvida sobre opção não vira reserva", async () => {
    const deps = dependencias();
    const oferta = await responder(entrada("Tem vaga amanhã pra corte?"), deps);
    await responder(entrada("A primeira opção custa quanto?", { estado: oferta.estado }), deps);
    expect(deps.marcar).not.toHaveBeenCalled();
  });

  it("correção recente substitui o serviço antigo", async () => {
    const deps = dependencias();
    const s = await responder(entrada("Na verdade, quanto custa a barba?", { historico: [
      { role: "CUSTOMER", content: "Quanto custa corte?" }, { role: "AI", content: "Corte sai por R$ 45,00." },
      { role: "CUSTOMER", content: "Na verdade, quanto custa a barba?" },
    ] }), deps);
    expect(s.mensagens).toEqual(["Barba sai por R$ 35,00."]);
  });

  it("pergunta conhecida e detalhe sem fonte têm resposta parcial explícita", async () => {
    const deps = dependencias();
    const s = await responder(entrada("Onde fica? Tem estacionamento com manobrista?"), deps);
    expect(s.mensagens[0]).toContain("Rua Exemplo, 100");
    expect(s.mensagens[0]).toContain("Não tenho essa informação confirmada");
    expect(s.anotar?.pergunta).toContain("manobrista");
    expect(s.mensagens[0]).not.toContain("Não temos estacionamento próprio");
  });

  it("não copia uma afirmação inventada do histórico da IA", async () => {
    const deps = dependencias();
    const s = await responder(entrada("Quanto tempo demora?", { historico: [
      { role: "CUSTOMER", content: "Olá" }, { role: "AI", content: "Você quer Corte por R$ 10,00?" },
      { role: "CUSTOMER", content: "Quanto tempo demora?" },
    ] }), deps);
    expect(s.mensagens.join(" ")).not.toMatch(/40 min|10,00/);
    expect(deps.marcar).not.toHaveBeenCalled();
  });

  it("referência a dois serviços não escolhe um arbitrariamente", async () => {
    const deps = dependencias();
    const s = await responder(entrada("Quanto tempo demora?", { historico: [
      { role: "CUSTOMER", content: "Estou pensando em corte e barba" },
      { role: "CUSTOMER", content: "Quanto tempo demora?" },
    ] }), deps);
    expect(s.mensagens.join(" ")).not.toMatch(/40 min|30 min/);
  });

  it("não troca preço de serviços mesmo que o modelo sugira outro valor existente", async () => {
    const deps = dependencias();
    deps.ia.mockResolvedValue({ resposta: "Corte custa R$ 35,00.", transferir_humano: false,
      motivo_transferencia: "", nome_cliente: "", interesse: "", fontes_ids: ["servico:barba:preco"], duvida_pendente: false });
    const s = await responder(entrada("Quanto custa corte?"), deps);
    expect(s.mensagens).toEqual(["Corte sai por R$ 45,00."]);
    expect(deps.ia).not.toHaveBeenCalled();
  });

  it("é transparente sobre identidade e não transfere essa pergunta", async () => {
    const deps = dependencias();
    const s = await responder(entrada("Você é uma pessoa?"), deps);
    expect(s.mensagens[0]).toContain("atendente virtual");
    expect(s.equipe).toBeUndefined();
  });

  it("não reapresenta quando a conversa já teve resposta", async () => {
    const s = await responder(entrada("oi", { primeiraDoDia: true, historico: [
      { role: "AI", content: "Eu sou Bia, atendente virtual." }, { role: "CUSTOMER", content: "oi" },
    ] }), dependencias());
    expect(s.mensagens[0]).not.toContain("Eu sou Bia");
  });

  it("dia explicitamente fechado não gera disponibilidade fictícia", async () => {
    const deps = dependencias();
    const s = await responder(entrada("Vocês abrem amanhã?", { fatos: { ...fatos, diasFechados: ["2026-09-23"] } }), deps);
    expect(s.mensagens).toEqual(["Não abrimos amanhã."]);
    expect(deps.livres).not.toHaveBeenCalled();
  });

  it("falha de consulta não vira afirmação de ausência de vagas", async () => {
    const deps = dependencias();
    deps.livres.mockRejectedValue(new Error("timeout"));
    const s = await responder(entrada("Tem vaga amanhã pra corte?"), deps);
    expect(s.mensagens[0]).toContain("Não consegui consultar");
    expect(s.mensagens[0]).not.toMatch(/sem vagas|não tenho mais horário|anotei|avisei/i);
    expect(s.anotar).toBeDefined();
  });

  it("horários não cadastrados não viram expediente ou vagas padrão", async () => {
    const deps = dependencias();
    const s = await responder(entrada("Tem vaga amanhã pra corte?", { fatos: { ...fatos, horarios: [] } }), deps);
    expect(s.mensagens[0]).toContain("Não tenho essa informação confirmada");
    expect(deps.livres).not.toHaveBeenCalled();
    expect(deps.marcar).not.toHaveBeenCalled();
  });

  it("oferta antiga não reserva serviço removido ou com duração alterada", async () => {
    const deps = dependencias();
    const oferta = await responder(entrada("Tem vaga amanhã pra corte?"), deps);
    for (const servicos of [[], [{ ...fatos.servicos[0], duracaoMin: 60 }]]) {
      const s = await responder(entrada("1", { estado: oferta.estado, fatos: { ...fatos, servicos } }), deps);
      expect(s.mensagens[0]).toContain("conferidos novamente");
      expect(s.estado).toBeNull();
    }
    expect(deps.marcar).not.toHaveBeenCalled();
  });

  it("timeout de marcação não declara falha definitiva nem oferece nova reserva", async () => {
    const deps = dependencias();
    const oferta = await responder(entrada("Tem vaga amanhã pra corte?"), deps);
    deps.marcar.mockRejectedValue(new Error("timeout"));
    const s = await responder(entrada("1", { estado: oferta.estado }), deps);
    expect(s.mensagens[0]).toContain("confirmar o resultado");
    expect(s.equipe).toBe(true);
    expect(s.marcou).toBeUndefined();
    expect(s.estado).toEqual(oferta.estado);
    expect(deps.livres).toHaveBeenCalledTimes(1);
    expect(deps.marcar).toHaveBeenCalledTimes(1);
  });
});

describe("catálogo e mídia sem afirmações inventadas", () => {
  it.each([null, {}, { fontes_ids: ["outra-empresa:preco"], duvida_pendente: false },
    { fontes_ids: ["faq:0"], duvida_pendente: "false" }, { fontes_ids: ["faq:0", "inexistente"], duvida_pendente: false }])(
    "recusa seleção inválida %j", (resposta) => {
      expect(validarSelecaoDeFontes(resposta, catalogoDeRespostas(fatos))).toBeNull();
    });

  it("deduplica fontes e trata seleção vazia como pendente", () => {
    const catalogo = catalogoDeRespostas(fatos);
    expect(validarSelecaoDeFontes({ fontes_ids: ["faq:0", "faq:0"], duvida_pendente: false }, catalogo)?.fontes).toHaveLength(1);
    expect(validarSelecaoDeFontes({ fontes_ids: [], duvida_pendente: false }, catalogo)?.pendente).toBe(true);
    expect(catalogoDeRespostas({ ...fatos, serviceRules: '[{"nome":"João"}]' }).some((f) => f.id === "regras")).toBe(false);
  });

  it("mesmo com IDs válidos, texto livre e ações inventadas nunca são enviados", async () => {
    const deps = dependencias();
    deps.ia.mockResolvedValue({ resposta: "Avisei o gerente. Temos manobrista grátis, reserva confirmada.", transferir_humano: false,
      motivo_transferencia: "", nome_cliente: "", interesse: "", fontes_ids: ["faq:0"], duvida_pendente: true });
    const s = await responder(entrada("Tem um lugar para deixar o carro e manobrista?"), deps);
    expect(s.mensagens[0]).toContain("Não temos estacionamento próprio.");
    expect(s.mensagens[0]).toContain("Não tenho essa informação confirmada");
    expect(s.mensagens[0]).not.toMatch(/avisei|grátis|reserva confirmada/i);
  });

  it.each(["audio", "imagem", "documento", "video", "figurinha"] as const)("%s sem legenda pede texto sem fingir leitura", async (tipo) => {
    const deps = dependencias();
    const s = await responder(entrada(textoDeMidiaNaoInterpretada(tipo)), deps);
    expect(s.mensagens[0]).toContain("não consigo interpretar");
    expect(deps.ia).not.toHaveBeenCalled();
    expect(deps.marcar).not.toHaveBeenCalled();
  });

  it("responde legenda e explica a limitação da mídia", async () => {
    const deps = dependencias();
    const s = await responder(entrada(textoDeMidiaNaoInterpretada("imagem", "Quanto custa corte?")), deps);
    expect(s.mensagens[0]).toContain("R$ 45,00");
    expect(s.mensagens[0]).toContain("não consigo interpretar");
    expect(deps.ia).not.toHaveBeenCalled();
  });

  it("pedido humano na legenda mantém prioridade", async () => {
    const s = await responder(entrada(textoDeMidiaNaoInterpretada("audio", "Quero falar com uma pessoa")), dependencias());
    expect(s.equipe).toBe(true);
    expect(s.mensagens[0]).not.toContain("Pode escrever");
  });

  it("fonte válida de outro serviço não responde a referência identificada", async () => {
    const deps = dependencias();
    deps.ia.mockResolvedValue({ resposta: "Barba leva 30 minutos", transferir_humano: false,
      motivo_transferencia: "", nome_cliente: "", interesse: "", fontes_ids: ["servico:barba:duracao"], duvida_pendente: false });
    const s = await responder(entrada("Pode explicar o Corte?"), deps);
    expect(s.mensagens[0]).not.toContain("30 min");
    expect(s.anotar?.motivo).toContain("não corresponde ao serviço");
  });

  it("avaliação humana indicada em parte composta não se perde", async () => {
    const deps = dependencias();
    deps.ia.mockResolvedValue({ resposta: "Eu já dei o desconto", transferir_humano: true,
      motivo_transferencia: "Negociação", nome_cliente: "", interesse: "", fontes_ids: [], duvida_pendente: true });
    const s = await responder(entrada("Onde fica? Vocês negociam descontos especiais?"), deps);
    expect(s.equipe).toBe(true);
    expect(s.mensagens[0]).toContain("Rua Exemplo, 100");
    expect(s.mensagens[0]).toContain("pausar o atendimento virtual");
    expect(s.mensagens[0]).not.toContain("já dei");
  });
});
