import path from "path";
import { defineConfig } from "vitest/config";

export default defineConfig({
  test: {
    environment: "node",
    include: ["tests/**/*.test.ts"],
    // Processos, e não threads. O cliente do Prisma carrega um motor nativo, e no
    // Windows várias threads com ele derrubavam o vitest inteiro com segmentation
    // fault no meio da suíte — sem resumo, sem dizer qual arquivo, só a queda.
    pool: "forks",
    // Fornece os segredos que as funcoes agora EXIGEM. Ver tests/setup.ts.
    setupFiles: ["tests/setup.ts"],
  },
  resolve: {
    alias: {
      "@": path.resolve(__dirname, "."),
    },
  },
});
