import { readFileSync, readdirSync } from "node:fs";
import { join } from "node:path";
import { describe, expect, it } from "vitest";
import { AVISO_CONEXAO_PERDIDA, instanciaInexistente } from "@/lib/whatsapp/envio";

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
