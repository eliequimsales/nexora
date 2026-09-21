# Plantão, Fase 0 — plano de implementação

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Nada responde sozinho no WhatsApp do dono sem ele ligar o Plantão; o sistema passa a saber quando o dono assumiu uma conversa pelo celular; agenda e atendimento usam o mesmo horário; o lembrete antigo para de insistir em conexão que não existe.

**Architecture:** Uma chave `plantaoAtivo` (falsa por padrão) e um portão puro (`lib/plantao/portao.ts`) entram logo depois do PARAR em `handleIncomingMessage`. Todo envio passa por `enviarWhatsApp` (`lib/whatsapp/envio.ts`), que registra o id devolvido pela Evolution; é esse registro que separa o eco da Nexora da mensagem digitada pelo dono (`lib/plantao/dono.ts`). O horário mora em `lib/agenda/horario.ts`.

**Tech Stack:** Next.js 14.2 App Router, Prisma 5.22 (schema aplicado no boot com `prisma db push`), vitest 1.6 (pool forks), zod, pnpm 10.33.

**Spec:** `docs/superpowers/specs/2026-09-21-plantao-design.md`

## Global Constraints

- Caminhos relativos a `apps/recepcionista`, salvo quando começam em `docs/`. Comandos: `pnpm -C apps/recepcionista exec vitest run <arquivo>`, `pnpm -C apps/recepcionista exec tsc --noEmit`, `pnpm -C apps/recepcionista exec prisma generate`, a partir da raiz do monorepo.
- Branch: `feat/plantao-fase-0`. Nada vai para a `main`, para o GitHub ou para o Railway sem o dono autorizar, um passo por vez.
- Schema só aditivo, com padrão seguro. `--accept-data-loss` é proibido (`tests/boot-do-container.test.ts`).
- `plantaoAtivo` nasce `false`. A confirmação de PARAR continua saindo com o Plantão desligado.
- Números fixos: espera do eco **2.500 ms**; mensagem do dono mais velha que **10 minutos** é ignorada; silêncio depois de o dono assumir: **12 horas**.
- `HORARIO_PADRAO`: domingo fechado; segunda a sexta 08:00–20:00; sábado 08:00–19:00.
- Registro de envios guarda só `instance` e `messageId` — nem texto, nem telefone.
- Texto de tela em português de dono: as palavras de `tests/linguagem-do-painel.test.ts` (desconectado, instância, webhook, follow-up, handoff, toque, base…) não aparecem na tela de configurações.
- TDD: teste falhando antes de cada mudança de produção. Nunca ler nem imprimir `.env`.
- Commits em português sem acento, terminando com `Co-Authored-By: Claude Opus 5 <noreply@anthropic.com>`.

---

### Task 1: O horário da empresa num lugar só

**Files:**
- Create: `lib/agenda/horario.ts`
- Modify: `app/api/agendar/[slug]/route.ts` (apaga `HORARIOS_PADRAO` e `horariosDoPerfil`), `lib/conversation-service.ts` (apaga `asBusinessHours`), `app/painel/configuracoes/page.tsx` (`DEFAULT_HOURS` e a leitura do perfil)
- Test: `tests/horario-unico.test.ts`

**Interfaces:**
- Produces: `HORARIO_PADRAO: readonly Readonly<BusinessHour>[]`, `horarioDaEmpresa(valor: unknown): BusinessHour[]`, `semanaCompleta(horario: readonly BusinessHour[]): BusinessHour[]` — de `@/lib/agenda/horario`.

- [ ] **Step 1: Escrever o teste que falha** — `tests/horario-unico.test.ts`:

```ts
import { readFileSync } from "node:fs";
import { join } from "node:path";
import { describe, expect, it } from "vitest";
import { HORARIO_PADRAO, horarioDaEmpresa, semanaCompleta } from "@/lib/agenda/horario";
import { calcularSlots } from "@/lib/agenda/disponibilidade";
import { isOpenNow } from "@/lib/ai/prompt";

const RAIZ = join(__dirname, "..");
const semComentarios = (s: string) =>
  s.replace(/\/\*[\s\S]*?\*\//g, "").replace(/^\s*\/\/.*$/gm, "");
const leia = (rel: string) => semComentarios(readFileSync(join(RAIZ, rel), "utf8"));

// Terça, 22/09/2026, em Brasília (UTC-3).
const TERCA_22H = new Date("2026-09-23T01:00:00.000Z");
const TERCA_10H = new Date("2026-09-22T13:00:00.000Z");

describe("o horário da empresa", () => {
  it("sem horário cadastrado, vale o padrão da página de agendar", () => {
    expect(horarioDaEmpresa([])).toEqual(HORARIO_PADRAO);
    expect(horarioDaEmpresa(null)).toEqual(HORARIO_PADRAO);
    expect(horarioDaEmpresa("lixo")).toEqual(HORARIO_PADRAO);
  });

  it("o padrão tem os sete dias, com o domingo fechado", () => {
    expect(HORARIO_PADRAO.map((h) => h.day)).toEqual([0, 1, 2, 3, 4, 5, 6]);
    expect(HORARIO_PADRAO[0].closed).toBe(true);
    expect(HORARIO_PADRAO[6]).toMatchObject({ open: "08:00", close: "19:00", closed: false });
  });

  it("com horário cadastrado, vale o cadastrado", () => {
    const meu = [{ day: 2, open: "09:00", close: "19:00", closed: false }];
    expect(horarioDaEmpresa(meu)).toEqual(meu);
  });

  it("closed ausente é dia aberto, como a agenda sempre leu", () => {
    expect(horarioDaEmpresa([{ day: 2, open: "09:00", close: "19:00" }])).toEqual([
      { day: 2, open: "09:00", close: "19:00", closed: false },
    ]);
  });

  it("descarta entrada inválida e, se nada sobrar, volta ao padrão", () => {
    expect(horarioDaEmpresa([{ day: 9, open: "25:00", close: "x" }])).toEqual(HORARIO_PADRAO);
    expect(
      horarioDaEmpresa([{ day: 2, open: "09:00", close: "19:00", closed: false }, { day: "x" }]),
    ).toHaveLength(1);
  });

  it("devolve cópia: mexer no resultado não muda o padrão", () => {
    const h = horarioDaEmpresa([]);
    h[1].open = "03:00";
    expect(HORARIO_PADRAO[1].open).toBe("08:00");
  });

  it("a semana completa mostra como fechado o dia que não aparece", () => {
    const semana = semanaCompleta([{ day: 2, open: "09:00", close: "19:00", closed: false }]);
    expect(semana).toHaveLength(7);
    expect(semana[2]).toEqual({ day: 2, open: "09:00", close: "19:00", closed: false });
    expect(semana[3].closed).toBe(true);
  });
});

describe("agenda e atendimento concordam", () => {
  it("sem horário cadastrado, terça às 22h está fechado e às 10h está aberto", () => {
    const horas = horarioDaEmpresa([]);
    expect(isOpenNow(horas, TERCA_22H)).toBe(false);
    expect(isOpenNow(horas, TERCA_10H)).toBe(true);
  });

  it("e a página de agendar oferece exatamente o mesmo expediente", () => {
    const slots = calcularSlots({
      dia: new Date("2026-09-22T00:00:00.000Z"),
      horarios: horarioDaEmpresa([]),
      duracaoMin: 30,
      ocupados: [],
      agora: new Date("2026-09-21T12:00:00.000Z"),
    });
    expect(slots[0]).toBe("08:00");
    expect(slots.at(-1)).toBe("19:30");
  });
});

describe("ninguém inventa o próprio padrão", () => {
  it("a página de agendar lê o horário daqui", () => {
    const rota = leia("app/api/agendar/[slug]/route.ts");
    expect(rota).toContain("horarioDaEmpresa(");
    expect(rota).not.toContain("HORARIOS_PADRAO");
  });

  it("o atendimento lê o horário daqui", () => {
    const servico = leia("lib/conversation-service.ts");
    expect(servico).toContain("horarioDaEmpresa(");
    expect(servico).not.toMatch(/function asBusinessHours/);
  });

  it("a tela de configurações mostra o horário que vale de verdade", () => {
    const tela = leia("app/painel/configuracoes/page.tsx");
    expect(tela).toContain("HORARIO_PADRAO");
    expect(tela).toContain("horarioDaEmpresa(");
  });
});
```

