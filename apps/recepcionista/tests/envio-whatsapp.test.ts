import { readFileSync, readdirSync } from "node:fs";
import { join } from "node:path";
import { describe, expect, it } from "vitest";
import { atrasoDeDigitacao, AVISO_CONEXAO_PERDIDA, instanciaInexistente, servidorFora } from "@/lib/whatsapp/envio";

/**
 * TODO ENVIO DA NEXORA PASSA PELO REGISTRO.
 *
 * O WhatsApp devolve pelo webhook o eco de cada mensagem que a Nexora envia pelo
 * número do dono, com `fromMe` — igualzinho a uma mensagem que o dono digitou no
 * celular. Sem o id de cada envio registrado, o eco da resposta do Plantão
 * silenciaria o próprio Plantão, e o eco da Onda silenciaria a resposta do
 * cliente sumido.
 */

const RAIZ = join(__dirname, "..");
const semComentarios = (s: string) =>
  s.replace(/\/\*[\s\S]*?\*\//g, "").replace(/^\s*\/\/.*$/gm, "");
const leia = (rel: string) => semComentarios(readFileSync(join(RAIZ, rel), "utf8"));

function listar(dir: string): string[] {
  return readdirSync(join(RAIZ, dir), { withFileTypes: true }).flatMap((e) => {
    const rel = `${dir}/${e.name}`;
    if (e.isDirectory()) return listar(rel);
    return /\.tsx?$/.test(e.name) ? [rel] : [];
  });
}

describe("todo envio passa pelo registro", () => {
  it("só lib/whatsapp/envio.ts chama o cliente da Evolution direto", () => {
    const diretos = [...listar("app"), ...listar("lib"), ...listar("components")]
      .filter((f) => f !== "lib/whatsapp/envio.ts" && f !== "lib/whatsapp/evolution.ts")
      .filter((f) => /\bsendWhatsAppText\s*\(/.test(leia(f)));
    expect(diretos).toEqual([]);
  });

  it("o envio registra o id que a Evolution devolveu", () => {
    const envio = leia("lib/whatsapp/envio.ts");
    expect(envio).toMatch(/sendWhatsAppText\(/);
    expect(envio).toMatch(/envioWhatsApp\.create\(/);
  });

  it("o registro guarda só o id — nem texto, nem telefone", () => {
    const schema = readFileSync(join(RAIZ, "prisma/schema.prisma"), "utf8");
    const modelo = schema.match(/model EnvioWhatsApp \{([\s\S]*?)\n\}/)?.[1] ?? "";
    expect(modelo).toMatch(/messageId\s+String/);
    expect(modelo).toMatch(/@@unique\(\[instance, messageId\]\)/);
    const campos = modelo
      .split("\n")
      .filter((l) => /^\s+\w+\s+\w/.test(l))
      .map((l) => l.trim().split(/\s+/)[0]);
    expect(campos.sort()).toEqual(["criadoEm", "id", "instance", "messageId"]);
  });
});

describe("\"digitando…\" antes da resposta do Atendente", () => {
  // Resposta instantânea denuncia máquina e assusta; demorada perde o cliente.
  it("o atraso cresce com o tamanho do texto, entre 1 e 3 segundos", () => {
    expect(atrasoDeDigitacao("Oi!")).toBe(1000);
    expect(atrasoDeDigitacao("x".repeat(100))).toBe(2000);
    expect(atrasoDeDigitacao("x".repeat(2000))).toBe(3000);
    const curto = atrasoDeDigitacao("x".repeat(60));
    const medio = atrasoDeDigitacao("x".repeat(120));
    expect(medio).toBeGreaterThan(curto);
  });

  it("o atraso vai até o servidor do WhatsApp, que mostra o \"digitando…\"", () => {
    const envio = leia("lib/whatsapp/envio.ts");
    expect(envio).toMatch(/sendWhatsAppText\(instance, phone, text, opcoes\)/);
    const evolution = leia("lib/whatsapp/evolution.ts");
    expect(evolution).toMatch(/body: \{ number: phone, text, \.\.\.\(opcoes\?\.atrasoMs \? \{ delay: opcoes\.atrasoMs \} : \{\}\) \}/);
  });
});

describe("conexão que não existe mais no servidor", () => {
  const DE_PRODUCAO =
    'Evolution API respondeu 404 em /message/sendText/nexora-abc: {"status":404,"error":"Not Found","response":{"message":["The \\"nexora-abc\\" instance does not exist"]}}';

  it("é reconhecida pelo erro que aparece nos logs", () => {
    expect(instanciaInexistente(new Error(DE_PRODUCAO))).toBe(true);
  });

  it("outro 404, outro status ou valor que não é Error não se confundem com ela", () => {
    expect(
      instanciaInexistente(new Error('Evolution API respondeu 404 em /x: {"message":"number not found"}')),
    ).toBe(false);
    expect(
      instanciaInexistente(new Error("Evolution API respondeu 502 em /x: instance does not exist")),
    ).toBe(false);
    expect(instanciaInexistente("instance does not exist")).toBe(false);
  });

  it("marca a conexão como perdida, com um aviso que diz o que fazer", () => {
    const envio = leia("lib/whatsapp/envio.ts");
    expect(envio).toMatch(/instanciaInexistente\(\s*erro\s*\)/);
    expect(envio).toContain('whatsappStatus: "DISCONNECTED"');
    expect(AVISO_CONEXAO_PERDIDA).toMatch(/QR Code/);
  });
});

/**
 * SERVIDOR FORA NÃO É PROBLEMA DE CONVERSA.
 *
 * Em 15/09/2026 a Evolution respondia 502 e o worker tentava as mesmas conversas
 * a cada 5 minutos, para sempre. Além de soterrar o log, um 502 que chega DEPOIS
 * de a mensagem sair faria o cliente final receber o mesmo texto de novo a cada
 * rodada — o envio repetido que a Nexora promete não fazer.
 *
 * Falha do servidor vale para todas as conversas: a rodada do resgate para na
 * primeira. Erro de UMA conversa (número inválido, 4xx) segue conversa a conversa.
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
