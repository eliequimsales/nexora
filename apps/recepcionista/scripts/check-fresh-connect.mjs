const baseUrl = (process.env.EVOLUTION_API_URL || "").replace(/\/+$/, "");
const apiKey = process.env.EVOLUTION_API_KEY;
const instance = "nexora-cmr6swe6z001ym7xu4lcxpxs7";

async function main() {
  const res = await fetch(`${baseUrl}/instance/connect/${instance}?number=5521966106737`, {
    headers: { apikey: apiKey },
  });
  const data = await res.json().catch(() => ({}));
  console.log("Connect response:", {
    state: data.instance?.state,
    count: data.count,
    hasBase64: !!(data.base64 || data.qrcode?.base64),
    pairingCode: data.pairingCode,
  });
}

main().catch(console.error);