- [ ] **Step 2: Rodar e ver falhar** — `pnpm -C apps/recepcionista exec vitest run tests/horario-unico.test.ts`. Esperado: FAIL, `Cannot find module '@/lib/agenda/horario'`.

- [ ] **Step 3: Implementar** — `lib/agenda/horario.ts`:

```ts
import type { BusinessHour } from "@/lib/validation";

/**
 * O HORÁRIO DA EMPRESA MORA NUM LUGAR SÓ.
 *
 * A página pública de agendar e o atendimento liam o mesmo campo
 * (`CompanyProfile.businessHours`), mas cada um inventava o próprio padrão para
 * quando ele estava vazio: a agenda assumia 8h às 20h, e o atendimento assumia
 * "sempre aberto". Com o Plantão — que só responde com a loja fechada —, esse
 * "sempre aberto" viraria "nunca atende", sem aviso nenhum.
 *
 * O padrão é o que a página pública já mostrava aos clientes, com os sete dias
 * explícitos para a tela de configurações exibir a semana como ela vale.
 *
 * Sem zod de propósito: a tela de configurações roda no navegador, e o schema
 * levaria a biblioteca inteira para o celular do dono.
 */
export const HORARIO_PADRAO: readonly Readonly<BusinessHour>[] = [
  { day: 0, open: "08:00", close: "20:00", closed: true },
  { day: 1, open: "08:00", close: "20:00", closed: false },
  { day: 2, open: "08:00", close: "20:00", closed: false },
  { day: 3, open: "08:00", close: "20:00", closed: false },
  { day: 4, open: "08:00", close: "20:00", closed: false },
  { day: 5, open: "08:00", close: "20:00", closed: false },
  { day: 6, open: "08:00", close: "19:00", closed: false },
];

/** A mesma regra de `businessHourSchema`: HH:MM de 00:00 a 23:59. */
const HORA = /^([01]\d|2[0-3]):[0-5]\d$/;

function lerDia(item: unknown): BusinessHour | null {
  if (typeof item !== "object" || item === null) return null;
  const { day, open, close, closed } = item as Record<string, unknown>;
  if (typeof day !== "number" || !Number.isInteger(day) || day < 0 || day > 6) return null;
  if (typeof open !== "string" || !HORA.test(open)) return null;
  if (typeof close !== "string" || !HORA.test(close)) return null;
  // `closed` ausente é dia aberto: é como a agenda e o isOpenNow sempre leram.
  return { day, open, close, closed: closed === true };
}

/**
 * O horário que vale para a empresa: o cadastrado, se tiver ao menos um dia
 * válido; senão, o padrão. Entrada inválida (o campo é Json) é descartada, e dia
 * que não aparece é dia fechado. Sempre devolve cópia: quem mexer no resultado
 * não mexe no padrão.
 */
export function horarioDaEmpresa(valor: unknown): BusinessHour[] {
  if (Array.isArray(valor)) {
    const validos = valor.map(lerDia).filter((d): d is BusinessHour => d !== null);
    if (validos.length > 0) return validos;
  }
  return HORARIO_PADRAO.map((h) => ({ ...h }));
}

/**
 * A semana inteira, dia por dia, para a tela de configurações: o dia que não
 * aparece no horário da empresa entra como fechado, em vez de sumir da tela.
 */
export function semanaCompleta(horario: readonly BusinessHour[]): BusinessHour[] {
  return Array.from({ length: 7 }, (_, day) => {
    const achado = horario.find((h) => h.day === day);
    return achado ? { ...achado } : { day, open: "08:00", close: "18:00", closed: true };
  });
}
```

Em `app/api/agendar/[slug]/route.ts`: tirar `type Horario` do import de `@/lib/agenda/disponibilidade`; importar `horarioDaEmpresa` de `@/lib/agenda/horario`; apagar `HORARIOS_PADRAO` e `horariosDoPerfil`; nos dois usos, `horarioDaEmpresa(negocio.profile?.businessHours)`.

Em `lib/conversation-service.ts`: apagar `asBusinessHours`; importar `horarioDaEmpresa` de `./agenda/horario`; `businessHours: horarioDaEmpresa(profile.businessHours)` nas respostas do cadastro e `const businessHours = horarioDaEmpresa(profile.businessHours);` em `respondWithAi`; o import de `./validation` fica só com `Faq`.

Em `app/painel/configuracoes/page.tsx`: importar `HORARIO_PADRAO`, `horarioDaEmpresa` e `semanaCompleta`; `const DEFAULT_HOURS: BusinessHour[] = HORARIO_PADRAO.map((h) => ({ ...h }));`; na leitura do perfil, `businessHours: semanaCompleta(horarioDaEmpresa(profile.businessHours)),`.

- [ ] **Step 4: Rodar e ver passar** — o mesmo comando, mais `tests/prompt.test.ts tests/quick-reply.test.ts tests/fase3-agenda-inteligente.test.ts`. Esperado: PASS.

- [ ] **Step 5: Commit** — `feat(agenda): horario da empresa num lugar so, lido por agenda e atendimento`.

---

### Task 2: Todo envio passa pelo registro

**Files:**
- Modify: `lib/whatsapp/evolution.ts` (`idDoEnvio`; `sendWhatsAppText` devolve `{ messageId }`), `prisma/schema.prisma` (modelo `EnvioWhatsApp`), `lib/conversation-service.ts`, `lib/followup.ts`, `app/api/agenda/lembrete/route.ts`, `app/api/conversations/[id]/messages/route.ts`, `app/api/onda/enviar/route.ts`, `tests/fase2-disparo-whatsapp.test.ts`
- Create: `lib/whatsapp/envio.ts`
- Test: `tests/evolution.test.ts` (acrescenta), `tests/envio-whatsapp.test.ts`

**Interfaces:**
- Produces: `idDoEnvio(resposta: unknown): string | null` e `sendWhatsAppText(instance, phone, text): Promise<{ messageId: string | null }>` em `@/lib/whatsapp/evolution`; `enviarWhatsApp(instance: string, phone: string, text: string): Promise<{ messageId: string | null }>`, `ehEnvioDaNexora(instance: string, messageId: string): Promise<boolean>`, `instanciaInexistente(erro: unknown): boolean`, `AVISO_CONEXAO_PERDIDA: string` em `@/lib/whatsapp/envio`.

