import type { Config } from "tailwindcss";

const config: Config = {
  content: ["./app/**/*.{ts,tsx}", "./components/**/*.{ts,tsx}"],
  theme: {
    extend: {
      colors: {
        /**
         * A MARCA VEM DOS CARROSSÉIS, não o contrário.
         *
         * A landing nasceu verde-escura (#08201B) porque o produto era um
         * atendente de WhatsApp. O Instagram, que é de onde o tráfego vem,
         * sempre foi âmbar sobre preto neutro. Quem clicava no carrossel caía
         * numa página que não parecia a mesma empresa — e essa dissonância
         * derruba conversão sem aparecer em métrica nenhuma.
         *
         * Estes valores são os do design system dos carrosséis, ao pé da letra:
         * DARK_BG #0A0A0F · LIGHT_BG #FAF8F2 · BRAND #EAB308 · INK #14141C.
         * Verde some da marca e sobra só onde significa "deu certo".
         */
        night: {
          DEFAULT: "#0A0A0F", // fundo escuro, neutro — sem viés de matiz
          soft: "#14141C",
          line: "#26262F",
        },
        mist: "#F2F0EA", // branco quente, casa com o papel dos slides
        paper: {
          DEFAULT: "#FAF8F2",
          line: "#EDE7D8",
          ink: "#14141C",
          sub: "#7A756C",
        },
        leaf: {
          // Verde agora é só semântica de sucesso, nunca identidade.
          DEFAULT: "#34D399",
          dark: "#0E7A52",
        },
        amber: "#EAB308", // amarelo da marca, o mesmo dos carrosseis do Instagram
        "amber-deep": "#A37D06", // âmbar legível sobre papel claro
        // Painel — claro e limpo (a landing mantém o tema noturno)
        panel: {
          bg: "#F4F6F4",
          card: "#FFFFFF",
          ink: "#14231D",
          line: "#E3E8E4",
          sub: "#5A6B62",
        },
        // Bolhas autênticas do WhatsApp (modo escuro) para o demo do telefone
        wa: {
          frame: "#0B141A",
          in: "#202C33",
          out: "#005C4B",
        },
        // Funil público — o visual da Nexora antiga (apps/app), valores copiados
        // de lá. Só entra o que as telas antigas usavam. A fronteira é vigiada
        // por tests/tema-funil.test.ts: nx-* só no funil, o resto só fora dele.
        nx: {
          bg: "#0A0A0F",
          surface: "#111118",
          "surface-2": "#16161F",
          "surface-3": "#1C1C28",
          border: "#1E1E2E",
          "border-2": "#2A2A3A",
          gold: "#EAB308",
          amber: "#F59E0B",
          primary: "#F8F8FF",
          secondary: "#9494A8",
          muted: "#52526B",
          success: { DEFAULT: "#10B981", muted: "#10B98120" },
          error: { DEFAULT: "#EF4444", muted: "#EF444420" },
          warning: { DEFAULT: "#F59E0B", muted: "#F59E0B20" },
        },
      },
      fontFamily: {
        display: ["var(--font-display)", "system-ui", "sans-serif"],
        sans: ["var(--font-body)", "system-ui", "sans-serif"],
        mono: ["var(--font-mono)", "ui-monospace", "monospace"],
      },
      maxWidth: {
        page: "72rem",
      },
      boxShadow: {
        "nx-glow-sm": "0 0 20px -4px rgba(245, 158, 11, 0.2)",
        "nx-panel": "0 4px 24px rgba(0,0,0,0.5), 0 1px 4px rgba(0,0,0,0.3)",
      },
    },
  },
  plugins: [],
};

export default config;
