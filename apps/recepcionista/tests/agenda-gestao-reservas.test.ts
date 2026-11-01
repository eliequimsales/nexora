import { beforeEach, describe, expect, it, vi } from "vitest";
import { configuracaoExemplo } from "./fixtures/configuracao-nexa";

vi.mock("@/lib/db", () => {
  const db: Record<string, unknown> = { appointment: { findFirst: vi.fn(), findMany: vi.fn(), updateMany: vi.fn() },
    conversation: { findFirst: vi.fn() }, companyProfile: { findUnique: vi.fn() }, service: { findFirst: vi.fn() },
    $transaction: vi.fn(async (cb: (tx: unknown) => unknown) => cb(db)) };
  return { prisma: db };
});
import { prisma } from "@/lib/db";
import { alterarReservaNaAgenda, listarReservasDoCliente, politicaPermite, type PedidoGestaoReserva, type ReservaDoCliente } from "@/lib/agenda/gestao-reservas";

type Fn = ReturnType<typeof vi.fn>;
const db = prisma as unknown as { appointment: { findFirst: Fn; findMany: Fn; updateMany: Fn }; conversation: { findFirst: Fn };
  companyProfile: { findUnique: Fn }; service: { findFirst: Fn }; $transaction: Fn };
const agora = new Date("2026-10-26T12:00:00.000Z");
const reserva: ReservaDoCliente = { id: "a1", servicoId: "servico1", servicoNome: "Revisão", inicio: "2026-10-28T17:00:00.000Z",
  fim: "2026-10-28T17:45:00.000Z", profissional: "Ana", versao: "2026-10-25T12:00:00.000Z" };
const novaOpcao = { inicio: "2026-10-29T17:00:00.000Z", fim: "2026-10-29T17:45:00.000Z", profissional: "Ana" };
const pedido = (extra: Partial<PedidoGestaoReserva> = {}): PedidoGestaoReserva => ({ companyId: "c1", conversaId: "conversa1",
  operacaoId: "msg1", telefone: "5511999990000", acao: "CANCELAR", reserva, agora, ...extra });
let atual: { id: string; companyId: string; customerId: string; serviceId: string; service: { name: string; companyId: string };
  startsAt: Date; endsAt: Date; updatedAt: Date; status: string; notes: string };
let configuracao: ReturnType<typeof configuracaoExemplo>;
beforeEach(() => {
  vi.clearAllMocks(); configuracao = configuracaoExemplo();
  configuracao.atendimento.gestaoReservas = { cancelar: true, remarcar: true, antecedenciaHoras: 24 };
  atual = { id: reserva.id, companyId: "c1", customerId: "cli1", serviceId: "servico1", service: { name: "Revisão", companyId: "c1" },
    startsAt: new Date(reserva.inicio), endsAt: new Date(reserva.fim), updatedAt: new Date(reserva.versao), status: "CONFIRMADO",
    notes: JSON.stringify({ profissional: "Ana", observacoes: "Preservar anotação" }) };
  db.companyProfile.findUnique.mockImplementation(async () => ({ businessHours: configuracao.informacoes.horarios, diasFechados: [], serviceRules: "[]",
    atendenteConfiguracao: { versao: 1, revisao: 1, rascunho: configuracao, etapa: 5, revisadas: [0, 1, 2, 3], testes: [],
      publicado: { revisao: 1, em: agora.toISOString(), rascunho: configuracao } } }));
  db.appointment.findFirst.mockImplementation(async q => q.where.companyId === atual.companyId && q.where.id === atual.id ? { ...atual } : null);
  db.appointment.findMany.mockResolvedValue([]);
  db.service.findFirst.mockResolvedValue({ durationMin: 45 });
  db.conversation.findFirst.mockResolvedValue({ status: "AI", donoAssumiuEm: null, messages: [{ id: "msg1" }] });
  db.appointment.updateMany.mockImplementation(async q => { atual = { ...atual, ...q.data }; return { count: 1 }; });
  db.$transaction.mockImplementation(async cb => cb(db));
});

