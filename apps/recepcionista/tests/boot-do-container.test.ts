import { readFileSync } from "node:fs";
import { join } from "node:path";
import { describe, expect, it } from "vitest";

/**
 * O QUE RODA A CADA BOOT EM PRODUÇÃO.
 *
 * O boot aplica o schema com `prisma db push`. Em 11/09/2026 alguém acrescentou
 * `--accept-data-loss` para vencer uma reclamação do push: esse flag autoriza o
 * Prisma a APAGAR coluna ou tabela sozinho, sem perguntar, toda vez que o
 * contêiner sobe — sobre a base de clientes de quem paga.
 *
 * Quando o push reclamar, a resposta é descobrir o porquê e resolver o motivo.
 * Este teste existe para que o atalho não volte em silêncio.
 */

const CMD = readFileSync(join(__dirname, "..", "Dockerfile"), "utf8")
  .split(/\r?\n/)
  .filter((l) => l.startsWith("CMD"))
  .join("\n");

describe("o comando de boot", () => {
  it("aplica o schema antes de subir o app", () => {
    expect(CMD).toContain("prisma db push");
    expect(CMD).toContain("pnpm start");
  });

  it("nunca autoriza perda de dado", () => {
    expect(CMD).not.toContain("--accept-data-loss");
    expect(CMD).not.toContain("--force-reset");
  });
});
