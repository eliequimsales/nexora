#!/usr/bin/env node
/**
 * Smoke test do produto Nexora.
 *
 * Roda o fluxo crítico de ponta a ponta:
 *   1. healthz / readiness respondem
 *   2. registro de conta nova com checkbox LGPD
 *   3. organização tem niche=barbearia + lgpdAcceptedAt
 *   4. import CSV de 3 clientes
 *   5. lista de inativos retorna leads recém-importados (last visit antigo)
 *   6. preview-recovery gera mensagem com nome
 *   7. mark-sent-manually tira o lead da lista de inativos
 *   8. dashboard métricas atualizam
 *
 * Use:
 *   node scripts/smoke-test.mjs            # contra http://localhost:3001
 *   API_URL=https://api.nexora.com.br node scripts/smoke-test.mjs
 *
 * Exit code 0 = todos OK, 1 = algum passo falhou.
 */

const API_URL = process.env.API_URL ?? 'http://localhost:3001';
const API_PREFIX = '/api/v1';

// helpers ─────────────────────────────────────────────────────────────────────

let token = null;
let orgSlug = null;

function color(c, msg) {
  const codes = { red: 31, green: 32, yellow: 33, gray: 90 };
  return `\x1b[${codes[c] ?? 0}m${msg}\x1b[0m`;
}

function log(level, msg) {
  const tag = {
    pass: color('green', '✓'),
    fail: color('red', '✗'),
    info: color('gray', '·'),
    warn: color('yellow', '!'),
  }[level];
  console.log(`${tag} ${msg}`);
}

async function req(method, path, body, extraHeaders = {}) {
  const url = `${API_URL}${path.startsWith('/healthz') || path.startsWith('/readiness') ? '' : API_PREFIX}${path}`;
  const headers = { 'Content-Type': 'application/json', ...extraHeaders };
  if (token) headers.Authorization = `Bearer ${token}`;

  const res = await fetch(url, {
    method,
    headers,
    body: body ? JSON.stringify(body) : undefined,
  });
  const text = await res.text();
  let json;
  try {
    json = text ? JSON.parse(text) : null;
  } catch {
    json = text;
  }
  return { status: res.status, body: json };
}

async function step(name, fn) {
  try {
    await fn();
    log('pass', name);
  } catch (err) {
    log('fail', `${name} — ${err.message}`);
    process.exit(1);
  }
}

function assert(cond, msg) {
  if (!cond) throw new Error(msg);
}

// passos ──────────────────────────────────────────────────────────────────────

async function step1_health() {
  const { status, body } = await req('GET', '/healthz');
  assert(status === 200, `healthz retornou ${status}`);
  assert(body.status === 'ok', 'healthz não retornou status:ok');
}

async function step2_readiness() {
  const { status, body } = await req('GET', '/readiness');
  assert(status === 200, `readiness retornou ${status}`);
  assert(body.checks?.postgres === 'up', 'postgres não está up');
  assert(body.checks?.redis === 'up', 'redis não está up');
}

async function step3_register() {
  const email = `smoke-${Date.now()}@nexora.test`;
  const { status, body } = await req('POST', '/auth/register', {
    name: 'Smoke Tester',
    email,
    password: 'smoketest12345',
    orgName: `Barbearia Smoke ${Date.now()}`,
    niche: 'barbearia',
  });
  assert(status === 201 || status === 200, `register retornou ${status}: ${JSON.stringify(body)}`);
  assert(body.access_token, 'register não retornou access_token');
  assert(body.organization?.slug, 'register não retornou slug');
  token = body.access_token;
  orgSlug = body.organization.slug;
}

async function step4_lgpdAccept() {
  const { status, body } = await req('POST', '/organizations/current/lgpd-accept');
  assert(status === 200 || status === 201, `lgpd-accept retornou ${status}: ${JSON.stringify(body)}`);
  assert(body.acceptedAt, 'lgpd-accept não retornou acceptedAt');
}

async function step5_orgVerify() {
  const { status, body } = await req('GET', '/organizations/me');
  assert(status === 200, `org/me retornou ${status}`);
  assert(body.niche === 'barbearia', `niche errado: ${body.niche}`);
  assert(body.lgpdAcceptedAt, 'org não tem lgpdAcceptedAt');
}

async function step6_import() {
  // Cliente com última visita 60 dias atrás (vai aparecer como inativo)
  const oldDate = new Date(Date.now() - 60 * 24 * 60 * 60 * 1000);
  const csv = [
    'Nome,Telefone,Última Visita',
    `Cliente Smoke 1,11999990001,${oldDate.toISOString().split('T')[0]}`,
    `Cliente Smoke 2,11999990002,${oldDate.toISOString().split('T')[0]}`,
    `Cliente Smoke 3,11999990003,${oldDate.toISOString().split('T')[0]}`,
  ].join('\n');

  const { status, body } = await req('POST', '/leads/import', {
    csvContent: csv,
    dryRun: false,
  });
  assert(status === 200, `import retornou ${status}: ${JSON.stringify(body)}`);
  assert(body.importados === 3, `esperava importados=3, veio ${body.importados}`);
  assert(body.erros === 0, `esperava erros=0, veio ${body.erros}`);
}