describe("alteração de reserva com prova e identidade persistida", () => {
  it("cancela transacionalmente e preserva observações", async () => {
    const r = await alterarReservaNaAgenda(pedido());
    expect(r).toMatchObject({ estado: "CONCLUIDA", acao: "CANCELAR", reutilizada: false, reserva: { id: "a1" } });
    expect(atual.status).toBe("CANCELADO");
    expect(JSON.parse(atual.notes)).toMatchObject({ profissional: "Ana", observacoes: "Preservar anotação" });
    expect(JSON.parse(atual.notes)._nexoraGestao[0]).toMatchObject({ acao: "CANCELAR", anterior: { inicio: reserva.inicio } });
    expect(db.$transaction.mock.calls[0][1]).toEqual({ isolationLevel: "Serializable" });
  });
  it("repetir a mesma operação reutiliza a confirmação sem nova escrita", async () => {
    await alterarReservaNaAgenda(pedido());
    expect(await alterarReservaNaAgenda(pedido())).toMatchObject({ estado: "CONCLUIDA", reutilizada: true });
    expect(db.appointment.updateMany).toHaveBeenCalledTimes(1);
  });
  it("a mesma chave com argumentos diferentes não autoriza outra operação", async () => {
    await alterarReservaNaAgenda(pedido());
    expect(await alterarReservaNaAgenda(pedido({ reserva: { ...reserva, versao: "2026-10-24T12:00:00.000Z" } }))).toEqual({ estado: "DESCONHECIDA" });
    expect(db.appointment.updateMany).toHaveBeenCalledTimes(1);
  });
  it("sucesso perdido após commit é recuperado pelo registro persistido", async () => {
    db.$transaction.mockImplementationOnce(async cb => { await cb(db); throw new Error("Resposta perdida"); });
    expect(await alterarReservaNaAgenda(pedido())).toMatchObject({ estado: "CONCLUIDA", reutilizada: true });
    expect(db.appointment.updateMany).toHaveBeenCalledTimes(1);
  });
  it("timeout sem prova fica desconhecido", async () => {
    db.$transaction.mockRejectedValueOnce(new Error("timeout"));
    expect(await alterarReservaNaAgenda(pedido())).toEqual({ estado: "DESCONHECIDA" });
    expect(db.appointment.updateMany).not.toHaveBeenCalled();
  });
  it("outra empresa não consegue alterar o agendamento", async () => {
    expect(await alterarReservaNaAgenda(pedido({ companyId: "outra" }))).toEqual({ estado: "INDISPONIVEL", motivo: "RESERVA" });
    expect(db.appointment.updateMany).not.toHaveBeenCalled();
  });
  it("busca exige vínculo do telefone e da empresa também no titular", async () => {
    await alterarReservaNaAgenda(pedido());
    expect(db.appointment.findFirst.mock.calls[0][0].where).toMatchObject({ id: "a1", companyId: "c1",
      customer: { companyId: "c1", phone: { in: expect.arrayContaining(["5511999990000"]) } } });
    expect(db.conversation.findFirst.mock.calls[0][0].where).toMatchObject({ id: "conversa1", companyId: "c1", customerPhone: { in: expect.arrayContaining(["5511999990000"]) } });
  });
  it.each([
    { cancelar: false, remarcar: true, antecedenciaHoras: 24 },
    { cancelar: true, remarcar: true, antecedenciaHoras: null },
  ])("política não autorizada bloqueia a escrita", async politica => {
    configuracao.atendimento.gestaoReservas = politica;
    expect(await alterarReservaNaAgenda(pedido())).toEqual({ estado: "INDISPONIVEL", motivo: "AUTORIZACAO" });
    expect(db.appointment.updateMany).not.toHaveBeenCalled();
  });
  it("desativar agenda direta bloqueia permissões antigas", async () => {
    configuracao.atendimento.agendamento = "LINK";
    expect(await alterarReservaNaAgenda(pedido())).toEqual({ estado: "INDISPONIVEL", motivo: "AUTORIZACAO" });
  });
  it.each([
    { status: "HUMAN", donoAssumiuEm: agora, messages: [{ id: "msg1" }] },
    { status: "AI", donoAssumiuEm: null, messages: [{ id: "msg2" }] },
  ])("tomada humana ou nova mensagem interrompe a alteração", async conversa => {
    db.conversation.findFirst.mockResolvedValue(conversa);
    expect(await alterarReservaNaAgenda(pedido())).toEqual({ estado: "INDISPONIVEL", motivo: "AUTORIZACAO" });
    expect(db.appointment.updateMany).not.toHaveBeenCalled();
  });
  it("versão modificada depois da proposta impede sobrescrita", async () => {
    atual.updatedAt = new Date("2026-10-25T13:00:00.000Z");
    expect(await alterarReservaNaAgenda(pedido())).toEqual({ estado: "INDISPONIVEL", motivo: "ALTERADA" });
    expect(db.appointment.updateMany).not.toHaveBeenCalled();
  });
  it("antecedência vale no instante da confirmação", async () => {
    expect(await alterarReservaNaAgenda(pedido({ agora: new Date("2026-10-28T16:00:00.000Z") }))).toEqual({ estado: "INDISPONIVEL", motivo: "ANTECEDENCIA" });
  });
  it("remarca o mesmo registro, preservando vínculo e serviço", async () => {
    const r = await alterarReservaNaAgenda(pedido({ acao: "REMARCAR", novaOpcao }));
    expect(r).toMatchObject({ estado: "CONCLUIDA", acao: "REMARCAR", reserva: { id: "a1", inicio: novaOpcao.inicio, fim: novaOpcao.fim } });
    expect(atual).toMatchObject({ customerId: "cli1", serviceId: "servico1", status: "CONFIRMADO" });
    expect(atual.startsAt.toISOString()).toBe(novaOpcao.inicio);
  });
  it("conflito com outra reserva não cancela nem move a original", async () => {
    db.appointment.findMany.mockResolvedValue([{ startsAt: new Date(novaOpcao.inicio), endsAt: new Date(novaOpcao.fim), notes: JSON.stringify({ profissional: "Ana" }) }]);
    expect(await alterarReservaNaAgenda(pedido({ acao: "REMARCAR", novaOpcao }))).toEqual({ estado: "INDISPONIVEL", motivo: "OCUPADO" });
    expect(db.appointment.updateMany).not.toHaveBeenCalled(); expect(atual.startsAt.toISOString()).toBe(reserva.inicio);
  });
  it("capacidade única considera também reservas com outra anotação de profissional", async () => {
    db.appointment.findMany.mockResolvedValue([{ startsAt: new Date(novaOpcao.inicio), endsAt: new Date(novaOpcao.fim), notes: JSON.stringify({ profissional: "Outro nome legado" }) }]);
    expect(await alterarReservaNaAgenda(pedido({ acao: "REMARCAR", novaOpcao }))).toEqual({ estado: "INDISPONIVEL", motivo: "OCUPADO" });
  });
  it("duração alterada ou outro profissional exigem revisão", async () => {
    db.service.findFirst.mockResolvedValueOnce({ durationMin: 30 });
    expect(await alterarReservaNaAgenda(pedido({ acao: "REMARCAR", novaOpcao }))).toEqual({ estado: "INDISPONIVEL", motivo: "ALTERADA" });
    expect(await alterarReservaNaAgenda(pedido({ acao: "REMARCAR", novaOpcao: { ...novaOpcao, profissional: "Outra" } }))).toEqual({ estado: "INDISPONIVEL", motivo: "ALTERADA" });
    expect(db.appointment.updateMany).not.toHaveBeenCalled();
  });
  it("horário fora do expediente e dia fechado não são aceitos", async () => {
    expect(await alterarReservaNaAgenda(pedido({ acao: "REMARCAR", novaOpcao: { ...novaOpcao, inicio: "2026-10-29T23:00:00.000Z", fim: "2026-10-29T23:45:00.000Z" } }))).toEqual({ estado: "INDISPONIVEL", motivo: "OCUPADO" });
    expect(db.appointment.updateMany).not.toHaveBeenCalled();
  });
  it("perda da atualização concorrente não vira sucesso", async () => {
    db.appointment.updateMany.mockResolvedValueOnce({ count: 0 });
    expect(await alterarReservaNaAgenda(pedido())).toEqual({ estado: "INDISPONIVEL", motivo: "ALTERADA" });
  });
});