- [ ] **Step 1: Escrever os testes que falham.** Em `tests/evolution.test.ts`, importar `idDoEnvio` e acrescentar:

```ts
describe("idDoEnvio", () => {
  it("lê o id que a Evolution devolve no envio", () => {
    expect(
      idDoEnvio({
        key: { remoteJid: "5511999998888@s.whatsapp.net", fromMe: true, id: "3EB0C431C26A1916E1" },
        status: "PENDING",
      }),
    ).toBe("3EB0C431C26A1916E1");
  });

  it("sem id reconhecível, devolve null em vez de inventar", () => {
    expect(idDoEnvio({})).toBeNull();
    expect(idDoEnvio(null)).toBeNull();
    expect(idDoEnvio({ key: { id: "" } })).toBeNull();
    expect(idDoEnvio({ key: { id: 42 } })).toBeNull();
  });
});
```

Criar `tests/envio-whatsapp.test.ts`:

```ts
import { readFileSync, readdirSync } from "node:fs";
import { join } from "node:path";
import { describe, expect, it } from "vitest";
import { AVISO_CONEXAO_PERDIDA, instanciaInexistente } from "@/lib/whatsapp/envio";

/**
 * TODO ENVIO DA NEXORA PASSA PELO REGISTRO.
 *
 * O WhatsApp devolve pelo webhook o eco de cada mensagem que a Nexora envia pelo
 * número do dono, com `fromMe` — igualzinho a uma mensagem que o dono digitou no
 * celular. Sem o id de cada envio registrado, o eco da resposta do Plantão
 * silenciaria o próprio Plantão, e o eco da Onda silenciaria a resposta do
 * cliente sumido.
 */

const RAIZ = join(__dirname, "..");
const semComentarios = (s: string) =>
  s.replace(/\/\*[\s\S]*?\*\//g, "").replace(/^\s*\/\/.*$/gm, "");
const leia = (rel: string) => semComentarios(readFileSync(join(RAIZ, rel), "utf8"));

function listar(dir: string): string[] {
  return readdirSync(join(RAIZ, dir), { withFileTypes: true }).flatMap((e) => {
    const rel = `${dir}/${e.name}`;
    if (e.isDirectory()) return listar(rel);
    return /\.tsx?$/.test(e.name) ? [rel] : [];
  });
}

describe("todo envio passa pelo registro", () => {
  it("só lib/whatsapp/envio.ts chama o cliente da Evolution direto", () => {
    const diretos = [...listar("app"), ...listar("lib"), ...listar("components")]
      .filter((f) => f !== "lib/whatsapp/envio.ts" && f !== "lib/whatsapp/evolution.ts")
      .filter((f) => /\bsendWhatsAppText\s*\(/.test(leia(f)));
    expect(diretos).toEqual([]);
  });

  it("o envio registra o id que a Evolution devolveu", () => {
    const envio = leia("lib/whatsapp/envio.ts");
    expect(envio).toMatch(/sendWhatsAppText\(/);
    expect(envio).toMatch(/envioWhatsApp\.create\(/);
  });

  it("o registro guarda só o id — nem texto, nem telefone", () => {
    const schema = readFileSync(join(RAIZ, "prisma/schema.prisma"), "utf8");
    const modelo = schema.match(/model EnvioWhatsApp \{([\s\S]*?)\n\}/)?.[1] ?? "";
    expect(modelo).toMatch(/messageId\s+String/);
    expect(modelo).toMatch(/@@unique\(\[instance, messageId\]\)/);
    const campos = modelo.split("\n").filter((l) => /^\s+\w+\s+\w/.test(l)).map((l) => l.trim().split(/\s+/)[0]);
    expect(campos.sort()).toEqual(["criadoEm", "id", "instance", "messageId"]);
  });
});

describe("conexão que não existe mais no servidor", () => {
  const DE_PRODUCAO =
    'Evolution API respondeu 404 em /message/sendText/nexora-abc: {"status":404,"error":"Not Found","response":{"message":["The \\"nexora-abc\\" instance does not exist"]}}';

  it("é reconhecida pelo erro que aparece nos logs", () => {
    expect(instanciaInexistente(new Error(DE_PRODUCAO))).toBe(true);
  });

  it("outro 404, outro status ou valor que não é Error não se confundem com ela", () => {
    expect(
      instanciaInexistente(new Error('Evolution API respondeu 404 em /x: {"message":"number not found"}')),
    ).toBe(false);
    expect(instanciaInexistente(new Error("Evolution API respondeu 502 em /x: instance does not exist"))).toBe(false);
    expect(instanciaInexistente("instance does not exist")).toBe(false);
  });

  it("marca a conexão como perdida, com um aviso que diz o que fazer", () => {
    const envio = leia("lib/whatsapp/envio.ts");
    expect(envio).toMatch(/instanciaInexistente\(\s*erro\s*\)/);
    expect(envio).toContain('whatsappStatus: "DISCONNECTED"');
    expect(AVISO_CONEXAO_PERDIDA).toMatch(/QR Code/);
  });
});
```

Em `tests/fase2-disparo-whatsapp.test.ts`, trocar `expect(rota).toContain("sendWhatsAppText");` por:

```ts
    // O envio passa pelo registro (lib/whatsapp/envio.ts): sem ele, o eco da
    // mensagem da Onda pareceria o dono respondendo pelo celular.
    expect(rota).toContain("enviarWhatsApp");
```

- [ ] **Step 2: Rodar e ver falhar** — `pnpm -C apps/recepcionista exec vitest run tests/evolution.test.ts tests/envio-whatsapp.test.ts tests/fase2-disparo-whatsapp.test.ts`. Esperado: FAIL (`idDoEnvio` e `@/lib/whatsapp/envio` não existem; a rota da Onda ainda chama `sendWhatsAppText`).

- [ ] **Step 3: Implementar.** Em `lib/whatsapp/evolution.ts`, trocar `sendWhatsAppText` por:

```ts
/**
 * O id que a Evolution dá à mensagem que acabou de sair. Sem ele, o eco dela no
 * webhook é indistinguível do dono digitando no celular.
 */
export function idDoEnvio(resposta: unknown): string | null {
  const id = (resposta as { key?: { id?: unknown } } | null)?.key?.id;
  return typeof id === "string" && id.trim() ? id.trim() : null;
}

/** Envia mensagem de texto pelo WhatsApp via Evolution API. Use `enviarWhatsApp`. */
export async function sendWhatsAppText(
  instance: string,
  phone: string,
  text: string,
): Promise<{ messageId: string | null }> {
  const resposta = await evoFetch(`/message/sendText/${encodeURIComponent(instance)}`, {
    method: "POST",
    body: { number: phone, text },
  });
  return { messageId: idDoEnvio(resposta) };
}
```

Em `prisma/schema.prisma`, depois de `Message`:

```prisma
// Mensagem que a PRÓPRIA Nexora enviou pelo WhatsApp do dono. O webhook devolve
// o eco dela com `fromMe`, igual a uma mensagem digitada pelo dono no celular;
// sem este registro, cada envio da Nexora pareceria o dono assumindo a conversa.
// Guarda só o id: nem texto, nem telefone.
model EnvioWhatsApp {
  id        String   @id @default(cuid())
  instance  String
  messageId String
  criadoEm  DateTime @default(now())

  @@unique([instance, messageId])
  @@index([criadoEm])
}
```

