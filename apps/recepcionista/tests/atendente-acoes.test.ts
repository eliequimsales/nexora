import { describe, expect, it, vi } from "vitest";
import {
  AcaoAtendenteSchema, capacidadesDoAtendente, chaveDaAcao, executarAcaoAtendente, ferramentasDoAtendente,
  type AdaptadorDePagamentoDaEmpresa, type ContextoDasAcoes, type DependenciasDasAcoes,
} from "@/lib/atendente/acoes";
import type { Fatos } from "@/lib/atendente/fatos";

const inicio = "2026-10-24T14:00:00-03:00";
const instante = new Date(inicio);
const fim = new Date(instante.getTime() + 30 * 60_000);
const servico = { id: "servico-corte", nome: "Corte", duracaoMin: 30, precoCents: 4500 };
const consultar = { acao: "consultar_horarios", servicoId: servico.id, dias: ["2026-10-24"] };
const reservar = { acao: "reservar_horario", servicoId: servico.id, inicio, profissional: "Marcos" };
const pagar = { acao: "solicitar_link_pagamento", servicoId: servico.id };
const slot = { inicio: instante, fim, profissional: "Marcos" };

function contexto(p: Partial<ContextoDasAcoes> = {}): ContextoDasAcoes {
  const fatos: Fatos = {
    empresa: "Barbearia A", nome: "Sofia", jeito: "ACOLHEDOR", marcaDireto: true, agendamento: "DIRETO",
    expediente: false, servicos: [servico], profissionais: ["Marcos"],
    horarios: [{ day: 6, open: "09:00", close: "18:00", closed: false }], diasFechados: [],
    endereco: "", pagamento: "Pix", descricao: "", perguntas: [], linkAgenda: null,
  };
  return { companyId: "empresa-a", conversaId: "conversa-a", operacaoId: "mensagem-a", fatos,
    cliente: { nome: "Rafael", telefone: "5511988887777" }, agora: new Date("2026-10-23T12:00:00-03:00"),
    confirmacao: { acao: "reservar_horario", mensagemClienteId: "mensagem-a", servicoId: servico.id, inicio, profissional: "Marcos" }, ...p };
}
function dependencias(): DependenciasDasAcoes & { agenda: NonNullable<DependenciasDasAcoes["agenda"]> } {
  return { agenda: { companyId: "empresa-a", livres: vi.fn().mockResolvedValue([slot]),
    marcar: vi.fn().mockResolvedValue({ ok: true, inicio: instante, fim, profissional: "Marcos", appointmentId: "ag-123", clienteId: "cliente-1" }) } };
}
function pagamento(c: ContextoDasAcoes): AdaptadorDePagamentoDaEmpresa {
  return { companyId: c.companyId, merchantId: "merchant-a", provedor: "MERCADO_PAGO", status: "ATIVO", idempotencia: "PERSISTENTE",
    hostsPermitidos: ["pagamento.exemplo.com"], criarLink: vi.fn(async (p) => ({ estado: "CONCLUIDA" as const, ...p,
      cobrancaId: "cobranca-123", url: "https://pagamento.exemplo.com/c/123" })) };
}

