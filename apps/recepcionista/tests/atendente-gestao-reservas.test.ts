import { beforeEach, describe, expect, it, vi } from "vitest";
import { responder, type DependenciasDoMotor, type EntradaDoMotor } from "@/lib/atendente/motor";
import { lerEstado } from "@/lib/atendente/oferta";
import type { Fatos } from "@/lib/atendente/fatos";
import type { ReservaDoCliente } from "@/lib/agenda/gestao-reservas";

const agora = new Date("2026-10-26T12:00:00.000Z");
const reserva: ReservaDoCliente = { id: "reserva1", servicoId: "s1", servicoNome: "Massagem relaxante",
  inicio: "2026-10-28T17:00:00.000Z", fim: "2026-10-28T18:00:00.000Z", profissional: "Ana", versao: "2026-10-25T12:00:00.000Z" };
const fatos: Fatos = { empresa: "Empresa fictícia", nome: "Bia", jeito: "DIRETO", marcaDireto: true, agendamento: "DIRETO",
  gestaoReservas: { cancelar: true, remarcar: true, antecedenciaHoras: 24 }, expediente: true,
  servicos: [{ id: "s1", nome: "Massagem relaxante", duracaoMin: 60, precoCents: 15000 }], profissionais: ["Ana"],
  horarios: Array.from({ length: 7 }, (_, day) => ({ day, open: "09:00", close: "18:00", closed: false })), diasFechados: [],
  endereco: "Rua Exemplo", pagamento: "Pix", descricao: "", perguntas: [], linkAgenda: null };
function entrada(texto: string, extra: Partial<EntradaDoMotor> = {}): EntradaDoMotor {
  return { texto, historico: [{ role: "CUSTOMER", content: texto }], estado: null, primeiraDoDia: false, clienteNome: "Marcos",
    telefone: "5511999990000", fatos, agora, contexto: "EXPEDIENTE", palavrasDoDono: [], ...extra };
}
function dependencias() {
  return { livres: vi.fn(async () => []), marcar: vi.fn(), ia: vi.fn(),
    gestaoReservas: { listar: vi.fn(async () => [reserva]), livres: vi.fn(async () => [{ inicio: new Date("2026-10-29T17:00:00.000Z"),
      fim: new Date("2026-10-29T18:00:00.000Z"), profissional: "Ana" }]),
    alterar: vi.fn(async (_reserva, acao, nova) => ({ estado: "CONCLUIDA" as const, acao, reserva: { ...reserva,
      ...(nova ? { inicio: nova.inicio, fim: nova.fim } : {}), versao: "2026-10-26T12:00:01.000Z" }, reutilizada: false })) } } satisfies DependenciasDoMotor;
}