Rodar `pnpm -C apps/recepcionista exec prisma generate`.

Criar `lib/whatsapp/envio.ts`:

```ts
import { prisma } from "@/lib/db";
import { logError } from "@/lib/errors";
import { sendWhatsAppText } from "./evolution";

/**
 * TODO ENVIO DA NEXORA PASSA POR AQUI.
 *
 * O webhook devolve o eco de cada mensagem enviada pelo número do dono com
 * `fromMe`, do mesmo jeito que devolve uma mensagem que o dono digitou no
 * celular. Guardar o id de cada envio é o que permite separar as duas coisas
 * (lib/plantao/dono.ts). Por isso nenhum outro arquivo chama `sendWhatsAppText`
 * direto — tests/envio-whatsapp.test.ts trava isso.
 */
export async function enviarWhatsApp(
  instance: string,
  phone: string,
  text: string,
): Promise<{ messageId: string | null }> {
  try {
    const { messageId } = await sendWhatsAppText(instance, phone, text);
    if (messageId) {
      await prisma.envioWhatsApp.create({ data: { instance, messageId } }).catch(async (erro) => {
        // Id repetido é o mesmo envio registrado duas vezes: não é problema.
        if ((erro as { code?: string }).code !== "P2002") await logError("envio-registro", erro);
      });
    }
    return { messageId };
  } catch (erro) {
    if (instanciaInexistente(erro)) await marcarConexaoPerdida(instance);
    throw erro;
  }
}

/** O envio que chegou pelo webhook com este id saiu da própria Nexora? */
export async function ehEnvioDaNexora(instance: string, messageId: string): Promise<boolean> {
  const achado = await prisma.envioWhatsApp.findUnique({
    where: { instance_messageId: { instance, messageId } },
    select: { id: true },
  });
  return achado !== null;
}

/**
 * A conexão desta empresa não existe mais no servidor do WhatsApp.
 *
 * É o 404 que aparecia nos logs a cada 5 minutos: o servidor foi recriado e a
 * conexão antiga sumiu, mas o banco continuava dizendo "ligado". Não é problema
 * de uma conversa — vale para todas as mensagens daquela empresa.
 */
export function instanciaInexistente(erro: unknown): boolean {
  if (!(erro instanceof Error)) return false;
  return /Evolution API respondeu 404\b/.test(erro.message) && /instance does not exist/i.test(erro.message);
}

export const AVISO_CONEXAO_PERDIDA =
  "A ligação do seu WhatsApp com a Nexora caiu. Ligue de novo pelo QR Code para voltar a enviar.";

async function marcarConexaoPerdida(instance: string): Promise<void> {
  await prisma.companyProfile
    .updateMany({
      where: { whatsappInstance: instance },
      data: { whatsappStatus: "DISCONNECTED", whatsappError: AVISO_CONEXAO_PERDIDA, whatsappQrCode: null },
    })
    .catch(async (erro) => {
      await logError("envio-conexao-perdida", erro);
    });
}
```

Trocar `sendWhatsAppText` por `enviarWhatsApp` (import de `@/lib/whatsapp/envio`, ou `./whatsapp/envio` dentro de `lib/`) em: `lib/conversation-service.ts` (5 envios), `lib/followup.ts` (1), `app/api/agenda/lembrete/route.ts` (2), `app/api/conversations/[id]/messages/route.ts` (1), `app/api/onda/enviar/route.ts` (1). Em `lib/conversation-service.ts`, o `import { sendWhatsAppText, type IncomingWhatsAppMessage }` vira `import type { IncomingWhatsAppMessage } from "./whatsapp/evolution";` mais `import { enviarWhatsApp } from "./whatsapp/envio";`.

- [ ] **Step 4: Rodar e ver passar** — os três arquivos do Step 2 mais `tests/followup.test.ts tests/porta-lateral.test.ts`, e `pnpm -C apps/recepcionista exec tsc --noEmit`. Esperado: PASS e nenhum erro de tipo.

- [ ] **Step 5: Commit** — `feat(whatsapp): todo envio registra o id para separar o eco da nexora do dono`.

---

### Task 3: Ler a mensagem que sai do número do dono

**Files:**
- Modify: `lib/whatsapp/evolution.ts` (`messageTimestamp` no schema do webhook; `MensagemDoDono`; `parseMensagemDoDono`)
- Test: `tests/evolution.test.ts` (acrescenta)

**Interfaces:**
- Produces: `interface MensagemDoDono { instance: string; phone: string; messageId: string | null; enviadaEm: Date | null }` e `parseMensagemDoDono(payload: unknown): MensagemDoDono | null` em `@/lib/whatsapp/evolution`.

- [ ] **Step 1: Escrever o teste que falha** — importar `parseMensagemDoDono` e acrescentar:

```ts
describe("parseMensagemDoDono", () => {
  const doDono = (overrides: Record<string, unknown> = {}) =>
    basePayload({
      key: { remoteJid: "5511999998888@s.whatsapp.net", fromMe: true, id: "3EB0DONO" },
      messageTimestamp: 1790000000,
      ...overrides,
    });

  it("lê a mensagem que saiu do número do dono", () => {
    expect(parseMensagemDoDono(doDono())).toEqual({
      instance: "clinica-sorriso",
      phone: "5511999998888",
      messageId: "3EB0DONO",
      enviadaEm: new Date(1790000000 * 1000),
    });
  });

  it("foto e áudio também valem: o dono respondeu do mesmo jeito", () => {
    expect(parseMensagemDoDono(doDono({ message: { audioMessage: { seconds: 12 } } }))).not.toBeNull();
  });

  it("aceita o horário como texto e fica sem horário quando ele não vem", () => {
    expect(parseMensagemDoDono(doDono({ messageTimestamp: "1790000000" }))?.enviadaEm).toEqual(
      new Date(1790000000 * 1000),
    );
    expect(parseMensagemDoDono(doDono({ messageTimestamp: undefined }))?.enviadaEm).toBeNull();
  });

  it("mensagem do cliente não é do dono", () => {
    expect(parseMensagemDoDono(basePayload())).toBeNull();
  });

  it("ignora grupos, outros eventos e lixo", () => {
    expect(
      parseMensagemDoDono(doDono({ key: { remoteJid: "123@g.us", fromMe: true, id: "X" } })),
    ).toBeNull();
    expect(parseMensagemDoDono({ ...doDono(), event: "connection.update" })).toBeNull();
    expect(parseMensagemDoDono(null)).toBeNull();
  });

  it("o leitor das mensagens do cliente continua ignorando as do dono", () => {
    expect(parseWebhookPayload(doDono())).toBeNull();
  });
});
```

- [ ] **Step 2: Rodar e ver falhar** — `pnpm -C apps/recepcionista exec vitest run tests/evolution.test.ts`. Esperado: FAIL, `parseMensagemDoDono` não exportado.

- [ ] **Step 3: Implementar.** No `webhookSchema`, dentro de `data`, acrescentar `messageTimestamp: z.union([z.number(), z.string()]).optional(),`. Depois de `parseWebhookPayload`:

