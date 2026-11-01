import fs from 'fs';
import path from 'path';

const backupPath = path.resolve(process.cwd(), '../../backup_producao_completo.json');
const data = JSON.parse(fs.readFileSync(backupPath, 'utf8'));

console.log('Total de empresas:', data.totalEmpresas);

const stats = {
  profiles: 0,
  services: 0,
  knowledgeItems: 0,
  knowledgeGaps: 0,
  conversations: 0,
  customers: 0,
  appointments: 0,
  leads: 0,
  passes: 0
};

for (const c of data.companies) {
  if (c.profile) stats.profiles++;
  if (c.services?.length) stats.services += c.services.length;
  if (c.knowledgeItems?.length) stats.knowledgeItems += c.knowledgeItems.length;
  if (c.knowledgeGaps?.length) stats.knowledgeGaps += c.knowledgeGaps.length;
  if (c.conversations?.length) stats.conversations += c.conversations.length;
  if (c.customers?.length) stats.customers += c.customers.length;
  if (c.appointments?.length) stats.appointments += c.appointments.length;
  if (c.leads?.length) stats.leads += c.leads.length;
  if (c.passes?.length) stats.passes += c.passes.length;
}

console.log('Estatísticas do backup:', stats);
