import { readFileSync } from "node:fs";
import { join } from "node:path";
import { describe, expect, it } from "vitest";
import { horarioDaEmpresa } from "@/lib/agenda/horario";
import { portaoDoPlantao } from "@/lib/plantao/portao";

/**
 * NADA RESPONDE SOZINHO SEM O DONO LIGAR.
 *
 * Conectar o WhatsApp para mandar a Onda ligava junto o atendente antigo, que
 * respondia qualquer mensagem, 24 horas. O portão é o que fecha essa porta: só
 * deixa responder com o Plantão ligado, a loja fechada e o dono fora da conversa.
 */

const RAIZ = join(__dirname, "..");
const HORARIO = horarioDaEmpresa([]); // seg–sex 8h–20h
const TERCA_22H = new Date("2026-09-23T01:00:00.000Z");
const TERCA_10H = new Date("2026-09-22T13:00:00.000Z");
const horasAntes = (h: number) => new Date(TERCA_22H.getTime() - h * 3_600_000);

const ctx = (p: Partial<Parameters<typeof portaoDoPlantao>[0]> = {}) => ({
  plantaoAtivo: true,
  horarios: HORARIO,
  donoAssumiuEm: null,
  agora: TERCA_22H,
  ...p,
});

describe("portaoDoPlantao", () => {
  it("desligado, nunca responde — nem de madrugada", () => {
    expect(portaoDoPlantao(ctx({ plantaoAtivo: false }))).toEqual({
      responde: false,
      motivo: "DESLIGADO",
    });
  });

  it("ligado e com a loja aberta, quem responde é o dono", () => {
    expect(portaoDoPlantao(ctx({ agora: TERCA_10H }))).toEqual({ responde: false, motivo: "ABERTO" });
  });

  it("ligado e com a loja fechada, responde", () => {
    expect(portaoDoPlantao(ctx())).toEqual({ responde: true });
  });

  it("o dono respondeu pelo celular há uma hora: silêncio", () => {
    expect(portaoDoPlantao(ctx({ donoAssumiuEm: horasAntes(1) }))).toEqual({
      responde: false,
      motivo: "DONO_ASSUMIU",
    });
  });

  it("passadas 12 horas, a conversa volta a ser do Plantão", () => {
    expect(portaoDoPlantao(ctx({ donoAssumiuEm: horasAntes(13) }))).toEqual({ responde: true });
  });

  it("desligado vale mais que qualquer outro motivo", () => {
    expect(portaoDoPlantao(ctx({ plantaoAtivo: false, donoAssumiuEm: horasAntes(1) }))).toEqual({
      responde: false,
      motivo: "DESLIGADO",
    });
  });

  it("entende expediente que vira a madrugada", () => {
    const bar = [{ day: 2, open: "18:00", close: "02:00", closed: false }];
    expect(portaoDoPlantao(ctx({ horarios: bar }))).toEqual({ responde: false, motivo: "ABERTO" });
  });
});

describe("onde o portão fica", () => {
  const semComentarios = (s: string) =>
    s.replace(/\/\*[\s\S]*?\*\//g, "").replace(/^\s*\/\/.*$/gm, "");
  const servico = semComentarios(readFileSync(join(RAIZ, "lib/conversation-service.ts"), "utf8"));

  it("a chave nasce desligada", () => {
    const schema = readFileSync(join(RAIZ, "prisma/schema.prisma"), "utf8");
    expect(schema).toMatch(/plantaoAtivo\s+Boolean\s+@default\(false\)/);
  });

  it("depois do PARAR, que vale a qualquer hora, e antes de qualquer resposta automática", () => {
    const parar = servico.indexOf("pediuParaParar(");
    const portao = servico.indexOf("portaoDoPlantao(");
    expect(parar).toBeGreaterThan(-1);
    expect(portao).toBeGreaterThan(parar);
    for (const resposta of ["matchesHandoffKeyword(", "matchQuickReply(", "await respondWithAi("]) {
      expect(servico.indexOf(resposta), resposta).toBeGreaterThan(portao);
    }
  });

  it("o portão usa o horário único e a hora em que o dono assumiu", () => {
    expect(servico).toMatch(/portaoDoPlantao\(\{[\s\S]{0,300}horarioDaEmpresa\(/);
    expect(servico).toMatch(/portaoDoPlantao\(\{[\s\S]{0,300}donoAssumiuEm/);
  });
});