```ts
/** Mensagem que saiu do número do dono: digitada por ele ou eco de um envio da Nexora. */
export interface MensagemDoDono {
  instance: string;
  /** O cliente com quem o dono está falando. */
  phone: string;
  messageId: string | null;
  /** Quando a mensagem saiu, pelo relógio do WhatsApp. null quando não veio. */
  enviadaEm: Date | null;
}

function lerHorario(valor: unknown): Date | null {
  const segundos = typeof valor === "number" ? valor : typeof valor === "string" ? Number(valor) : NaN;
  return Number.isFinite(segundos) && segundos > 0 ? new Date(segundos * 1000) : null;
}

/**
 * A MENSAGEM QUE SAIU DO NÚMERO DO DONO.
 *
 * `parseWebhookPayload` descarta tudo que é `fromMe`, e por isso o sistema não
 * via quando o dono respondia pelo celular. Este leitor pega exatamente essas
 * mensagens — de qualquer tipo, porque responder com foto ou áudio também é o
 * dono assumindo. Ele não decide nada: a mesma entrada pode ser o dono
 * digitando ou o eco de um envio da própria Nexora, e quem separa uma coisa da
 * outra é lib/plantao/dono.ts.
 */
export function parseMensagemDoDono(payload: unknown): MensagemDoDono | null {
  const parsed = webhookSchema.safeParse(payload);
  if (!parsed.success) return null;

  const { event, instance, data } = parsed.data;
  if (event.toLowerCase().replace(/_/g, ".") !== "messages.upsert") return null;
  if (!data.key.fromMe) return null;

  const jid = data.key.remoteJid;
  if (!jid.endsWith("@s.whatsapp.net")) return null;

  const phone = jid.split("@")[0].replace(/\D/g, "");
  if (phone.length < 8) return null;

  return {
    instance,
    phone,
    messageId: data.key.id ?? null,
    enviadaEm: lerHorario(data.messageTimestamp),
  };
}
```

- [ ] **Step 4: Rodar e ver passar** — o mesmo comando. Esperado: PASS.

- [ ] **Step 5: Commit** — `feat(whatsapp): ler a mensagem que sai do numero do dono`.

---

### Task 4: Saber que o dono assumiu a conversa

**Files:**
- Modify: `prisma/schema.prisma` (`Conversation.donoAssumiuEm`), `app/api/webhook/whatsapp/route.ts`
- Create: `lib/plantao/dono.ts`
- Test: `tests/plantao-dono.test.ts`

**Interfaces:**
- Consumes: `MensagemDoDono`, `parseMensagemDoDono` (Task 3); `ehEnvioDaNexora` (Task 2).
- Produces: `ESPERA_DO_ECO_MS = 2_500`, `IDADE_MAXIMA_MS = 600_000`, `type DependenciasDoDono`, `type ResultadoDoDono = "ECO_DA_NEXORA" | "DONO_ASSUMIU" | "ANTIGA" | "SEM_EMPRESA"`, `registrarMensagemDoDono(msg: MensagemDoDono, deps: DependenciasDoDono, agora?: Date): Promise<ResultadoDoDono>`, `dependenciasReais: DependenciasDoDono` em `@/lib/plantao/dono`; `Conversation.donoAssumiuEm: Date | null`.

- [ ] **Step 1: Escrever o teste que falha** — `tests/plantao-dono.test.ts`:

```ts
import { readFileSync } from "node:fs";
import { join } from "node:path";
import { describe, expect, it } from "vitest";
import {
  ESPERA_DO_ECO_MS,
  registrarMensagemDoDono,
  type DependenciasDoDono,
} from "@/lib/plantao/dono";
import type { MensagemDoDono } from "@/lib/whatsapp/evolution";

/**
 * QUANDO O DONO RESPONDE PELO CELULAR, O PLANTÃO SAI DA CONVERSA.
 *
 * O difícil não é ver a mensagem do dono: é não confundir com o eco das
 * mensagens que a própria Nexora envia pelo número dele. Errar para um lado, o
 * Plantão se cala depois da própria resposta; para o outro, responde por cima do
 * dono. As dependências entram por parâmetro para o teste rodar sem banco.
 */

const RAIZ = join(__dirname, "..");
const AGORA = new Date("2026-09-22T01:00:00.000Z");

const msg = (p: Partial<MensagemDoDono> = {}): MensagemDoDono => ({
  instance: "nexora-abc",
  phone: "5511999998888",
  messageId: "3EB0X",
  enviadaEm: new Date(AGORA.getTime() - 5_000),
  ...p,
});

function falsas(opcoes: { nossosAntes?: string[]; nossosDepois?: string[]; empresa?: boolean } = {}) {
  const chamadas = { esperas: [] as number[], marcadas: [] as { phone: string; quando: Date }[] };
  let esperou = false;
  const deps: DependenciasDoDono = {
    ehEnvioDaNexora: async (_instance, id) =>
      (opcoes.nossosAntes ?? []).includes(id) || (esperou && (opcoes.nossosDepois ?? []).includes(id)),
    esperar: async (ms) => {
      chamadas.esperas.push(ms);
      esperou = true;
    },
    marcarQueODonoAssumiu: async (_instance, phone, quando) => {
      chamadas.marcadas.push({ phone, quando });
      return opcoes.empresa ?? true;
    },
  };
  return { deps, chamadas };
}

describe("registrarMensagemDoDono", () => {
  it("eco de um envio da Nexora é ignorado, sem esperar", async () => {
    const { deps, chamadas } = falsas({ nossosAntes: ["3EB0X"] });
    expect(await registrarMensagemDoDono(msg(), deps, AGORA)).toBe("ECO_DA_NEXORA");
    expect(chamadas.esperas).toEqual([]);
    expect(chamadas.marcadas).toEqual([]);
  });

  it("eco que chega antes de o envio ser registrado também é ignorado", async () => {
    const { deps, chamadas } = falsas({ nossosDepois: ["3EB0X"] });
    expect(await registrarMensagemDoDono(msg(), deps, AGORA)).toBe("ECO_DA_NEXORA");
    expect(chamadas.esperas).toEqual([ESPERA_DO_ECO_MS]);
    expect(chamadas.marcadas).toEqual([]);
  });

  it("mensagem digitada pelo dono marca que ele assumiu, na hora em que saiu", async () => {
    const { deps, chamadas } = falsas();
    const m = msg();
    expect(await registrarMensagemDoDono(m, deps, AGORA)).toBe("DONO_ASSUMIU");
    expect(chamadas.marcadas).toEqual([{ phone: "5511999998888", quando: m.enviadaEm }]);
  });

  it("sem horário da mensagem, usa agora", async () => {
    const { deps, chamadas } = falsas();
    await registrarMensagemDoDono(msg({ enviadaEm: null }), deps, AGORA);
    expect(chamadas.marcadas[0].quando).toEqual(AGORA);
  });

  it("sem id, não dá para ser eco: é o dono", async () => {
    const { deps, chamadas } = falsas();
    expect(await registrarMensagemDoDono(msg({ messageId: null }), deps, AGORA)).toBe("DONO_ASSUMIU");
    expect(chamadas.esperas).toEqual([]);
  });

  it("mensagem com mais de 10 minutos é sincronização de histórico, não o dono agora", async () => {
    const { deps, chamadas } = falsas();
    const velha = msg({ enviadaEm: new Date(AGORA.getTime() - 11 * 60_000) });
    expect(await registrarMensagemDoDono(velha, deps, AGORA)).toBe("ANTIGA");
    expect(chamadas.marcadas).toEqual([]);
  });

  it("conexão sem empresa não marca nada", async () => {
    const { deps } = falsas({ empresa: false });
    expect(await registrarMensagemDoDono(msg(), deps, AGORA)).toBe("SEM_EMPRESA");
  });
});

describe("o webhook e o banco", () => {
  const semComentarios = (s: string) =>
    s.replace(/\/\*[\s\S]*?\*\//g, "").replace(/^\s*\/\/.*$/gm, "");

  it("o webhook trata a mensagem do dono antes da mensagem do cliente", () => {
    const rota = semComentarios(readFileSync(join(RAIZ, "app/api/webhook/whatsapp/route.ts"), "utf8"));
    const dono = rota.indexOf("parseMensagemDoDono(");
    const cliente = rota.indexOf("parseWebhookPayload(");
    expect(dono).toBeGreaterThan(-1);
    expect(dono).toBeLessThan(cliente);
    expect(rota).toContain("registrarMensagemDoDono(");
  });

  it("a conversa guarda quando o dono assumiu", () => {
    const schema = readFileSync(join(RAIZ, "prisma/schema.prisma"), "utf8");
    const conversa = schema.match(/model Conversation \{([\s\S]*?)\n\}/)?.[1] ?? "";
    expect(conversa).toMatch(/donoAssumiuEm\s+DateTime\?/);
  });

  it("o dono guarda só telefone e hora — nunca o texto da mensagem dele", () => {
    const dono = semComentarios(readFileSync(join(RAIZ, "lib/plantao/dono.ts"), "utf8"));
    expect(dono).not.toMatch(/message\.create|content:/);
  });
});
```

