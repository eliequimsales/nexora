import { describe, expect, it, vi } from "vitest";
import { aplicarConfiguracaoAosFatos } from "@/lib/atendente/configuracao-fatos";
import { catalogoDeRespostas } from "@/lib/atendente/conhecimento";
import { responder, type DependenciasDoMotor } from "@/lib/atendente/motor";
import { configuracaoExemplo, fatosExemplo } from "./fixtures/configuracao-nexa";

function dependencias() {
  return {
    livres: vi.fn<Parameters<DependenciasDoMotor["livres"]>, ReturnType<DependenciasDoMotor["livres"]>>().mockResolvedValue([]),
    marcar: vi.fn<Parameters<DependenciasDoMotor["marcar"]>, ReturnType<DependenciasDoMotor["marcar"]>>().mockResolvedValue({ ok: false, motivo: "RESULTADO_DESCONHECIDO" }),
    ia: vi.fn<Parameters<DependenciasDoMotor["ia"]>, ReturnType<DependenciasDoMotor["ia"]>>().mockRejectedValue(new Error("Sem fonte")),
  };
}
async function conversar(texto: string, config = configuracaoExemplo(), estado: unknown = null) {
  const deps = dependencias();
  const resposta = await responder({ texto, fatos: aplicarConfiguracaoAosFatos(config, fatosExemplo),
    estado: estado as Parameters<typeof responder>[0]["estado"], historico: [{ role: "CUSTOMER", content: texto }], primeiraDoDia: false,
    clienteNome: null, telefone: "simulacao", agora: new Date("2026-10-21T12:00:00Z"), contexto: "EXPEDIENTE", palavrasDoDono: [] }, deps);
  return { resposta, deps };
}

describe("configuração revisada usada pelo motor", () => {
  it("não reaproveita conhecimento, preços livres ou regras da configuração anterior", () => {
    const f = aplicarConfiguracaoAosFatos(configuracaoExemplo(), fatosExemplo);
    expect(f.perguntas).toEqual([{ question: "Tem estacionamento?", answer: "Não há estacionamento próprio." }]);
    expect(f.pricingInfo).toBe("");
    expect(f.serviceRules).toBe("");
    expect(f.profissionais).toEqual(["Ana"]);
    expect(fatosExemplo.empresa).toBe("Nome anterior");
  });

  it("itens aguardando revisão e não aplicáveis não viram fatos confirmados", () => {
    const c = configuracaoExemplo();
    c.informacoes.endereco.situacao = "REVISAR";
    c.informacoes.pagamento.situacao = "NAO_APLICA";
    c.informacoes.servicos[0].situacao = "REVISAR";
    c.conhecimento.itens[0].situacao = "REVISAR";
    c.informacoes.horariosSituacao = "NAO_INFORMADO";
    expect(aplicarConfiguracaoAosFatos(c, fatosExemplo)).toMatchObject({ endereco: "", pagamento: "", servicos: [], perguntas: [], horarios: [], linkAgenda: null });
  });

  it("pagamento com negação permanece fiel no catálogo", () => {
    const f = aplicarConfiguracaoAosFatos(configuracaoExemplo(), fatosExemplo);
    expect(catalogoDeRespostas(f).find((s) => s.id === "pagamento")?.texto).toBe("Formas de pagamento: Não aceitamos Pix; aceitamos cartão.");
  });

  it("distingue valor fixo zero de valor sob consulta", async () => {
    const c = configuracaoExemplo();
    c.informacoes.servicos[0].precoCents = 0;
    const gratuita = await conversar("Quanto custa a revisão?", c);
    expect(gratuita.resposta.mensagens.join(" ")).toContain("R$ 0,00");
    c.informacoes.servicos[0].precoModo = "SOB_CONSULTA";
    const consulta = await conversar("Quanto custa a revisão?", c);
    expect(consulta.resposta.mensagens.join(" ")).toContain("sob consulta");
    expect(consulta.resposta.anotar).toBeUndefined();
    expect(catalogoDeRespostas(aplicarConfiguracaoAosFatos(c, fatosExemplo)).find((s) => s.id === "servico:servico1:preco")?.texto).toContain("sob consulta");
  });

  it("duração não informada não vira 30 minutos nem consulta de agenda", async () => {
    const c = configuracaoExemplo();
    c.informacoes.servicos[0].duracaoMin = null;
    const { resposta, deps } = await conversar("Tem horário amanhã para revisão?", c);
    expect(deps.livres).not.toHaveBeenCalled();
    expect(resposta.mensagens.join(" ")).not.toContain("30 min");
    expect(resposta.anotar?.motivo).toContain("Duração não confirmada");
  });

  it("agenda desautorizada encaminha sem consultar ou criar reserva", async () => {
    const c = configuracaoExemplo();
    c.atendimento.agendamento = "DESLIGADO";
    const { resposta, deps } = await conversar("Tem horário amanhã para revisão?", c);
    expect(resposta.equipe).toBe(true);
    expect(resposta.estado).toBeNull();
    expect(deps.livres).not.toHaveBeenCalled();
    expect(deps.marcar).not.toHaveBeenCalled();
  });

  it("uma escolha antiga não contorna a autonomia de agenda recém-desligada", async () => {
    const c = configuracaoExemplo(); c.atendimento.agendamento = "DESLIGADO";
    const { resposta, deps } = await conversar("1", c, { tipo: "HORARIO", servicoId: "servico1", servicoNome: "Revisão", duracaoMin: 45,
      criadoEm: "2026-10-21T11:59:00Z", opcoes: [{ n: 1, inicio: "2026-10-22T12:00:00Z", fim: "2026-10-22T12:45:00Z", profissional: "Ana" }] });
    expect(resposta.equipe).toBe(true);
    expect(deps.marcar).not.toHaveBeenCalled();
  });

  it("modo link sem link não passa a confirmar por conta própria", async () => {
    const c = configuracaoExemplo(); c.atendimento.agendamento = "LINK";
    const deps = dependencias();
    const f = aplicarConfiguracaoAosFatos(c, { ...fatosExemplo, linkAgenda: null });
    const r = await responder({ texto: "Quero agendar revisão amanhã", fatos: f, estado: null,
      historico: [], primeiraDoDia: false, clienteNome: null, telefone: "simulacao", agora: new Date("2026-10-21T12:00:00Z"), contexto: "EXPEDIENTE", palavrasDoDono: [] }, deps);
    expect(r.anotar?.motivo).toContain("Link");
    expect(deps.marcar).not.toHaveBeenCalled();
    expect(deps.livres).not.toHaveBeenCalled();
  });
});