describe("consulta e política", () => {
  it("consulta somente reservas futuras ativas do titular na empresa", async () => {
    db.appointment.findMany.mockResolvedValue([{ ...atual }, { ...atual, id: "foreign", service: { name: "Outra", companyId: "outra" } }]);
    const r = await listarReservasDoCliente({ companyId: "c1", telefone: "5511999990000", agora });
    expect(r.map(v => v.id)).toEqual(["a1"]);
    expect(db.appointment.findMany.mock.calls[0][0].where).toMatchObject({ companyId: "c1", customer: { companyId: "c1" }, status: { in: ["MARCADO", "CONFIRMADO"] }, startsAt: { gt: agora } });
  });
  it("telefone inválido não consulta dados", async () => {
    expect(await listarReservasDoCliente({ companyId: "c1", telefone: "123", agora })).toEqual([]);
    expect(db.appointment.findMany).not.toHaveBeenCalled();
  });
  it("zero horas é permitido somente quando informado explicitamente", () => {
    expect(politicaPermite({ cancelar: true, remarcar: true, antecedenciaHoras: 0 }, "CANCELAR", reserva.inicio, agora)).toBe(true);
    expect(politicaPermite({ cancelar: true, remarcar: true, antecedenciaHoras: null }, "CANCELAR", reserva.inicio, agora)).toBe(false);
  });
});