describe("gestão autorizada de reservas do cliente", () => {
  it("localiza a reserva, pede confirmação específica e só depois cancela", async () => {
    const deps = dependencias();
    const proposta = await responder(entrada("Quero cancelar meu agendamento"), deps);
    expect(proposta.estado).toMatchObject({ tipo: "GERIR_RESERVA", etapa: "CANCELAMENTO", selecionada: reserva.id });
    expect(proposta.mensagens.join(" ")).toContain("Massagem relaxante");
    expect(deps.gestaoReservas.alterar).not.toHaveBeenCalled();
    const final = await responder(entrada("Sim, pode cancelar", { estado: proposta.estado }), deps);
    expect(deps.gestaoReservas.alterar).toHaveBeenCalledWith(reserva, "CANCELAR", undefined);
    expect(final.alterouReserva).toMatchObject({ acao: "CANCELAR", appointmentId: reserva.id });
    expect(final.mensagens.join(" ")).toContain("cancelamento");
    expect(final.equipe).toBeUndefined(); expect(deps.marcar).not.toHaveBeenCalled();
  });
  it.each(["talvez", "se não tiver taxa pode cancelar", "sim, mas só se for grátis", "o que você acha?"])("não trata %s como confirmação", async texto => {
    const deps = dependencias();
    const proposta = await responder(entrada("Quero cancelar meu agendamento"), deps);
    const r = await responder(entrada(texto, { estado: proposta.estado }), deps);
    expect(deps.gestaoReservas.alterar).not.toHaveBeenCalled(); expect(r.alterouReserva).toBeUndefined();
  });
  it("desistência encerra sem alterar nada", async () => {
    const deps = dependencias(); const proposta = await responder(entrada("Quero cancelar meu agendamento"), deps);
    const r = await responder(entrada("Não", { estado: proposta.estado }), deps);
    expect(r.estado).toBeNull(); expect(r.mensagens.join(" ")).toContain("não fiz nenhuma alteração");
    expect(deps.gestaoReservas.alterar).not.toHaveBeenCalled();
  });
  it("duas reservas exigem escolha e uma nova confirmação", async () => {
    const deps = dependencias(); deps.gestaoReservas.listar.mockResolvedValue([reserva, { ...reserva, id: "reserva2", inicio: "2026-10-30T17:00:00.000Z" }]);
    const lista = await responder(entrada("Quero cancelar meu agendamento"), deps);
    expect(lista.estado).toMatchObject({ etapa: "RESERVA", selecionada: null });
    const escolha = await responder(entrada("2", { estado: lista.estado }), deps);
    expect(escolha.estado).toMatchObject({ etapa: "CANCELAMENTO", selecionada: "reserva2" });
    expect(deps.gestaoReservas.alterar).not.toHaveBeenCalled();
  });
  it("remarcação mantém a reserva antiga até confirmar a opção nova", async () => {
    const deps = dependencias();
    const dia = await responder(entrada("Quero remarcar meu horário"), deps);
    expect(dia.mensagens.join(" ")).toContain("qual dia");
    const proposta = await responder(entrada("Quinta às 14h", { estado: dia.estado }), deps);
    expect(proposta.estado).toMatchObject({ etapa: "REMARCACAO", proposta: { inicio: "2026-10-29T17:00:00.000Z" } });
    expect(deps.gestaoReservas.alterar).not.toHaveBeenCalled();
    const final = await responder(entrada("Confirmo a alteração", { estado: proposta.estado }), deps);
    expect(final.alterouReserva).toMatchObject({ acao: "REMARCAR", inicio: "2026-10-29T17:00:00.000Z" });
    expect(deps.marcar).not.toHaveBeenCalled();
  });
  it("alternativa oferecida não vira alteração sem escolha e confirmação", async () => {
    const deps = dependencias();
    const proposta = await responder(entrada("Quero remarcar para quinta às 15h"), deps);
    expect(proposta.estado).toMatchObject({ etapa: "HORARIO" });
    expect(proposta.mensagens.join(" ")).toContain("não está livre");
    const escolha = await responder(entrada("1", { estado: proposta.estado }), deps);
    expect(escolha.estado).toMatchObject({ etapa: "REMARCACAO" });
    expect(deps.gestaoReservas.alterar).not.toHaveBeenCalled();
  });
  it("pergunta de preço durante a confirmação preserva a proposta", async () => {
    const deps = dependencias(); const proposta = await responder(entrada("Quero cancelar meu agendamento"), deps);
    const r = await responder(entrada("Quanto custa a Massagem relaxante?", { estado: proposta.estado }), deps);
    expect(r.estado).toEqual(proposta.estado); expect(r.mensagens.join(" ")).toContain("150");
    expect(deps.gestaoReservas.alterar).not.toHaveBeenCalled();
  });
  it.each([
    { ...fatos, gestaoReservas: undefined },
    { ...fatos, gestaoReservas: { cancelar: true, remarcar: true, antecedenciaHoras: null } },
    { ...fatos, marcaDireto: false }, { ...fatos, agendamento: "LINK" as const },
  ])("ausência de autorização ou modo direto impede a ação", async configuracao => {
    const deps = dependencias(); const r = await responder(entrada("Quero cancelar meu agendamento", { fatos: configuracao }), deps);
    expect(r.equipe).toBe(true); expect(deps.gestaoReservas.listar).not.toHaveBeenCalled(); expect(deps.gestaoReservas.alterar).not.toHaveBeenCalled();
  });
  it("prazo de antecedência é respeitado", async () => {
    const deps = dependencias(); deps.gestaoReservas.listar.mockResolvedValue([{ ...reserva, inicio: "2026-10-26T17:00:00.000Z" }]);
    const r = await responder(entrada("Quero cancelar meu agendamento"), deps);
    expect(r.equipe).toBe(true); expect(r.mensagens.join(" ")).toContain("fora do prazo"); expect(deps.gestaoReservas.alterar).not.toHaveBeenCalled();
  });
  it("resultado desconhecido pausa sem alegar sucesso nem repetir a escrita", async () => {
    const deps = dependencias(); const proposta = await responder(entrada("Quero cancelar meu agendamento"), deps);
    deps.gestaoReservas.alterar.mockResolvedValueOnce({ estado: "DESCONHECIDA" } as never);
    const r = await responder(entrada("Confirmo", { estado: proposta.estado }), deps);
    expect(r.equipe).toBe(true); expect(r.alterouReserva).toBeUndefined(); expect(r.mensagens.join(" ")).toContain("conferir a agenda");
    expect(deps.gestaoReservas.alterar).toHaveBeenCalledTimes(1);
  });
  it("sem integração, como no simulador, nunca altera reservas", async () => {
    const deps = dependencias(); const r = await responder(entrada("Quero remarcar meu horário"), { ...deps, gestaoReservas: undefined });
    expect(r.equipe).toBe(true); expect(deps.gestaoReservas.alterar).not.toHaveBeenCalled(); expect(deps.marcar).not.toHaveBeenCalled();
  });
  it("pedido de pessoa interrompe a confirmação pendente", async () => {
    const deps = dependencias(); const proposta = await responder(entrada("Quero cancelar meu agendamento"), deps);
    const r = await responder(entrada("Quero falar com uma pessoa", { estado: proposta.estado }), deps);
    expect(r.equipe).toBe(true); expect(deps.gestaoReservas.alterar).not.toHaveBeenCalled();
  });
  it("estado persistido é validado e expira", async () => {
    const deps = dependencias(); const proposta = await responder(entrada("Quero cancelar meu agendamento"), deps);
    expect(lerEstado({ ...proposta.estado, _memoriaAtendente: {} }, agora)).toEqual(proposta.estado);
    expect(lerEstado(proposta.estado, new Date(agora.getTime() + 3 * 3_600_000))).toBeNull();
    expect(lerEstado({ ...proposta.estado, reservas: [{ ...reserva, id: "" }] }, agora)).toBeNull();
  });
});
