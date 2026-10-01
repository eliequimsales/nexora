import { execFileSync } from "node:child_process";
import fs from "node:fs";
import path from "node:path";

function carregarEnv() {
  const envPath = "C:/Users/eli/Downloads/Documents/mcp-marketing/.env";
  if (!fs.existsSync(envPath)) {
    throw new Error(`Arquivo .env não encontrado em: ${envPath}`);
  }
  const content = fs.readFileSync(envPath, "utf-8");
  const env = {};
  for (const line of content.split("\n")) {
    const trimmed = line.trim();
    if (!trimmed || trimmed.startsWith("#")) continue;
    const match = trimmed.match(/^([^=]+)=(.*)$/);
    if (match) {
      const key = match[1].trim();
      let val = match[2].trim();
      if ((val.startsWith('"') && val.endsWith('"')) || (val.startsWith("'") && val.endsWith("'"))) {
        val = val.slice(1, -1);
      }
      env[key] = val;
    }
  }
  return env;
}

const env = carregarEnv();
const TOKEN = env.META_ACCESS_TOKEN;
const ACT_ID = env.META_AD_ACCOUNT_ID?.startsWith("act_")
  ? env.META_AD_ACCOUNT_ID
  : `act_${env.META_AD_ACCOUNT_ID}`;
const VERSION = env.META_API_VERSION ?? "v21.0";

if (!TOKEN || !ACT_ID) {
  console.error("ERRO: META_ACCESS_TOKEN ou META_AD_ACCOUNT_ID não configurados no .env");
  process.exit(1);
}

function queryMeta(endpoint, params = {}) {
  const query = new URLSearchParams({
    access_token: TOKEN,
    ...params,
  });
  const url = `https://graph.facebook.com/${VERSION}/${endpoint}?${query.toString()}`;
  try {
    const stdout = execFileSync("curl.exe", ["-s", url], {
      encoding: "utf-8",
      maxBuffer: 10 * 1024 * 1024,
    });
    return JSON.parse(stdout);
  } catch (err) {
    console.error(`Erro ao consultar Meta API em ${endpoint}:`, err.message);
    return null;
  }
}

function extrairMetricas(item) {
  if (!item) return null;
  const spend = parseFloat(item.spend ?? "0");
  const impressions = parseInt(item.impressions ?? "0", 10);
  const reach = parseInt(item.reach ?? "0", 10);
  const clicks = parseInt(item.clicks ?? "0", 10);
  const ctr = parseFloat(item.ctr ?? "0");
  const cpc = parseFloat(item.cpc ?? "0");
  const cpm = parseFloat(item.cpm ?? "0");

  let lpv = 0;
  let leads = 0;
  let completeReg = 0;
  let viewContent = 0;

  if (Array.isArray(item.actions)) {
    for (const a of item.actions) {
      if (a.action_type === "landing_page_view" || a.action_type === "omni_landing_page_view") {
        lpv = Math.max(lpv, parseInt(a.value ?? "0", 10));
      }
      if (a.action_type === "lead" || a.action_type === "offsite_conversion.fb_pixel_lead") {
        leads = Math.max(leads, parseInt(a.value ?? "0", 10));
      }
      if (a.action_type === "complete_registration" || a.action_type === "offsite_conversion.fb_pixel_complete_registration") {
        completeReg = Math.max(completeReg, parseInt(a.value ?? "0", 10));
      }
      if (a.action_type === "view_content" || a.action_type === "offsite_conversion.fb_pixel_view_content") {
        viewContent = Math.max(viewContent, parseInt(a.value ?? "0", 10));
      }
    }
  }

  const cpl = leads > 0 ? spend / leads : null;
  const taxaLpv = clicks > 0 ? (lpv / clicks) * 100 : 0;
  const taxaLead = lpv > 0 ? (leads / lpv) * 100 : 0;

  return {
    spend,
    impressions,
    reach,
    clicks,
    ctr,
    cpc,
    cpm,
    lpv,
    leads,
    completeReg,
    viewContent,
    cpl,
    taxaLpv,
    taxaLead,
  };
}

