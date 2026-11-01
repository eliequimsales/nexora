import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

const database = vi.hoisted(() => ({ update: vi.fn(), findUniqueOrThrow: vi.fn() }));
vi.mock("@/lib/db", () => ({ prisma: { companyProfile: database } }));
vi.mock("@/lib/errors", () => ({ logError: vi.fn(async () => {}) }));
vi.mock("@/lib/whatsapp/evolution", async (importOriginal) => ({
  ...await importOriginal<typeof import("@/lib/whatsapp/evolution")>(),
  createInstance: vi.fn(), connectInstance: vi.fn(), setWebhook: vi.fn(), deleteInstance: vi.fn(), getConnectionState: vi.fn(),
}));

import { connectInstance, createInstance, deleteInstance, getConnectionState, setWebhook } from "@/lib/whatsapp/evolution";
import { connectWhatsApp, refreshWhatsAppStatus } from "@/lib/whatsapp/instance";
import { logError } from "@/lib/errors";

let profile: Record<string, unknown>;
beforeEach(() => {
  vi.resetAllMocks();
  vi.stubEnv("APP_URL", "https://nexora.example");
  vi.stubEnv("WEBHOOK_TOKEN", "token-apenas-de-teste");
  vi.mocked(logError).mockResolvedValue(undefined);
  profile = { whatsappStatus: "DISCONNECTED", whatsappQrCode: null, whatsappConnectedAt: null, whatsappError: null };
  database.update.mockImplementation(async ({ data }: { data: Record<string, unknown> }) => {
    Object.assign(profile, data);
    return profile as never;
  });
  database.findUniqueOrThrow.mockImplementation(async () => profile);
  vi.mocked(connectInstance).mockResolvedValue({ state: "open", qrCode: null, pairingCode: null });
});
afterEach(() => { vi.unstubAllEnvs(); });

describe("conexão exige recebimento configurado e preserva a sessão", () => {
  it("recusa falta de token antes de provisionar ou conectar", async () => {
    vi.stubEnv("WEBHOOK_TOKEN", " ");
    const state = await connectWhatsApp("empresa", "11999990000");
    expect(state.status).toBe("ERROR");
    expect(createInstance).not.toHaveBeenCalled();
    expect(setWebhook).not.toHaveBeenCalled();
    expect(connectInstance).not.toHaveBeenCalled();
  });

  it("recusa endereço inválido antes de provisionar", async () => {
    vi.stubEnv("APP_URL", "endereco-invalido");
    expect((await connectWhatsApp("empresa")).status).toBe("ERROR");
    expect(createInstance).not.toHaveBeenCalled();
  });

  it("não inicia pareamento se a configuração de recebimento falhar", async () => {
    profile.whatsappQrCode = "data:image/png;base64,QUJD";
    vi.mocked(setWebhook).mockRejectedValue(new Error("Webhook indisponível"));
    const state = await connectWhatsApp("empresa", "11999990000");
    expect(state.status).toBe("ERROR");
    expect(state.qrCode).toBeNull();
    expect(state.pairingCode).toBeNull();
    expect(connectInstance).not.toHaveBeenCalled();
    expect(deleteInstance).not.toHaveBeenCalled();
  });

  it("confirma conexão aberta somente após o webhook ser configurado", async () => {
    const state = await connectWhatsApp("empresa", "11999990000");
    expect(state.status).toBe("CONNECTED");
    expect(state.connectedAt).toBeTruthy();
    expect(setWebhook).toHaveBeenCalledTimes(1);
    expect(setWebhook).toHaveBeenCalledWith("nexora-empresa", "https://nexora.example/api/webhook/whatsapp?token=token-apenas-de-teste");
    expect(vi.mocked(setWebhook).mock.invocationCallOrder[0]).toBeLessThan(vi.mocked(connectInstance).mock.invocationCallOrder[0]);
    expect(deleteInstance).not.toHaveBeenCalled();
  });

  it("consulta física não apaga falha de recebimento de uma sessão existente", async () => {
    profile.whatsappInstance = "nexora-empresa";
    vi.mocked(setWebhook).mockRejectedValueOnce(new Error("Recebimento indisponível"));
    await connectWhatsApp("empresa");
    vi.mocked(getConnectionState).mockResolvedValue("open");
    const state = await refreshWhatsAppStatus("empresa");
    expect(state.status).toBe("ERROR");
    expect(getConnectionState).not.toHaveBeenCalled();
    expect(setWebhook).toHaveBeenCalledTimes(1);
    expect((await connectWhatsApp("empresa")).status).toBe("CONNECTED");
    expect(profile.whatsappError).toBeNull();
  });

  it.each([
    { state: "connecting", pairingCode: "ABCD1234", qrCode: null },
    { state: null, pairingCode: null, qrCode: "data:image/png;base64,QUJD" },
  ])("aguarda somente com código ou QR fornecido pelo gateway: %j", async (result) => {
    vi.mocked(connectInstance).mockResolvedValue(result);
    const state = await connectWhatsApp("empresa", "11999990000");
    expect(state.status).toBe("WAITING_QR");
    expect(state.pairingCode).toBe(result.pairingCode);
    expect(state.qrCode).toBe(result.qrCode);
    expect(createInstance).toHaveBeenCalledTimes(1);
    expect(connectInstance).toHaveBeenCalledTimes(1);
    expect(deleteInstance).not.toHaveBeenCalled();
  });

  it.each([
    { state: null, pairingCode: null, qrCode: null },
    { state: "connecting", pairingCode: null, qrCode: null },
    { state: "close", pairingCode: "2@codigo-bruto,invalido", qrCode: "data:image/" },
  ])("resultado sem evidência não apaga a sessão nem anuncia espera: %j", async (result) => {
    vi.mocked(connectInstance).mockResolvedValue(result);
    const state = await connectWhatsApp("empresa", "11999990000");
    expect(state.status).toBe("ERROR");
    expect(state.pairingCode).toBeNull();
    expect(state.qrCode).toBeNull();
    expect(createInstance).toHaveBeenCalledTimes(1);
    expect(connectInstance).toHaveBeenCalledTimes(1);
    expect(deleteInstance).not.toHaveBeenCalled();
  });
});
