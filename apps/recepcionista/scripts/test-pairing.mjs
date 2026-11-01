const baseUrl = (process.env.EVOLUTION_API_URL || "").replace(/\/+$/, "");
const apiKey = process.env.EVOLUTION_API_KEY;
const instance = "nexora-cmr6swe6z001ym7xu4lcxpxs7";

async function main() {
  // Teste 1: connect com number
  const r1 = await fetch(`${baseUrl}/instance/connect/${instance}?number=5521966106737`, {
    headers: { apikey: apiKey },
  });
  const d1 = await r1.json().catch(() => ({}));
  console.log("R1:", { code: d1.code?.slice(0, 30), pairingCode: d1.pairingCode });

  // Teste 2: Se tem endpoint /instance/pairingCode
  const r2 = await fetch(`${baseUrl}/instance/pairingCode/${instance}?number=5521966106737`, {
    headers: { apikey: apiKey },
  });
  console.log("R2 status:", r2.status);
  if (r2.ok) {
    const d2 = await r2.json().catch(() => ({}));
    console.log("R2 data:", d2);
  }
}

main().catch(console.error);
