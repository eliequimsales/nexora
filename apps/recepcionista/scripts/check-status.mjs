const baseUrl = (process.env.EVOLUTION_API_URL || "").replace(/\/+$/, "");
const apiKey = process.env.EVOLUTION_API_KEY;
const instance = "nexora-cmr6swe6z001ym7xu4lcxpxs7";

async function main() {
  const res = await fetch(`${baseUrl}/instance/connectionState/${instance}`, {
    headers: { apikey: apiKey },
  });
  const data = await res.json().catch(() => ({}));
  console.log("Status atual da instância Nexora:", JSON.stringify(data));
}

main().catch(console.error);