let firstLeadId = null;

async function step7_inactiveList() {
  const { status, body } = await req('GET', '/leads/inactive?days=30');
  assert(status === 200, `inactive retornou ${status}`);
  assert(Array.isArray(body), `esperava array, veio ${typeof body}`);
  assert(body.length === 3, `esperava 3 inativos, veio ${body.length}`);
  firstLeadId = body[0].id;
}

async function step8_previewRecovery() {
  const { status, body } = await req('POST', `/leads/${firstLeadId}/preview-recovery`, {
    channel: 'whatsapp',
  });
  assert(status === 200, `preview retornou ${status}: ${JSON.stringify(body)}`);
  assert(body.message, 'preview não retornou message');
  assert(body.channel === 'whatsapp', `channel errado: ${body.channel}`);
  assert(body.recipient === '11999990001', `recipient errado: ${body.recipient}`);
  // Mensagem deve conter o nome do cliente (a IA tem que ter feito o seu trabalho)
  assert(
    body.message.toLowerCase().includes('smoke') ||
      body.message.toLowerCase().includes('cliente'),
    `mensagem parece genérica: ${body.message.substring(0, 80)}…`,
  );
}

async function step9_markSent() {
  const { status, body } = await req('POST', `/leads/${firstLeadId}/mark-sent-manually`, {
    channel: 'whatsapp',
    message: 'Mensagem de teste smoke',
  });
  assert(status === 200, `mark-sent retornou ${status}: ${JSON.stringify(body)}`);
  assert(body.success === true, 'mark-sent não retornou success:true');
}

async function step10_inactiveDecreased() {
  const { status, body } = await req('GET', '/leads/inactive?days=30');
  assert(status === 200);
  assert(body.length === 2, `esperava 2 inativos depois do mark-sent, veio ${body.length}`);
}

async function step11_confirmRecovery() {
  const { status, body } = await req('POST', `/leads/${firstLeadId}/confirm-recovery`, {
    value: 80.0,
  });
  assert(status === 200 || status === 201, `confirm-recovery retornou ${status}: ${JSON.stringify(body)}`);
  assert(body.recoveredValue === 80, `valor errado: ${body.recoveredValue}`);
}

async function step12_dashboardReflect() {
  const { status, body } = await req('GET', '/dashboard/nexora-metrics');
  assert(status === 200);
  assert(body.recovery.realRecoveredRevenue === 80, `dashboard não refletiu R\$80: ${body.recovery.realRecoveredRevenue}`);
  assert(body.recovery.confirmedRecoveriesThisMonth === 1, `contagem confirmados errada: ${body.recovery.confirmedRecoveriesThisMonth}`);
}

async function step13_optOutWebhook() {
  // Sem secret em dev é aceito. Marca cliente 2 como opt-out.
  const { status, body } = await req('POST', '/leads/webhooks/response', {
    channel: 'whatsapp',
    from: '11999990002',
    message: 'PARAR',
  });
  assert(status === 200, `webhook retornou ${status}: ${JSON.stringify(body)}`);
  assert(body.optedOut === true, `esperava optedOut:true, veio ${body.optedOut}`);
}

async function step14_optOutEnforced() {
  // Agora a lista de inativos deve ter 1 só (cliente 3) — cliente 1 confirmado, cliente 2 opted out
  const { status, body } = await req('GET', '/leads/inactive?days=30');
  assert(status === 200);
  assert(body.length === 1, `esperava 1 inativo (só o cliente 3), veio ${body.length}`);
}

// main ────────────────────────────────────────────────────────────────────────

async function main() {
  console.log(color('gray', `\nNexora smoke test → ${API_URL}\n`));
  await step('1. healthz', step1_health);
  await step('2. readiness (postgres + redis)', step2_readiness);
  await step('3. registrar conta nova', step3_register);
  await step('4. aceitar termo LGPD', step4_lgpdAccept);
  await step('5. verificar organização', step5_orgVerify);
  await step('6. importar 3 clientes via CSV', step6_import);
  await step('7. listar inativos (esperado: 3)', step7_inactiveList);
  await step('8. preview-recovery gera texto com IA', step8_previewRecovery);
  await step('9. mark-sent-manually registra envio fora do sistema', step9_markSent);
  await step('10. inativos caiu pra 2', step10_inactiveDecreased);
  await step('11. confirm-recovery vira receita real', step11_confirmRecovery);
  await step('12. dashboard reflete R$80 + 1 confirmado', step12_dashboardReflect);
  await step('13. webhook de opt-out marca cliente 2', step13_optOutWebhook);
  await step('14. opt-out remove cliente da lista de inativos', step14_optOutEnforced);

  console.log(color('green', '\n✓ Todos os passos passaram.'));
  console.log(color('gray', `Conta criada: ${orgSlug}\n`));
}

main().catch((err) => {
  console.error(color('red', `\n✗ Falha: ${err.message}\n`));
  process.exit(1);
});
