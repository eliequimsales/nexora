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