- [ ] **Step 2: Rodar e ver falhar** — `pnpm -C apps/recepcionista exec vitest run tests/plantao-dono.test.ts`. Esperado: FAIL, `Cannot find module '@/lib/plantao/dono'`.

- [ ] **Step 3: Implementar.** Em `model Conversation`, depois de `lastFollowUpAt`:

```prisma
  // Quando o dono respondeu esta conversa pelo próprio celular. O Plantão fica
  // em silêncio depois disso (lib/plantao/portao.ts). Só a hora: nunca o texto.
  donoAssumiuEm DateTime?
```

Rodar `pnpm -C apps/recepcionista exec prisma generate`. Criar `lib/plantao/dono.ts`:

```ts
import { prisma } from "@/lib/db";
import type { MensagemDoDono } from "@/lib/whatsapp/evolution";
import { ehEnvioDaNexora } from "@/lib/whatsapp/envio";

/**
 * O DONO ASSUMIU A CONVERSA?
 *
 * Toda mensagem que sai do número do dono chega pelo webhook com `fromMe` — a
 * que ele digitou no celular e a que a Nexora enviou por ele. O registro de
 * envios (lib/whatsapp/envio.ts) separa as duas. Como o eco pode chegar antes
 * de o envio terminar de ser registrado, id desconhecido ganha uma segunda
 * conferência depois de ESPERA_DO_ECO_MS.
 */

export const ESPERA_DO_ECO_MS = 2_500;

/** Mais velha que isto, é o WhatsApp sincronizando histórico — não o dono agora. */
export const IDADE_MAXIMA_MS = 10 * 60_000;

export type DependenciasDoDono = {
  ehEnvioDaNexora: (instance: string, messageId: string) => Promise<boolean>;
  esperar: (ms: number) => Promise<void>;
  /** Marca a hora na conversa com esse telefone. false quando a conexão não é de empresa nenhuma. */
  marcarQueODonoAssumiu: (instance: string, phone: string, quando: Date) => Promise<boolean>;
};

export type ResultadoDoDono = "ECO_DA_NEXORA" | "DONO_ASSUMIU" | "ANTIGA" | "SEM_EMPRESA";

export async function registrarMensagemDoDono(
  msg: MensagemDoDono,
  deps: DependenciasDoDono,
  agora: Date = new Date(),
): Promise<ResultadoDoDono> {
  if (msg.enviadaEm && agora.getTime() - msg.enviadaEm.getTime() > IDADE_MAXIMA_MS) return "ANTIGA";

  if (msg.messageId) {
    if (await deps.ehEnvioDaNexora(msg.instance, msg.messageId)) return "ECO_DA_NEXORA";
    await deps.esperar(ESPERA_DO_ECO_MS);
    if (await deps.ehEnvioDaNexora(msg.instance, msg.messageId)) return "ECO_DA_NEXORA";
  }

  const marcou = await deps.marcarQueODonoAssumiu(msg.instance, msg.phone, msg.enviadaEm ?? agora);
  return marcou ? "DONO_ASSUMIU" : "SEM_EMPRESA";
}

export const dependenciasReais: DependenciasDoDono = {
  ehEnvioDaNexora,
  esperar: (ms) => new Promise((resolver) => setTimeout(resolver, ms)),
  async marcarQueODonoAssumiu(instance, phone, quando) {
    const perfil = await prisma.companyProfile.findUnique({
      where: { whatsappInstance: instance },
      select: { companyId: true },
    });
    if (!perfil) return false;

    // Cria a conversa quando o dono é quem começou: se o cliente responder às
    // 22h15 uma conversa que o dono abriu às 22h10, o Plantão precisa saber que
    // tem gente cuidando dela. Só telefone e hora — o texto do dono não é salvo.
    await prisma.conversation.upsert({
      where: { companyId_customerPhone: { companyId: perfil.companyId, customerPhone: phone } },
      create: { companyId: perfil.companyId, customerPhone: phone, donoAssumiuEm: quando },
      update: { donoAssumiuEm: quando },
    });
    return true;
  },
};
```

Em `app/api/webhook/whatsapp/route.ts`, importar `parseMensagemDoDono` de `@/lib/whatsapp/evolution` e `{ dependenciasReais, registrarMensagemDoDono }` de `@/lib/plantao/dono`, e entre o bloco do QR Code e o da mensagem do cliente:

```ts
    // Mensagem que saiu do número do dono: ele respondeu pelo celular, ou é o
    // eco de um envio da própria Nexora. lib/plantao/dono.ts separa os dois.
    const doDono = parseMensagemDoDono(payload);
    if (doDono) {
      await registrarMensagemDoDono(doDono, dependenciasReais);
      return NextResponse.json({ ok: true });
    }
```

- [ ] **Step 4: Rodar e ver passar** — `pnpm -C apps/recepcionista exec vitest run tests/plantao-dono.test.ts tests/evolution.test.ts` e `tsc --noEmit`. Esperado: PASS.

- [ ] **Step 5: Commit** — `feat(plantao): saber quando o dono assumiu a conversa pelo celular`.

---

### Task 5: A chave `plantaoAtivo` e o portão

**Files:**
- Modify: `prisma/schema.prisma` (`CompanyProfile.plantaoAtivo`), `lib/conversation-service.ts`
- Create: `lib/plantao/portao.ts`
- Test: `tests/plantao-portao.test.ts`

**Interfaces:**
- Consumes: `horarioDaEmpresa` (Task 1); `Conversation.donoAssumiuEm` (Task 4); `isOpenNow` de `@/lib/ai/prompt`.
- Produces: `JANELA_DO_DONO_MS = 43_200_000`, `type Silencio = "DESLIGADO" | "DONO_ASSUMIU" | "ABERTO"`, `type DecisaoDoPortao`, `portaoDoPlantao(ctx: { plantaoAtivo: boolean; horarios: BusinessHour[]; donoAssumiuEm: Date | null; agora: Date }): DecisaoDoPortao` em `@/lib/plantao/portao`; `CompanyProfile.plantaoAtivo: boolean`.

