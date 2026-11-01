import { describe, expect, it } from "vitest";
import { idsDoPixel, pixelSemJavascript } from "@/lib/analytics/pixel-config";
describe("inicialização do Pixel existente", () => {
  it("deduplica IDs de múltiplas configurações", () => expect(idsDoPixel(["123456, 789012", "123456", undefined])).toEqual(["123456", "789012"]));
  it("impede inserir código ou atributos pelo identificador", () => {
    expect(idsDoPixel(["12345');alert(1);//", '<script>alert(1)</script>', "123456"])).toEqual(["123456"]);
    expect(pixelSemJavascript(['12345" onerror="alert(1)', "123456"])).not.toContain("onerror");
  });
  it("produz o fallback do noscript sem elemento de imagem gerenciado pelo React", () => {
    const html = pixelSemJavascript(["123456"]);
    expect(html).toContain("<img"); expect(html).toContain("id=123456&amp;ev=PageView&amp;noscript=1"); expect(html).toContain('style="display:none"');
  });
});