async function main() {
  const agora = new Date();
  console.log("======================================================================");
  console.log(`📡 PAINEL DE PERFORMANCE META ADS — NEXORA`);
  console.log(`⏰ Atualizado em: ${agora.toLocaleString("pt-BR", { timeZone: "America/Sao_Paulo" })} (Horário de Brasília)`);
  console.log("======================================================================\n");

  // 1. Hoje
  const resHoje = queryMeta(`${ACT_ID}/insights`, {
    date_preset: "today",
    fields: "spend,impressions,reach,clicks,cpc,cpm,ctr,actions,cost_per_action_type",
  });
  const hoje = extrairMetricas(resHoje?.data?.[0]);

  // 2. Ontem
  const resOntem = queryMeta(`${ACT_ID}/insights`, {
    date_preset: "yesterday",
    fields: "spend,impressions,reach,clicks,cpc,cpm,ctr,actions,cost_per_action_type",
  });
  const ontem = extrairMetricas(resOntem?.data?.[0]);

  // 3. Acumulado Geral
  const resTotal = queryMeta(`${ACT_ID}/insights`, {
    date_preset: "maximum",
    fields: "spend,impressions,reach,clicks,cpc,cpm,ctr,actions,cost_per_action_type",
  });
  const total = extrairMetricas(resTotal?.data?.[0]);

  // 4. Anúncios de Hoje
  const resAdsHoje = queryMeta(`${ACT_ID}/insights`, {
    date_preset: "today",
    level: "ad",
    fields: "ad_name,spend,impressions,reach,clicks,cpc,cpm,ctr,actions",
  });
  const adsHoje = (resAdsHoje?.data ?? []).map((ad) => ({
    name: ad.ad_name,
    ...extrairMetricas(ad),
  }));

  console.log("📊 [1] DESEMPENHO DE HOJE (01/10/2026):");
  if (hoje) {
    console.log(`• Gasto: R$ ${hoje.spend.toFixed(2)}`);
    console.log(`• Impressões: ${hoje.impressions} | Alcance: ${hoje.reach} pessoas`);
    console.log(`• Cliques no Link: ${hoje.clicks} | CTR: ${hoje.ctr.toFixed(2)}%`);
    console.log(`• CPC Médio: R$ ${hoje.cpc.toFixed(2)} | CPM: R$ ${hoje.cpm.toFixed(2)}`);
    console.log(`• LPVs (Páginas abertas): ${hoje.lpv} (${hoje.taxaLpv.toFixed(1)}% dos cliques carregaram)`);
    console.log(`• Leads Gerados: ${hoje.leads} ${hoje.cpl ? `(CPL: R$ ${hoje.cpl.toFixed(2)})` : "(Sem leads ainda hoje)"}`);
    console.log(`• Cadastros Concluídos: ${hoje.completeReg}`);
  } else {
    console.log("Nenhum dado registrado hoje até o momento.");
  }

  console.log("\n----------------------------------------------------------------------");
  console.log("🎯 [2] ANÚNCIOS ATIVOS HOJE:");
  if (adsHoje.length === 0) {
    console.log("Nenhum anúncio gastou verba hoje ainda.");
  } else {
    for (const ad of adsHoje) {
      console.log(`▶ Anúncio: "${ad.name}"`);
      console.log(`  Gasto: R$ ${ad.spend.toFixed(2)} | Cliques: ${ad.clicks} | CTR: ${ad.ctr.toFixed(2)}% | CPC: R$ ${ad.cpc.toFixed(2)}`);
      console.log(`  LPV: ${ad.lpv} | Leads: ${ad.leads} | Cadastros: ${ad.completeReg}`);
    }
  }

  console.log("\n----------------------------------------------------------------------");
  console.log("📅 [3] COMPARATIVO COM ONTEM (30/09/2026):");
  if (ontem) {
    console.log(`• Gasto ontem: R$ ${ontem.spend.toFixed(2)}`);
    console.log(`• Cliques: ${ontem.clicks} (CTR: ${ontem.ctr.toFixed(2)}% | CPC: R$ ${ontem.cpc.toFixed(2)})`);
    console.log(`• LPVs: ${ontem.lpv} (${ontem.taxaLpv.toFixed(1)}% carregamento)`);
    console.log(`• Leads ontem: ${ontem.leads} | Custo por Lead: R$ ${ontem.cpl ? ontem.cpl.toFixed(2) : "-"}`);
    console.log(`• Cadastros ontem: ${ontem.completeReg}`);
  }

  console.log("\n----------------------------------------------------------------------");
  console.log("📈 [4] CONSOLIDADO GERAL (TOTAL ACUMULADO):");
  if (total) {
    console.log(`• Investimento Total: R$ ${total.spend.toFixed(2)}`);
    console.log(`• Impressões Totais: ${total.impressions.toLocaleString("pt-BR")} | Alcance: ${total.reach.toLocaleString("pt-BR")}`);
    console.log(`• Cliques no Link: ${total.clicks} (CTR Médio: ${total.ctr.toFixed(2)}% | CPC Médio: R$ ${total.cpc.toFixed(2)})`);
    console.log(`• LPVs Totais: ${total.lpv} (${total.taxaLpv.toFixed(1)}% de retenção)`);
    console.log(`• Total de Leads: ${total.leads} | CPL Médio: R$ ${total.cpl ? total.cpl.toFixed(2) : "-"}`);
    console.log(`• Cadastros Totais: ${total.completeReg}`);
  }
  console.log("======================================================================\n");
}

main();
