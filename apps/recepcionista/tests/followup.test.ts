import { readFileSync } from "node:fs";
import { join } from "node:path";
import { describe, expect, it, vi } from "vitest";
import { isEligibleForFollowUp, runFollowUps, servidorFora } from "@/lib/followup";

const NOW = new Date("2026-07-01T18:00:00Z");
const hoursAgo = (h: number) => new Date(NOW.getTime() - h * 60 * 60 * 1000);

const base = {
  status: "AI",
  followUpCount: 0,
  maxFollowUps: 2,
  delayHours: 4,
  lastCustomerMessageAt: hoursAgo(5),
  lastFollowUpAt: null,
};

describe("isEligibleForFollowUp", () => {
  it("elegível: IA atendendo, cliente sumiu há mais tempo que o delay", () => {
    expect(isEligibleForFollowUp(base, NOW)).toBe(true);
  });

  it("não elegível: cliente respondeu há pouco", () => {
    expect(isEligibleForFollowUp({ ...base, lastCustomerMessageAt: hoursAgo(1) }, NOW)).toBe(false);
  });

  it("não elegível: atingiu o máximo de follow-ups", () => {
    expect(isEligibleForFollowUp({ ...base, followUpCount: 2 }, NOW)).toBe(false);
  });

  it("não elegível: conversa com humano ou finalizada", () => {
    expect(isEligibleForFollowUp({ ...base, status: "HUMAN" }, NOW)).toBe(false);
    expect(isEligibleForFollowUp({ ...base, status: "WAITING_HUMAN" }, NOW)).toBe(false);
    expect(isEligibleForFollowUp({ ...base, status: "FINISHED" }, NOW)).toBe(false);
  });

  it("não elegível: follow-up recente (respeita intervalo entre envios)", () => {
    expect(isEligibleForFollowUp({ ...base, lastFollowUpAt: hoursAgo(2) }, NOW)).toBe(false);
    expect(isEligibleForFollowUp({ ...base, lastFollowUpAt: hoursAgo(5) }, NOW)).toBe(true);
  });

  it("não elegível: conversa sem mensagem do cliente", () => {
    expect(isEligibleForFollowUp({ ...base, lastCustomerMessageAt: null }, NOW)).toBe(false);
  });
});

/**
 * O WORKER NÃO PODE ENCHER O LOG COM O MESMO ERRO DE CONFIGURAÇÃO.
 *
 * Sem gateway configurado, cada conversa elegível chamava `sendWhatsAppText`,
 * que lançava, e o catch de dentro do laço gravava uma linha em ErrorLog e
 * imprimia no console — por conversa, a cada 5 minutos, para sempre. Em
 * produção (12/09/2026) isso encheu o log com a mesma frase dezenas de vezes,
 * o que esconde o primeiro erro de verdade que aparecer.
 *
 * O problema é de configuração: ou vale para todas as conversas, ou para
 * nenhuma. Então a rodada inteira é pulada, sem tocar o banco, e o aviso sai
 * uma vez por processo.
 */
describe("runFollowUps com o WhatsApp sem servidor", () => {
  it("pula a rodada e avisa UMA vez, não a cada ciclo", async () => {
    const url = process.env.EVOLUTION_API_URL;
    const key = process.env.EVOLUTION_API_KEY;
    delete process.env.EVOLUTION_API_URL;
    delete process.env.EVOLUTION_API_KEY;
    const warn = vi.spyOn(console, "warn").mockImplementation(() => {});

    try {
      expect(await runFollowUps()).toBe(0);
      expect(await runFollowUps()).toBe(0);
      expect(warn).toHaveBeenCalledTimes(1);
      expect(String(warn.mock.calls[0][0])).toMatch(/lembretes parados/i);
    } finally {
      warn.mockRestore();
      if (url !== undefined) process.env.EVOLUTION_API_URL = url;
      if (key !== undefined) process.env.EVOLUTION_API_KEY = key;
    }
  });
});