describe("ações estruturadas do atendente", () => {
  it.each([
    { ...reservar, companyId: "empresa-b" }, { ...reservar, precoCents: 1 }, { ...pagar, valorCents: 1 },
    { ...reservar, confirmada: true }, { ...reservar, chaveOperacao: "inventada" },
    { ...consultar, dias: ["2026-02-31"] }, { ...consultar, dias: [] },
    { ...reservar, inicio: "2026-10-24T14:00:00" }, { ...reservar, inicio: "2026-10-24T14:00:59-03:00" },
    { acao: "transferir_dinheiro", valor: 100 },
  ])("rejeita argumentos não autorizados ou datas inválidas: %j", async (entrada) => {
    const d = dependencias();
    expect(AcaoAtendenteSchema.safeParse(entrada).success).toBe(false);
    expect(await executarAcaoAtendente(entrada, contexto(), d)).toMatchObject({ estado: "INDISPONIVEL", motivo: "ARGUMENTOS_INVALIDOS" });
    expect(d.agenda.marcar).not.toHaveBeenCalled();
    expect(d.agenda.livres).not.toHaveBeenCalled();
  });

  it("oferece somente ferramentas cuja empresa tem capacidade real", () => {
    const c = contexto();
    expect(capacidadesDoAtendente(c, {})).toEqual({ consultar_horarios: false, reservar_horario: false, solicitar_link_pagamento: false });
    expect(ferramentasDoAtendente(c, dependencias()).map((f) => f.function.name)).toEqual(["consultar_horarios", "reservar_horario"]);
    expect(ferramentasDoAtendente(c, {}).length).toBe(0);
    expect(ferramentasDoAtendente(c, { agenda: { ...dependencias().agenda, companyId: "empresa-b" } })).toEqual([]);
  });

  it("consulta usando serviço aprovado e tenant do servidor", async () => {
    const c = contexto();
    const d = dependencias();
    expect(await executarAcaoAtendente({ ...consultar, dias: ["2026-10-24", "2026-10-24"] }, c, d))
      .toEqual({ estado: "CONCLUIDA", acao: "consultar_horarios", horarios: [slot], fonte: "AGENDA" });
    expect(d.agenda.livres).toHaveBeenCalledWith({ companyId: "empresa-a", servico, dias: ["2026-10-24"], profissional: null, agora: c.agora });
    expect(d.agenda.marcar).not.toHaveBeenCalled();
  });

  it("rejeita serviço e profissional que não pertencem aos dados aprovados", async () => {
    const d = dependencias();
    expect(await executarAcaoAtendente({ ...reservar, servicoId: "servico-outra-empresa" }, contexto(), d))
      .toMatchObject({ motivo: "SERVICO_NAO_AUTORIZADO" });
    expect(await executarAcaoAtendente({ ...reservar, profissional: "Inventado" }, contexto(), d))
      .toMatchObject({ motivo: "PROFISSIONAL_NAO_AUTORIZADO" });
    expect(d.agenda.marcar).not.toHaveBeenCalled();
  });

  it("remove de consulta resultados passados, em data diferente ou com duração/profissional incorretos", async () => {
    const d = dependencias();
    vi.mocked(d.agenda.livres).mockResolvedValue([slot,
      { ...slot, inicio: new Date("2020-01-01T17:00:00Z") },
      { ...slot, inicio: new Date("2026-10-25T17:00:00Z") },
      { ...slot, fim: new Date(fim.getTime() + 1000) }, { ...slot, profissional: "Desconhecido" }]);
    expect(await executarAcaoAtendente(consultar, contexto(), d)).toMatchObject({ estado: "CONCLUIDA", horarios: [slot] });
  });

  it("falha de leitura nunca vira agenda vazia nem horário inventado", async () => {
    const d = dependencias();
    vi.mocked(d.agenda.livres).mockRejectedValue(new Error("timeout"));
    expect(await executarAcaoAtendente(consultar, contexto(), d)).toMatchObject({ estado: "INDISPONIVEL", motivo: "CONSULTA_FALHOU" });
  });

  it("não reserva sem confirmação explícita do cliente e vinculada à mesma escolha", async () => {
    const d = dependencias();
    const c = contexto();
    const confirmacoes = [undefined, { ...c.confirmacao!, mensagemClienteId: "" },
      { ...c.confirmacao!, servicoId: "outro" }, { ...c.confirmacao!, inicio: "2026-10-24T15:00:00-03:00" },
      { ...c.confirmacao!, profissional: null }];
    for (const confirmacao of confirmacoes) {
      expect(await executarAcaoAtendente(reservar, { ...c, confirmacao }, d))
        .toMatchObject({ estado: "PENDENTE", motivo: "CONFIRMACAO_NECESSARIA" });
    }
    expect(d.agenda.marcar).not.toHaveBeenCalled();
  });

  it("respeita autonomia, configuração divergente e cliente incompleto antes da escrita", async () => {
    const d = dependencias();
    const c = contexto();
    for (const fatos of [{ ...c.fatos, marcaDireto: false }, { ...c.fatos, agendamento: "LINK" as const },
      { ...c.fatos, configuracaoDivergente: true }]) {
      expect(await executarAcaoAtendente(reservar, { ...c, fatos }, d)).toMatchObject({ estado: "INDISPONIVEL", motivo: "CAPACIDADE_INDISPONIVEL" });
    }
    expect(await executarAcaoAtendente(reservar, { ...c, cliente: { nome: "", telefone: "1" } }, d))
      .toMatchObject({ estado: "PENDENTE", motivo: "CLIENTE_INCOMPLETO" });
    expect(d.agenda.marcar).not.toHaveBeenCalled();
  });

  it("reserva usando adaptador existente, chave estável e prova de ID persistido", async () => {
    const c = contexto();
    const d = dependencias();
    expect(await executarAcaoAtendente(reservar, c, d))
      .toMatchObject({ estado: "CONCLUIDA", acao: "reservar_horario", reserva: { appointmentId: "ag-123" }, fonte: "AGENDA" });
    expect(d.agenda.marcar).toHaveBeenCalledWith({ companyId: c.companyId,
      servico: { id: servico.id, nome: servico.nome, duracaoMin: 30 }, inicio: instante, profissional: "Marcos",
      cliente: c.cliente, origem: "ATENDENTE", chaveOperacao: chaveDaAcao(c, "reservar_horario"), agora: c.agora });
  });

  it("retry encaminha a mesma identidade e preserva informação de reserva reutilizada", async () => {
    const c = contexto();
    const d = dependencias();
    const r = { ok: true as const, inicio: instante, fim, profissional: "Marcos", appointmentId: "ag-123", clienteId: "cliente-1" };
    vi.mocked(d.agenda.marcar).mockResolvedValueOnce(r).mockResolvedValueOnce({ ...r, reutilizada: true });
    await executarAcaoAtendente(reservar, c, d);
    expect(await executarAcaoAtendente(reservar, c, d)).toMatchObject({ estado: "CONCLUIDA", reserva: { reutilizada: true } });
    const chamadas = vi.mocked(d.agenda.marcar).mock.calls;
    expect(chamadas[0][0].chaveOperacao).toBe(chamadas[1][0].chaveOperacao);
    expect(chaveDaAcao(c, "reservar_horario")).not.toBe(chaveDaAcao({ ...c, companyId: "empresa-b" }, "reservar_horario"));
    expect(chaveDaAcao(c, "reservar_horario")).not.toContain(c.cliente.telefone);
  });

  it.each([
    { ok: true, inicio: instante, fim, profissional: "Marcos", appointmentId: null, clienteId: null },
    { ok: true, inicio: instante, fim, profissional: "Marcos", appointmentId: "  ", clienteId: null },
    { ok: true, inicio: instante, fim: instante, profissional: "Marcos", appointmentId: "ag-123", clienteId: null },
    { ok: true, inicio: instante, fim, profissional: "Inventado", appointmentId: "ag-123", clienteId: null },
    { ok: false, motivo: "RESULTADO_DESCONHECIDO" },
  ])("resultado de escrita não comprovado não confirma reserva: %j", async (r) => {
    const d = dependencias();
    vi.mocked(d.agenda.marcar).mockResolvedValue(r as never);
    expect(await executarAcaoAtendente(reservar, contexto(), d))
      .toMatchObject({ estado: "DESCONHECIDA", motivo: "RESULTADO_NAO_COMPROVADO" });
  });

  it("timeout depois de iniciar escrita é desconhecido; ocupado é indisponível", async () => {
    const d = dependencias();
    vi.mocked(d.agenda.marcar).mockRejectedValueOnce(new Error("timeout depois do commit"));
    expect(await executarAcaoAtendente(reservar, contexto(), d)).toMatchObject({ estado: "DESCONHECIDA" });
    vi.mocked(d.agenda.marcar).mockResolvedValueOnce({ ok: false, motivo: "OCUPADO" });
    expect(await executarAcaoAtendente(reservar, contexto(), d)).toMatchObject({ estado: "INDISPONIVEL", motivo: "HORARIO_OCUPADO" });
  });

  it("simula com snapshot local sem tocar em banco, rede, reserva ou cobrança", async () => {
    const c = contexto({ simulacao: true, horariosSimulados: [slot] });
    const d = { ...dependencias(), pagamento: pagamento(c) };
    expect(await executarAcaoAtendente(consultar, c, d)).toEqual({ estado: "SIMULADA", acao: "consultar_horarios", horarios: [slot] });
    expect(await executarAcaoAtendente(reservar, c, d)).toEqual({ estado: "SIMULADA", acao: "reservar_horario" });
    expect(await executarAcaoAtendente(pagar, c, d)).toMatchObject({ estado: "INDISPONIVEL" });
    expect(d.agenda.livres).not.toHaveBeenCalled();
    expect(d.agenda.marcar).not.toHaveBeenCalled();
    expect(d.pagamento.criarLink).not.toHaveBeenCalled();
    expect(await executarAcaoAtendente(reservar, contexto({ simulacao: true }), d))
      .toMatchObject({ motivo: "CAPACIDADE_INDISPONIVEL" });
  });

  it("cobrança é indisponível sem merchant explícito; nunca usa assinatura Nexora", async () => {
    const c = contexto();
    expect(await executarAcaoAtendente(pagar, c, dependencias())).toMatchObject({ estado: "INDISPONIVEL", motivo: "CAPACIDADE_INDISPONIVEL" });
    const p = pagamento(c);
    for (const invalido of [{ ...p, companyId: "empresa-b" }, { ...p, merchantId: "" },
      { ...p, provedor: "STRIPE_NEXORA" }, { ...p, idempotencia: "MEMORIA" }, { ...p, hostsPermitidos: [] }]) {
      expect(capacidadesDoAtendente(c, { pagamento: invalido as AdaptadorDePagamentoDaEmpresa }).solicitar_link_pagamento).toBe(false);
    }
    expect(p.criarLink).not.toHaveBeenCalled();
  });

  it("link exige confirmação específica e usa preço, descrição e beneficiário aprovados pelo servidor", async () => {
    const c = contexto();
    const p = pagamento(c);
    expect(await executarAcaoAtendente(pagar, c, { pagamento: p })).toMatchObject({ motivo: "CONFIRMACAO_NECESSARIA" });
    c.confirmacao = { acao: "solicitar_link_pagamento", mensagemClienteId: "mensagem-a", servicoId: servico.id };
    expect(await executarAcaoAtendente(pagar, c, { pagamento: p }))
      .toMatchObject({ estado: "CONCLUIDA", valorCents: 4500, cobrancaId: "cobranca-123", fonte: "PROVEDOR_DA_EMPRESA" });
    expect(p.criarLink).toHaveBeenCalledTimes(1);
    expect(p.criarLink).toHaveBeenCalledWith({ companyId: "empresa-a", merchantId: "merchant-a", provedor: "MERCADO_PAGO",
      servicoId: servico.id, descricao: "Corte", valorCents: 4500, moeda: "BRL", cliente: c.cliente,
      chaveOperacao: chaveDaAcao(c, "solicitar_link_pagamento") });
  });

  it.each([
    { cobrancaId: "" }, { companyId: "empresa-b" }, { merchantId: "merchant-b" }, { provedor: "FALSO" },
    { valorCents: 1 }, { servicoId: "outro" }, { moeda: "USD" }, { chaveOperacao: "outra" },
    { url: "http://pagamento.exemplo.com/c/123" }, { url: "https://pagamento.exemplo.com.fraude.com/c/123" },
    { url: "https://usuario:senha@pagamento.exemplo.com/c/123" }, { url: "https://pagamento.exemplo.com:8443/c/123" },
  ])("resposta de cobrança inválida fica desconhecida: %j", async (alteracao) => {
    const c = contexto({ confirmacao: { acao: "solicitar_link_pagamento", mensagemClienteId: "mensagem-a", servicoId: servico.id } });
    const p = pagamento(c);
    const original = p.criarLink;
    p.criarLink = vi.fn(async (pedido) => ({ ...await original(pedido), ...alteracao })) as typeof p.criarLink;
    expect(await executarAcaoAtendente(pagar, c, { pagamento: p })).toMatchObject({ estado: "DESCONHECIDA", motivo: "RESULTADO_NAO_COMPROVADO" });
  });

  it("preço sob consulta não cria cobrança e falha do gateway não confirma link nem pagamento", async () => {
    const c = contexto({ confirmacao: { acao: "solicitar_link_pagamento", mensagemClienteId: "mensagem-a", servicoId: servico.id } });
    const p = pagamento(c);
    expect(await executarAcaoAtendente(pagar, { ...c, fatos: { ...c.fatos, servicos: [{ ...servico, precoModo: "SOB_CONSULTA" }] } }, { pagamento: p }))
      .toMatchObject({ estado: "INDISPONIVEL" });
    expect(p.criarLink).not.toHaveBeenCalled();
    vi.mocked(p.criarLink).mockRejectedValueOnce(new Error("timeout depois de criar"));
    expect(await executarAcaoAtendente(pagar, c, { pagamento: p })).toMatchObject({ estado: "DESCONHECIDA" });
    vi.mocked(p.criarLink).mockResolvedValueOnce({ estado: "PENDENTE" });
    expect(await executarAcaoAtendente(pagar, c, { pagamento: p })).toMatchObject({ estado: "PENDENTE", motivo: "AGUARDANDO_PROVEDOR" });
  });
});