- [ ] **Step 1: Escrever o teste que falha** — `tests/plantao-portao.test.ts`:

```ts
import { readFileSync } from "node:fs";
import { join } from "node:path";
import { describe, expect, it } from "vitest";
import { horarioDaEmpresa } from "@/lib/agenda/horario";
import { portaoDoPlantao } from "@/lib/plantao/portao";

/**
 * NADA RESPONDE SOZINHO SEM O DONO LIGAR.
 *
 * Conectar o WhatsApp para mandar a Onda ligava junto o atendente antigo, que
 * respondia qualquer mensagem, 24 horas. O portão é o que fecha essa porta: só
 * deixa responder com o Plantão ligado, a loja fechada e o dono fora da conversa.
 */

const RAIZ = join(__dirname, "..");
const HORARIO = horarioDaEmpresa([]); // seg–sex 8h–20h
const TERCA_22H = new Date("2026-09-23T01:00:00.000Z");
const TERCA_10H = new Date("2026-09-22T13:00:00.000Z");
const horasAntes = (h: number) => new Date(TERCA_22H.getTime() - h * 3_600_000);

const ctx = (p: Partial<Parameters<typeof portaoDoPlantao>[0]> = {}) => ({
  plantaoAtivo: true,
  horarios: HORARIO,
  donoAssumiuEm: null,
  agora: TERCA_22H,
  ...p,
});

describe("portaoDoPlantao", () => {
  it("desligado, nunca responde — nem de madrugada", () => {
    expect(portaoDoPlantao(ctx({ plantaoAtivo: false }))).toEqual({ responde: false, motivo: "DESLIGADO" });
  });

  it("ligado e com a loja aberta, quem responde é o dono", () => {
    expect(portaoDoPlantao(ctx({ agora: TERCA_10H }))).toEqual({ responde: false, motivo: "ABERTO" });
  });

  it("ligado e com a loja fechada, responde", () => {
    expect(portaoDoPlantao(ctx())).toEqual({ responde: true });
  });

  it("o dono respondeu pelo celular há uma hora: silêncio", () => {
    expect(portaoDoPlantao(ctx({ donoAssumiuEm: horasAntes(1) }))).toEqual({
      responde: false,
      motivo: "DONO_ASSUMIU",
    });
  });

  it("passadas 12 horas, a conversa volta a ser do Plantão", () => {
    expect(portaoDoPlantao(ctx({ donoAssumiuEm: horasAntes(13) }))).toEqual({ responde: true });
  });

  it("desligado vale mais que qualquer outro motivo", () => {
    expect(portaoDoPlantao(ctx({ plantaoAtivo: false, donoAssumiuEm: horasAntes(1) }))).toEqual({
      responde: false,
      motivo: "DESLIGADO",
    });
  });

  it("entende expediente que vira a madrugada", () => {
    const bar = [{ day: 2, open: "18:00", close: "02:00", closed: false }];
    expect(portaoDoPlantao(ctx({ horarios: bar }))).toEqual({ responde: false, motivo: "ABERTO" });
  });
});

describe("onde o portão fica", () => {
  const semComentarios = (s: string) =>
    s.replace(/\/\*[\s\S]*?\*\//g, "").replace(/^\s*\/\/.*$/gm, "");
  const servico = semComentarios(readFileSync(join(RAIZ, "lib/conversation-service.ts"), "utf8"));

  it("a chave nasce desligada", () => {
    const schema = readFileSync(join(RAIZ, "prisma/schema.prisma"), "utf8");
    expect(schema).toMatch(/plantaoAtivo\s+Boolean\s+@default\(false\)/);
  });

  it("depois do PARAR, que vale a qualquer hora, e antes de qualquer resposta automática", () => {
    const parar = servico.indexOf("pediuParaParar(");
    const portao = servico.indexOf("portaoDoPlantao(");
    expect(parar).toBeGreaterThan(-1);
    expect(portao).toBeGreaterThan(parar);
    for (const resposta of ["matchesHandoffKeyword(", "matchQuickReply(", "await respondWithAi("]) {
      expect(servico.indexOf(resposta), resposta).toBeGreaterThan(portao);
    }
  });

  it("o portão usa o horário único e a hora em que o dono assumiu", () => {
    expect(servico).toMatch(/portaoDoPlantao\(\{[\s\S]{0,300}horarioDaEmpresa\(/);
    expect(servico).toMatch(/portaoDoPlantao\(\{[\s\S]{0,300}donoAssumiuEm/);
  });
});
```

- [ ] **Step 2: Rodar e ver falhar** — `pnpm -C apps/recepcionista exec vitest run tests/plantao-portao.test.ts`. Esperado: FAIL, `Cannot find module '@/lib/plantao/portao'`.

- [ ] **Step 3: Implementar.** Em `model CompanyProfile`, antes da conexão do WhatsApp:

```prisma
  // O Plantão: atendimento automático só com a loja fechada. Nasce DESLIGADO —
  // conectar o WhatsApp para mandar a Onda não liga resposta automática nenhuma.
  plantaoAtivo Boolean @default(false)
```

Rodar `pnpm -C apps/recepcionista exec prisma generate`. Criar `lib/plantao/portao.ts`:

```ts
import { isOpenNow } from "@/lib/ai/prompt";
import type { BusinessHour } from "@/lib/validation";

/**
 * O PORTÃO DO PLANTÃO.
 *
 * Decide se uma mensagem que acabou de chegar pode ter resposta automática. Só
 * pode com as três coisas juntas: o dono ligou o Plantão, a agenda diz que a
 * loja está fechada agora, e o dono não respondeu esta conversa pelo celular
 * nas últimas 12 horas. A Fase 1 troca essa janela pela duração do turno.
 *
 * `horarios` vem sempre de `horarioDaEmpresa`, que nunca devolve lista vazia —
 * com lista vazia, `isOpenNow` diria "aberto" e o Plantão nunca atenderia.
 */

export const JANELA_DO_DONO_MS = 12 * 60 * 60 * 1000;

export type Silencio = "DESLIGADO" | "DONO_ASSUMIU" | "ABERTO";
export type DecisaoDoPortao = { responde: true } | { responde: false; motivo: Silencio };

export function portaoDoPlantao(ctx: {
  plantaoAtivo: boolean;
  horarios: BusinessHour[];
  donoAssumiuEm: Date | null;
  agora: Date;
}): DecisaoDoPortao {
  if (!ctx.plantaoAtivo) return { responde: false, motivo: "DESLIGADO" };
  if (ctx.donoAssumiuEm && ctx.agora.getTime() - ctx.donoAssumiuEm.getTime() < JANELA_DO_DONO_MS) {
    return { responde: false, motivo: "DONO_ASSUMIU" };
  }
  if (isOpenNow(ctx.horarios, ctx.agora)) return { responde: false, motivo: "ABERTO" };
  return { responde: true };
}
```

Em `lib/conversation-service.ts`, importar `portaoDoPlantao` de `./plantao/portao` e, logo depois do bloco do PARAR (antes de "5. Equipe atendendo"):