/**
 * SERVIDOR FORA NÃO É PROBLEMA DE CONVERSA.
 *
 * Em 15/09/2026 a Evolution respondia 502 e o worker tentava as mesmas conversas
 * a cada 5 minutos, para sempre: a falha não era gravada, então a conversa
 * continuava elegível. Além de soterrar o log, um 502 que chega DEPOIS de a
 * mensagem sair faria o cliente final receber o mesmo texto de novo a cada
 * rodada — o disparo repetido que a Nexora promete não fazer.
 *
 * Falha do servidor vale para todas as conversas: a rodada para na primeira e o
 * erro é registrado uma vez por sequência de falhas. Erro de UMA conversa (número
 * inválido, 4xx) continua sendo tratado conversa a conversa.
 */
describe("servidorFora", () => {
  const daEvolution = (status: number) =>
    new Error(`Evolution API respondeu ${status} em /message/sendText/nexora-x: {"status":"error"}`);

  it("5xx da Evolution é o servidor, não a conversa", () => {
    for (const status of [500, 502, 503, 504]) {
      expect(servidorFora(daEvolution(status)), String(status)).toBe(true);
    }
  });

  it("nenhuma resposta (rede, DNS, recusa, tempo esgotado) também é o servidor", () => {
    expect(servidorFora(new TypeError("fetch failed"))).toBe(true);
    expect(servidorFora(new Error("connect ECONNREFUSED 10.0.0.1:443"))).toBe(true);
    expect(servidorFora(new Error("getaddrinfo ENOTFOUND evolution.internal"))).toBe(true);
    expect(servidorFora(new Error("The operation was aborted due to timeout"))).toBe(true);
  });

  it("4xx é problema daquela conversa: número inválido não para a rodada", () => {
    for (const status of [400, 401, 404, 422]) {
      expect(servidorFora(daEvolution(status)), String(status)).toBe(false);
    }
  });

  it("valor que não é Error não é tratado como queda", () => {
    expect(servidorFora("mensagem solta")).toBe(false);
    expect(servidorFora(undefined)).toBe(false);
  });
});

const RAIZ = join(__dirname, "..");

describe("runFollowUps para a rodada quando o servidor cai", () => {
  const fonte = readFileSync(join(RAIZ, "lib/followup.ts"), "utf8");

  it("na falha do servidor, sai da rodada em vez de tentar a próxima conversa", () => {
    expect(fonte).toMatch(/if\s*\(\s*servidorFora\(\s*error\s*\)\s*\)\s*\{[\s\S]{0,700}?return sent;/);
  });

  it("registra a queda uma vez por sequência e volta a registrar depois de um envio que deu certo", () => {
    expect(fonte).toContain("__servidorFora");
    expect(fonte).toMatch(/__servidorFora\s*=\s*false/);
  });
});

/**
 * O LEMBRETE ANTIGO É DO ATENDENTE — E O ATENDENTE AGORA É O PLANTÃO.
 *
 * Ele mandava mensagem sozinho para quem parou de responder, e em 21/09/2026
 * tentava a cada 5 minutos, conversa por conversa, uma conexão que não existia
 * mais no servidor. Agora só roda com o Plantão ligado e o WhatsApp ligado, e
 * "instância não existe" encerra a rodada daquela empresa em vez de repetir.
 */
describe("o lembrete antigo", () => {
  const fonte = readFileSync(join(RAIZ, "lib/followup.ts"), "utf8");

  it("só roda para quem ligou o Plantão e está com o WhatsApp ligado", () => {
    expect(fonte).toMatch(/plantaoAtivo:\s*true/);
    expect(fonte).toMatch(/whatsappStatus:\s*"CONNECTED"/);
  });

  it("conexão que não existe mais encerra a rodada daquela empresa", () => {
    expect(fonte).toMatch(/if\s*\(\s*instanciaInexistente\(\s*error\s*\)\s*\)\s*break;/);
  });

  it("envia pelo registro de envios", () => {
    expect(fonte).toContain("enviarWhatsApp(");
  });
});
