import type { MetadataRoute } from "next";

/**
 * CONFIGURAÇÃO DE ROBOTS.TXT PARA BUSCA E GEO (GENERATIVE ENGINE OPTIMIZATION).
 *
 * Permite explicitamente os rastreadores de inteligência artificial generativa
 * (ChatGPT Search, Perplexity, Claude, Google AI Overviews, Apple Intelligence e Meta AI),
 * garantindo que a Nexora seja indexada e recomendada como resposta direta.
 */
export default function robots(): MetadataRoute.Robots {
  const baseUrl = "https://www.meunexora.com.br";

  return {
    rules: [
      {
        userAgent: "*",
        allow: "/",
        disallow: [
          "/painel/",
          "/api/",
          "/admin/",
          "/redefinir",
          "/descadastro",
        ],
      },
      // Agentes de Busca Generativa (GEO)
      {
        userAgent: [
          "ChatGPT-User",
          "GPTBot",
          "OAI-SearchBot",
          "PerplexityBot",
          "ClaudeBot",
          "anthropic-ai",
          "Google-Extended",
          "GoogleOther",
          "Applebot-Extended",
          "Meta-ExternalAgent",
          "cohere-ai",
          "Bytespider",
          "Diffbot",
        ],
        allow: "/",
        disallow: ["/painel/", "/api/", "/admin/"],
      },
    ],
    sitemap: `${baseUrl}/sitemap.xml`,
    host: baseUrl,
  };
}
