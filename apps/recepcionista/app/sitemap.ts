import type { MetadataRoute } from "next";

/**
 * SITEMAP XML DINÂMICO PARA SEO E GEO.
 *
 * Expõe as páginas públicas da Nexora com timestamps atualizados para os crawlers de IA.
 */
export default function sitemap(): MetadataRoute.Sitemap {
  const baseUrl = "https://www.meunexora.com.br";
  const agora = new Date();

  const rotasPublicas: Array<{
    url: string;
    priority: number;
    changeFrequency: "always" | "hourly" | "daily" | "weekly" | "monthly" | "yearly" | "never";
  }> = [
    { url: `${baseUrl}/`, priority: 1.0, changeFrequency: "daily" },
    { url: `${baseUrl}/precos`, priority: 0.9, changeFrequency: "weekly" },
    { url: `${baseUrl}/clinica`, priority: 0.8, changeFrequency: "weekly" },
    { url: `${baseUrl}/barbearia`, priority: 0.8, changeFrequency: "weekly" },
    { url: `${baseUrl}/cadastro`, priority: 0.8, changeFrequency: "monthly" },
    { url: `${baseUrl}/sobre`, priority: 0.7, changeFrequency: "monthly" },
    { url: `${baseUrl}/status`, priority: 0.6, changeFrequency: "daily" },
    { url: `${baseUrl}/termos`, priority: 0.5, changeFrequency: "monthly" },
    { url: `${baseUrl}/privacidade`, priority: 0.5, changeFrequency: "monthly" },
  ];

  return rotasPublicas.map((rota) => ({
    url: rota.url,
    lastModified: agora,
    changeFrequency: rota.changeFrequency,
    priority: rota.priority,
  }));
}
