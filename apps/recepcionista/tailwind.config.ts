import type { Config } from "tailwindcss";

const config: Config = {
  content: ["./app/**/*.{ts,tsx}", "./components/**/*.{ts,tsx}"],
  theme: {
    extend: {
      colors: {
        // Landing (turno da noite)
        night: {
          DEFAULT: "#08201B",
          soft: "#0D2E26",
          line: "#17453A",
        },
        mist: "#E9F2EC",
        leaf: {
          DEFAULT: "#2FE08B",
          dark: "#0C7A4D",
        },
        amber: "#EAB308", // amarelo da marca, o mesmo dos carrosseis do Instagram
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
      },
      fontFamily: {
        display: ["var(--font-display)", "system-ui", "sans-serif"],
        sans: ["var(--font-body)", "system-ui", "sans-serif"],
        mono: ["var(--font-mono)", "ui-monospace", "monospace"],
      },
      maxWidth: {
        page: "72rem",
      },
    },
  },
  plugins: [],
};

export default config;
