const baseUrl = (process.env.EVOLUTION_API_URL || "").replace(/\/+$/, "");
const apiKey = process.env.EVOLUTION_API_KEY;

async function main() {
  const res = await fetch(`${baseUrl}/instance/fetchInstances`, {
    headers: { apikey: apiKey },
  });
  const instances = await res.json().catch(() => []);
  console.log("=== TODAS AS INSTÂNCIAS NA EVOLUTION ===");
  if (Array.isArray(instances)) {
    for (const inst of instances) {
      console.log(`- Nome: ${inst.name || inst.instanceName || inst.instance?.instanceName}`);
      console.log(`  State: ${inst.connectionStatus || inst.state || inst.instance?.state}`);
      console.log(`  Phone: ${inst.ownerJid || inst.number || inst.instance?.ownerJid}`);
    }
  } else {
    console.log(JSON.stringify(instances, null, 2));
  }
}

main().catch(console.error);
