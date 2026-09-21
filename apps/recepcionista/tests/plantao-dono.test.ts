import { readFileSync } from "node:fs";
import { join } from "node:path";
import { describe, expect, it } from "vitest";
import {
  ESPERA_DO_ECO_MS,
  registrarMensagemDoDono,
  type DependenciasDoDono,
} from "@/lib/plantao/dono";
import type { MensagemDoDono } from "@/lib/whatsapp/evolution";

/**
 * QUANDO O DONO RESPONDE PELO CELULAR, O PLANTÃO SAI DA CONVERSA.
 *
 * O difícil não é ver a mensagem do dono: é não confundir com o eco das
 * mensagens que a própria Nexora envia pelo número dele. Errar para um lado, o
 * Plantão se cala depois da própria resposta; para o outro, responde por cima do
 * dono. As dependências entram por parâmetro para o teste rodar sem banco.
 */

const RAIZ = join(__dirname, "..");
const AGORA = new Date("2026-09-22T01:00:00.000Z");

const msg = (p: Partial<MensagemDoDono> = {}): MensagemDoDono => ({
  instance: "nexora-abc",
  phone: "5511999998888",
  messageId: "3EB0X",
  enviadaEm: new Date(AGORA.getTime() - 5_000),
  ...p,
});

function falsas(opcoes: { nossosAntes?: string[]; nossosDepois?: string[]; empresa?: boolean } = {}) {
  const chamadas = { esperas: [] as number[], marcadas: [] as { phone: string; quando: Date }[] };
  let esperou = false;
  const deps: DependenciasDoDono = {
    ehEnvioDaNexora: async (_instance, id) =>
      (opcoes.nossosAntes ?? []).includes(id) || (esperou && (opcoes.nossosDepois ?? []).includes(id)),
    esperar: async (ms) => {
      chamadas.esperas.push(ms);
      esperou = true;
    },
    marcarQueODonoAssumiu: async (_instance, phone, quando) => {
      chamadas.marcadas.push({ phone, quando });
      return opcoes.empresa ?? true;
    },
  };
  return { deps, chamadas };
}

describe("registrarMensagemDoDono", () => {
  it("eco de um envio da Nexora é ignorado, sem esperar", async () => {
    const { deps, chamadas } = falsas({ nossosAntes: ["3EB0X"] });
    expect(await registrarMensagemDoDono(msg(), deps, AGORA)).toBe("ECO_DA_NEXORA");
    expect(chamadas.esperas).toEqual([]);
    expect(chamadas.marcadas).toEqual([]);
  });

  it("eco que chega antes de o envio ser registrado também é ignorado", async () => {
    const { deps, chamadas } = falsas({ nossosDepois: ["3EB0X"] });
    expect(await registrarMensagemDoDono(msg(), deps, AGORA)).toBe("ECO_DA_NEXORA");
    expect(chamadas.esperas).toEqual([ESPERA_DO_ECO_MS]);
    expect(chamadas.marcadas).toEqual([]);
  });

  it("mensagem digitada pelo dono marca que ele assumiu, na hora em que saiu", async () => {
    const { deps, chamadas } = falsas();
    const m = msg();
    expect(await registrarMensagemDoDono(m, deps, AGORA)).toBe("DONO_ASSUMIU");
    expect(chamadas.marcadas).toEqual([{ phone: "5511999998888", quando: m.enviadaEm }]);
  });

  it("sem horário da mensagem, usa agora", async () => {
    const { deps, chamadas } = falsas();
    await registrarMensagemDoDono(msg({ enviadaEm: null }), deps, AGORA);
    expect(chamadas.marcadas[0].quando).toEqual(AGORA);
  });

  it("sem id, não dá para ser eco: é o dono", async () => {
    const { deps, chamadas } = falsas();
    expect(await registrarMensagemDoDono(msg({ messageId: null }), deps, AGORA)).toBe("DONO_ASSUMIU");
    expect(chamadas.esperas).toEqual([]);
  });

  it("mensagem com mais de 10 minutos é sincronização de histórico, não o dono agora", async () => {
    const { deps, chamadas } = falsas();
    const velha = msg({ enviadaEm: new Date(AGORA.getTime() - 11 * 60_000) });
    expect(await registrarMensagemDoDono(velha, deps, AGORA)).toBe("ANTIGA");
    expect(chamadas.marcadas).toEqual([]);
  });

  it("conexão sem empresa não marca nada", async () => {
    const { deps } = falsas({ empresa: false });
    expect(await registrarMensagemDoDono(msg(), deps, AGORA)).toBe("SEM_EMPRESA");
  });
});

describe("o webhook e o banco", () => {
  const semComentarios = (s: string) =>
    s.replace(/\/\*[\s\S]*?\*\//g, "").replace(/^\s*\/\/.*$/gm, "");

  it("o webhook trata a mensagem do dono antes da mensagem do cliente", () => {
    const rota = semComentarios(readFileSync(join(RAIZ, "app/api/webhook/whatsapp/route.ts"), "utf8"));
    const dono = rota.indexOf("parseMensagemDoDono(");
    const cliente = rota.indexOf("parseWebhookPayload(");
    expect(dono).toBeGreaterThan(-1);
    expect(dono).toBeLessThan(cliente);
    expect(rota).toContain("registrarMensagemDoDono(");
  });

  it("a conversa guarda quando o dono assumiu", () => {
    const schema = readFileSync(join(RAIZ, "prisma/schema.prisma"), "utf8");
    const conversa = schema.match(/model Conversation \{([\s\S]*?)\n\}/)?.[1] ?? "";
    expect(conversa).toMatch(/donoAssumiuEm\s+DateTime\?/);
  });

  it("o dono guarda só telefone e hora — nunca o texto da mensagem dele", () => {
    const dono = semComentarios(readFileSync(join(RAIZ, "lib/plantao/dono.ts"), "utf8"));
    expect(dono).not.toMatch(/message\.create|content:/);
  });
});