```ts
    // 4.6 O PORTÃO DO PLANTÃO.
    //
    // Nada responde sozinho sem o dono ligar o Plantão, e o Plantão só fala com
    // a agenda fechada e com o dono fora da conversa. A mensagem do cliente já
    // foi salva acima: silêncio não é perder o que ele escreveu.
    const portao = portaoDoPlantao({
      plantaoAtivo: profile.plantaoAtivo,
      horarios: horarioDaEmpresa(profile.businessHours),
      donoAssumiuEm: conversation.donoAssumiuEm,
      agora: now,
    });
    if (!portao.responde) {
      logTiming(`silencio-${portao.motivo.toLowerCase()}`, startedAt);
      return;
    }
```

- [ ] **Step 4: Rodar e ver passar** — `tests/plantao-portao.test.ts tests/horario-unico.test.ts` e `tsc --noEmit`. Esperado: PASS.

- [ ] **Step 5: Commit** — `feat(plantao): nada responde sozinho sem o dono ligar o plantao`.

---

### Task 6: O lembrete antigo para de insistir

**Files:**
- Modify: `lib/followup.ts`
- Test: `tests/followup.test.ts` (acrescenta)

**Interfaces:**
- Consumes: `instanciaInexistente`, `enviarWhatsApp` (Task 2); `plantaoAtivo` (Task 5).

- [ ] **Step 1: Escrever o teste que falha** — em `tests/followup.test.ts`:

```ts
/**
 * O LEMBRETE ANTIGO É DO ATENDENTE — E O ATENDENTE AGORA É O PLANTÃO.
 *
 * Ele mandava mensagem sozinho para quem parou de responder, e em 21/09/2026
 * tentava a cada 5 minutos, conversa por conversa, uma conexão que não existia
 * mais no servidor. Agora só roda com o Plantão ligado e o WhatsApp ligado, e
 * "instância não existe" encerra a rodada daquela empresa em vez de repetir.
 */
describe("o lembrete antigo", () => {
  const fonte = readFileSync(join(RAIZ, "lib/followup.ts"), "utf8");

  it("só roda para quem ligou o Plantão e está com o WhatsApp ligado", () => {
    expect(fonte).toMatch(/plantaoAtivo:\s*true/);
    expect(fonte).toMatch(/whatsappStatus:\s*"CONNECTED"/);
  });

  it("conexão que não existe mais encerra a rodada daquela empresa", () => {
    expect(fonte).toMatch(/if\s*\(\s*instanciaInexistente\(\s*error\s*\)\s*\)\s*break;/);
  });

  it("envia pelo registro de envios", () => {
    expect(fonte).toContain("enviarWhatsApp(");
  });
});
```

- [ ] **Step 2: Rodar e ver falhar** — `pnpm -C apps/recepcionista exec vitest run tests/followup.test.ts`. Esperado: FAIL nas duas primeiras (o `enviarWhatsApp` já veio da Task 2).

- [ ] **Step 3: Implementar.** No `where` de `prisma.companyProfile.findMany` em `runFollowUps`, acrescentar `plantaoAtivo: true,` e `whatsappStatus: "CONNECTED",`. Importar `instanciaInexistente` de `./whatsapp/envio`. No `catch`, antes de `if (servidorFora(error))`:

```ts
        // A conexão desta empresa sumiu do servidor: vale para todas as conversas
        // dela. enviarWhatsApp já marcou o WhatsApp como não ligado, e a próxima
        // rodada nem chega aqui.
        if (instanciaInexistente(error)) break;
```

- [ ] **Step 4: Rodar e ver passar** — `tests/followup.test.ts`. Esperado: PASS, inclusive os testes antigos.

- [ ] **Step 5: Commit** — `fix(followup): lembrete antigo so com plantao ligado e sem insistir em conexao perdida`.

---

### Task 7: A tela de configurações para de prometer resposta sozinha

**Files:**
- Modify: `app/painel/configuracoes/page.tsx`
- Test: `tests/plantao-fase0-tela.test.ts`

- [ ] **Step 1: Escrever o teste que falha** — `tests/plantao-fase0-tela.test.ts`:

```ts
import { readFileSync } from "node:fs";
import { join } from "node:path";
import { describe, expect, it } from "vitest";

/**
 * A TELA NÃO PODE PROMETER O QUE O SISTEMA NÃO FAZ.
 *
 * Com o Plantão desligado por padrão, "Atendente online e atendendo" e "sua
 * atendente responde sozinha" viraram mentira no minuto em que a Fase 0 entrou.
 */

const RAIZ = join(__dirname, "..");
const tela = readFileSync(join(RAIZ, "app/painel/configuracoes/page.tsx"), "utf8");

describe("a tela de configurações", () => {
  it("não diz que a atendente está atendendo nem que responde sozinha", () => {
    expect(tela).not.toContain("Atendente online e atendendo");
    expect(tela).not.toMatch(/responde sozinha/i);
    expect(tela).not.toMatch(/a atendente não recebe nem responde nada/i);
  });

  it("diz, com todas as letras, que as respostas automáticas estão desligadas", () => {
    expect(tela).toMatch(/Respostas automáticas estão desligadas/);
  });

  it("com o WhatsApp conectado, o selo diz só que ele está ligado", () => {
    expect(tela).toMatch(/CONNECTED:\s*\{\s*label:\s*"WhatsApp ligado"/);
  });
});
```

- [ ] **Step 2: Rodar e ver falhar** — `pnpm -C apps/recepcionista exec vitest run tests/plantao-fase0-tela.test.ts`. Esperado: FAIL.

- [ ] **Step 3: Implementar.** Em `app/painel/configuracoes/page.tsx`:
  - `CONNECTED: { label: "WhatsApp ligado", bolinha: "bg-emerald-500" },`
  - `hint` do Passo 1: `"Sem este passo, a Nexora não consegue enviar as mensagens da Onda nem os lembretes da agenda pelo seu número."`
  - Caixa do `status === "CONNECTED"`:

```tsx
          <div className="rounded-xl border border-emerald-200 bg-emerald-50 p-4 text-sm text-emerald-800">
            <strong>Pronto.</strong> As mensagens da Onda e os lembretes da agenda já saem pelo
            seu número. Respostas automáticas estão desligadas: nada responde sozinho aos seus
            clientes até você ligar o Plantão.
          </div>
```

  - `hint` do Passo 2: `"Guarde aqui o que o seu atendimento precisa saber. Respostas automáticas estão desligadas: nada disto é enviado sozinho por enquanto."`

- [ ] **Step 4: Rodar e ver passar** — `tests/plantao-fase0-tela.test.ts tests/linguagem-do-painel.test.ts tests/fase2-disparo-whatsapp.test.ts`. Esperado: PASS.

- [ ] **Step 5: Commit** — `fix(configuracoes): tela para de prometer resposta automatica que esta desligada`.

---

### Task 8: Verificação completa

- [ ] **Step 1:** `pnpm -C apps/recepcionista exec vitest run` — suíte inteira verde.
- [ ] **Step 2:** `pnpm -C apps/recepcionista exec tsc --noEmit` — sem saída.
- [ ] **Step 3:** `pnpm -C apps/recepcionista run build` — `✓ Compiled successfully`, sem warning nem erro.
- [ ] **Step 4:** `git log --oneline main..` — um commit por task, todos no branch `feat/plantao-fase-0`.
