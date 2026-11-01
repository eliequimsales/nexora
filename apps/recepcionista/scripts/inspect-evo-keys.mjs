const baseUrl = (process.env.EVOLUTION_API_URL || "").replace(/\/+$/, "");
const apiKey = process.env.EVOLUTION_API_KEY;
const instance = "nexora-cmuylok24000032hqwf2xg9b4";

async function main() {
  const res = await fetch(`${baseUrl}/instance/connect/${instance}?number=5521966106737`, {
    headers: { apikey: apiKey },
  });
  const data = await res.json().catch(() => ({}));
  console.log("Keys retornadas pela Evolution:", Object.keys(data));
  console.log("pairingCode:", data.pairingCode);
  console.log("count:", data.count);
  console.log("code length:", data.code?.length);
  if (data.pairingCode) console.log("CÓDIGO:", data.pairingCode);
}

main().catch(console.error);
