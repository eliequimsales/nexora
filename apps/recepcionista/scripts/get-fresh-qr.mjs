import fs from "fs";

const baseUrl = (process.env.EVOLUTION_API_URL || "").replace(/\/+$/, "");
const apiKey = process.env.EVOLUTION_API_KEY;
const instance = "nexora-cmr6swe6z001ym7xu4lcxpxs7";

async function main() {
  const res = await fetch(`${baseUrl}/instance/connect/${instance}?number=5521966106737`, {
    headers: { apikey: apiKey },
  });
  const data = await res.json().catch(() => ({}));
  const qr = data.base64 || data.qrcode?.base64;
  if (!qr) {
    console.error("Nenhum QR retornado:", data);
    return;
  }
  console.log("QR_B64_START:" + qr + ":QR_B64_END");
}

main().catch(console.error);
