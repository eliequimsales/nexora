# Visual da Nexora antiga no funil público — desenho

- **Data:** 2026-09-10
- **Estado:** aprovado seção a seção com o dono; aguardando revisão deste documento
- **Onde:** `apps/recepcionista` (o produto vendido). A Nexora antiga é `apps/app`.
- **Sub-projeto 1 de 4** de "trazer a Nexora antiga para a base atual":
  **visual** → calculadora → diagnóstico → painel de recuperar.

## Por que

Os anúncios da Meta rodaram em cima da Nexora antiga. O dono quer o visual dela de
volta — Geist, hero centralizado, dourado com brilho, selos ✓ verdes — no lugar do
visual atual (Bricolage, faixas de papel). E o funil inteiro, da home até confirmar o
e-mail, precisa parecer uma empresa só: hoje o login é claro, recuperar e redefinir
são escuros e o verificar é papel.

## Decisões

| Pergunta | Decisão |
|---|---|
| Direção | Visual da Nexora antiga, na ordem dela: hero centralizado → a conta → "E é aqui que esses clientes aparecem" com a lista da Onda |
| Alcance | Funil público, 7 telas (§1) |
| Caminho | Tema próprio do funil: família de tokens nova + Geist num componente; nenhum arquivo muda de lugar |

## 1. Alcance

| Rota | Arquivos |
|---|---|
| `/` | `app/page.tsx` |
| `/diagnostico` | `app/diagnostico/page.tsx`, `app/diagnostico/painel.tsx`, `components/diagnostico/tres-nomes.tsx`, `components/acao-convite.tsx` |
| `/cadastro` | `app/cadastro/page.tsx`, `components/google-button.tsx` |
| `/login` | `app/login/page.tsx`, `components/google-button.tsx` |
| `/recuperar` | `app/recuperar/page.tsx` |
| `/redefinir` | `app/redefinir/page.tsx` |
| `/verificar` | `app/verificar/page.tsx` |

`components/funil.tsx` (medição do funil, sem visual) é importado pelo diagnóstico e
entra na lista de arquivos do funil por causa da trava de imports (§5).

Recuperar, redefinir e verificar entram porque estão no caminho: login → recuperar →
login, redefinir → recuperar, e verificar é o fim do cadastro.

**Não mudam:** `/painel/*`; `/agendar/[slug]` (quem abre é o cliente do empresário);
`/termos`, `/privacidade` e `/operador` (fundo papel, bom para leitura longa);
`/descadastro`; `app/error.tsx` e `app/not-found.tsx` (valem para o site todo,
inclusive o painel).

Nenhum componente do funil é usado fora dele, e o funil não usa componente de fora —
conferido nos imports em 2026-09-10.

## 2. Tema

### 2.1 Cores — família `nx` em `tailwind.config.ts`

Valores copiados de `apps/app/tailwind.config.ts`. Entram só os que as telas antigas de
home, diagnóstico, login e cadastro usam (35 classes distintas, contadas).

| Classe | Valor | Na antiga |
|---|---|---|
| `nx-bg` | `#0A0A0F` | `brand-bg` |
| `nx-surface` | `#111118` | `brand-surface` |
| `nx-surface-2` | `#16161F` | `brand-surface-2` |
| `nx-surface-3` | `#1C1C28` | `brand-surface-3` |
| `nx-border` | `#1E1E2E` | `brand-border` |
| `nx-border-2` | `#2A2A3A` | `brand-border-2` |
| `nx-gold` | `#EAB308` | `brand-gold` |
| `nx-amber` | `#F59E0B` | `brand-amber` |
| `nx-primary` | `#F8F8FF` | `text-primary` |
| `nx-secondary` | `#9494A8` | `text-secondary` |
| `nx-muted` | `#52526B` | `text-muted` |
| `nx-success`, `nx-success-muted` | `#10B981`, `#10B98120` | `status-success`, `status-success-muted` |
| `nx-error`, `nx-error-muted` | `#EF4444`, `#EF444420` | `status-error`, `status-error-muted` |
| `nx-warning`, `nx-warning-muted` | `#F59E0B`, `#F59E0B20` | `status-warning`, `status-warning-muted` |

Sombras (`boxShadow`):

- `nx-glow-sm`: `0 0 20px -4px rgba(245, 158, 11, 0.2)` — o brilho do botão
- `nx-panel`: `0 4px 24px rgba(0,0,0,0.5), 0 1px 4px rgba(0,0,0,0.3)`

Ficam de fora: roxo, `sidebar`, os utilitários de CSS da antiga (`glass`,
`text-gradient-amber`, `border-ai`, `skeleton`, `row-hover`, `card-interactive`…) e as
animações — nenhuma das 7 telas usa. Os tokens atuais (`night`, `mist`, `paper`,
`panel`, `amber`, `amber-deep`, `leaf`, `wa`) continuam no config: painel, jurídico e
agendamento dependem deles.

Os nomes espelham os da antiga (`brand-gold` → `nx-gold`, `text-text-muted` →
`text-nx-muted`) para que os sub-projetos 2 a 4 portem componentes antigos trocando o
prefixo.

### 2.2 Fonte

- Dependência nova: `geist@^1.7.0` em `apps/recepcionista/package.json` — a mesma que
  `apps/app` já usa com Next 14.2. O `pnpm-lock.yaml` atualizado vai no mesmo commit.
- O pacote usa `next/font/local`: a fonte é servida pelo próprio site, então o CSP
  (`font-src 'self' data:`) não muda.

### 2.3 `components/tema-nexora.tsx`

```tsx
import { GeistSans } from "geist/font/sans";
import { GeistMono } from "geist/font/mono";

export function TemaNexora({ children }: { children: React.ReactNode }) {
  return (
    <div
      className={`${GeistSans.variable} ${GeistMono.variable} tema-nx min-h-screen bg-nx-bg text-nx-primary antialiased`}
    >
      {children}
    </div>
  );
}
```

Em `app/globals.css`, fora de qualquer `@layer`:

```css
/* Funil público no visual da Nexora antiga. As classes font-sans, font-mono e
   font-display do Tailwind leem estas variáveis; redefinidas aqui, tudo dentro
   do funil vira Geist sem trocar classe nenhuma. */
.tema-nx {
  --font-body: var(--font-geist-sans), system-ui, sans-serif;
  --font-display: var(--font-geist-sans), system-ui, sans-serif;
  --font-mono: var(--font-geist-mono), ui-monospace, monospace;
  font-family: var(--font-body);
}
.tema-nx ::selection {
  background-color: rgba(245, 158, 11, 0.2);
}
.tema-nx :focus-visible {
  outline-color: rgba(245, 158, 11, 0.6);
}
```

### 2.4 Onde o tema entra

- **Seis `layout.tsx` novos**, um em cada pasta: `app/diagnostico/`, `app/cadastro/`,
  `app/login/`, `app/recuperar/`, `app/redefinir/`, `app/verificar/`. Cada um só
  devolve `<TemaNexora>{children}</TemaNexora>`. Login, cadastro, recuperar e redefinir
  são `"use client"`: importado dentro delas, o tema iria junto no código enviado ao
  navegador. O layout de servidor ao lado evita isso e aplica o tema do mesmo jeito
  nas seis rotas.
- **A home embrulha o próprio conteúdo**, porque o layout de `/` é o raiz,
  compartilhado com o site todo.
- Nenhum `page.tsx` muda de caminho: os testes que leem arquivo por caminho
  (`promessas-da-landing`, `formas-pagamento`, `legal`, `contato`, `declaracao`)
  seguem valendo.

### 2.5 Fontes atuais sem pré-carregamento

Em `app/layout.tsx`, `preload: false` em `Bricolage_Grotesque`, `Instrument_Sans` e
`IBM_Plex_Mono`. O navegador só baixa uma fonte quando algum texto a usa, então o funil
deixa de baixá-las. Painel e jurídico continuam idênticos; a fonte deles pode piscar
uma fração de segundo no primeiro acesso.

## 3. Home (`app/page.tsx`)

De cima para baixo:

1. **Topo fixo ao rolar** (`sticky`). `N` num quadrado `bg-nx-gold` + "Nexora". À
   direita, "Entrar" (`/login`) e o botão "Ver meus clientes →" (`/diagnostico`). Sem
   os links "Como funciona" e "Preço".
2. **Hero centralizado**, com o texto da antiga:
   - Título: "Seus clientes não avisam que estão indo embora." e, em `text-nx-gold`,
     "Eles só param de voltar."
   - Subtítulo: "A Nexora mostra quem parou de comprar, quanto dinheiro isso
     representa e a mensagem exata pra trazer cada um de volta."
   - Botão principal "Descobrir meus clientes →" → `/diagnostico`, dourado com
     `shadow-nx-glow-sm`. Na antiga ia para o cadastro; aqui vai para o diagnóstico,
     que é a prova.
   - Botão secundário "Ver como funciona" → `#como-funciona`, contornado com
     `border-nx-border`.
   - Selos, cada um com ✓ em `text-nx-success`: Grátis pra começar · Sem cartão · Sem
     integração · Funciona com planilha.
3. **A conta que ninguém faz.** Sobretítulo "A conta que ninguém faz" em
   `text-nx-gold`, caixa alta. Embaixo, o parágrafo que hoje é o ATO 2: "Faz a conta
   agora: quantos clientes te mandaram mensagem no ano passado e nunca mais voltaram?
   Multiplica pelo seu ticket médio. Esse número já foi seu uma vez." — a última frase
   em `text-nx-gold`. Nesta etapa o bloco **não** tem `id="calculadora"` nem promete
   "a resposta aparece na hora": isso chega com a calculadora (sub-projeto 2).
4. **E é aqui que esses clientes aparecem.** Título centralizado e um cartão
   `rounded-xl border border-nx-border bg-nx-surface shadow-nx-glow-sm`:
   - Cabeçalho: "Onda de segunda", selo "exemplo" e "{TAMANHO_DA_ONDA} clientes · ~9
     min", com o número vindo de `lib/recuperacao/onda`.
   - Linhas: Marcos — vinha a cada 28 dias · sumiu há 64; Dona Cida — vinha a cada 35
     dias · sumiu há 90; Júnior — vinha a cada 21 dias · sumiu há 45.
   - "Mandar" é um `<span>` com cara de etiqueta, não `<button>` nem `<a>`.
5. **Como funciona** (`id="como-funciona"`, faixa `bg-nx-surface-2/30`). Os 3 passos
   atuais; o corpo do passo 1 passa a ser "Colado do Excel, arquivo CSV ou caderno
   digitado. A Nexora entende e diz em português o que não conseguiu ler."
6. **Isso não é disparo em massa.** Texto atual, sem mudança.
7. **Preço** (`id="preco"`, faixa `bg-nx-surface-2/30`). Texto e lista atuais, sem
   mudança; marcadores em `nx-gold`; o botão "Começar pelo diagnóstico grátis" vira o
   botão dourado.
8. **Fecho.** Texto e botão atuais.
9. **Rodapé.** Texto (identificação como pessoa física) e links atuais;
   `pb-24 sm:pb-8` para o botão fixo não cobrir o rodapé.
10. **Botão fixo no celular** (`fixed inset-x-0 bottom-0 sm:hidden`): "Descobrir meus
    clientes →" → `/diagnostico`.

Metadados da página: sem mudança. Ícones: caracteres `→` e `✓`, sem `lucide-react`.

As seis frases travadas por `tests/promessas-da-landing.test.ts` continuam no arquivo:
"doze por semana", "R$ 97", "primeiro mês é grátis", "Quem tem horário marcado nunca
entra na lista", "Quem já respondeu sai na hora", "não pedimos cartão para começar".

**Sai da home:** o hero "Sua agenda não está vazia", `ReguaDeRitmo`, `CARDS_DEMO` e as
faixas `paper`.

**Seções da antiga que não entram:** dores, antes/depois, "A Nexora é pra você?", FAQ e
"O produto por dentro". Carregam frases que hoje são falsas — "não são compartilhados
com outras empresas" (a política de privacidade lista os operadores), "não tem cartão
cadastrado" (quem assina tem) — e a antiga não mostrava o preço.

## 4. Demais telas do funil

Troca de classes, sem mudar comportamento, fluxo nem texto — salvo as correções de
verdade no fim desta seção.

| Hoje | Vira |
|---|---|
| `bg-night`, `bg-panel-bg` | `bg-nx-bg` |
| `bg-night-soft`, `bg-paper`, `bg-panel-card` | `bg-nx-surface` |
| `bg-mist/…` (fundos translúcidos) | `bg-nx-surface-2` |
| `border-night-line`, `border-paper-line`, `border-panel-line` | `border-nx-border` |
| `border-mist/…` | `border-nx-border-2` |
| `text-mist`, `text-paper-ink`, `text-panel-ink` | `text-nx-primary` |
| `text-mist/50` a `text-mist/80`, `text-paper-sub`, `text-panel-sub` | `text-nx-secondary` |
| `text-mist/20` a `text-mist/45` | `text-nx-muted` |
| `amber` e `amber-deep` (fundo, texto, borda, anel) | `nx-gold` |
| `leaf`, `leaf-dark` | `nx-success` |
| `font-display` | sai; títulos com `font-semibold` ou `font-bold` e `tracking-tight` |

Padrões da antiga para os elementos repetidos:

- Campo: `rounded-lg border border-nx-border bg-nx-surface-2 text-nx-primary placeholder:text-nx-muted focus:border-nx-gold/60 focus:ring-2 focus:ring-nx-gold/15`
- Botão principal: `rounded-lg bg-nx-gold font-semibold text-nx-bg shadow-nx-glow-sm hover:bg-nx-gold/90 active:scale-[0.98]`
- Cartão: `rounded-xl border border-nx-border bg-nx-surface`
- Erro: texto `text-nx-error`; caixa `border border-nx-error/25 bg-nx-error-muted`

Botão do Google: continua branco, com o logo atual (a variante clara funciona sobre
fundo escuro); só `border-panel-line` vira `border-nx-border`.

As cores `wa-*` (bolhas do WhatsApp) continuam permitidas no funil: são do WhatsApp,
não da marca.

### Correções de verdade no diagnóstico (`app/diagnostico/painel.tsx`)

- "CSV, TXT ou conversa do WhatsApp" → "CSV ou TXT"
- "**Só tenho o WhatsApp:** abre a conversa, Mais → Exportar conversa → Sem mídia, e
  cola o texto aqui." → "**Só tenho o WhatsApp:** abre as conversas e digita aqui nome
  e número de quem sumiu, um por linha."

Motivo: `lib/importacao/parsers.ts` agrupa a exportação por remetente; uma conversa
individual rende um cliente, sem telefone. A trava que já existe
(`tests/legal.test.ts`) só lê `app/diagnostico/page.tsx`, e a frase sobreviveu no
arquivo vizinho.

## 5. Testes — `tests/tema-funil.test.ts`

Escrito antes da migração: falha hoje e só passa com ela completa. Lê os arquivos sem
comentários, com o mesmo `semComentarios` de `tests/contato.test.ts`.

`FUNIL` = os arquivos do §1 + `components/funil.tsx` + `components/tema-nexora.tsx` +
os seis `layout.tsx` do §2.4.

1. **Os dois temas não se misturam.**
   - Nenhum arquivo de `FUNIL` casa
     `/\b(bg|text|border|ring|from|via|to|fill|stroke|outline|divide|placeholder|decoration|accent|caret|shadow)-(night|mist|paper|panel|amber|leaf)\b/`
     nem contém `font-display`.
   - Nenhum `.ts`/`.tsx` de `app/` e `components/` fora de `FUNIL` casa o mesmo
     prefixo seguido de `nx-`, nem importa `tema-nexora`.
2. **A lista se confere sozinha.** Para cada arquivo de `FUNIL`, os imports
   `@/components/...`, `./...` e `../...` são resolvidos para `.tsx`/`.ts`, e o destino
   tem de estar em `FUNIL`.
3. **O tema está aplicado.** Os seis `layout.tsx` e `app/page.tsx` importam e renderizam
   `TemaNexora`; `components/tema-nexora.tsx` importa `geist/font/sans` e
   `geist/font/mono`; `app/layout.tsx` tem `preload: false` três vezes.
4. **Verdade na tela.**
   - Nenhum arquivo de `FUNIL` casa
     `/export\w*\s+(a\s+)?conversa|conversa\s+(exportada|do\s+whatsapp)/i`.
   - Em `app/page.tsx`, "exemplo" aparece no bloco da "Onda de segunda", e o número de
     clientes vem de `TAMANHO_DA_ONDA`.
   - Todo `href="#x"` de `app/page.tsx` tem um `id="x"` no mesmo arquivo.
5. **Regressão.** A suíte inteira continua verde (613 testes no último run), em especial
   `promessas-da-landing`, `formas-pagamento`, `legal`, `contato` e `declaracao`.
   Nenhum teste atual depende das classes de cor antigas (conferido).

## 6. Conferência visual

- `pnpm --filter recepcionista typecheck` e `pnpm --filter recepcionista build`.
- As 7 telas em 390px e em 1280px, comparadas com o mockup aprovado: nenhuma rolagem
  lateral; foco por teclado visível, com contorno âmbar.
- HTML de `/` sem `<link rel="preload" as="font">` de Bricolage, Instrument Sans ou
  Plex Mono.
- `/painel` e `/termos` iguais ao que eram antes.

## Fora deste sub-projeto

- **Sub-projeto 2 — calculadora.** Portar
  `apps/app/components/landing/RecoveryCalculator.tsx` para `nx-*`, dar
  `id="calculadora"` ao bloco da conta e devolver ao hero o botão "Calcular quanto estou
  perdendo". A antiga manda para `/register` e guarda o resultado em `sessionStorage`
  (`nexora.calc`): decidir o destino e conferir com a política de privacidade.
- **Sub-projeto 3 — diagnóstico.** Da antiga: tirar o muro de e-mail; trocar as taxas
  fixas (30% parados, 20% recuperáveis) por percentual ajustável; resolver "IA gera
  mensagem personalizada" contra o que a política de privacidade diz. Da atual: o campo
  "Seu nome no WhatsApp (só se colou uma conversa)" só serve ao caminho da exportação —
  decidir se fica.
- **Sub-projeto 4 — painel de recuperar.** Se o painel adotar este visual, a família
  `nx` já serve e a fronteira do §5 passa a incluir as telas dele. Pendência achada
  agora: `app/painel/clientes/importar/page.tsx` também promete "conversa do WhatsApp".
- **Pixel da Meta.** `promessas-da-landing` procura "pix" em minúsculas em
  `app/page.tsx`; um componente chamado `MetaPixel` importado ali reprova o build.

## Riscos

- `preload: false` pode fazer a fonte do painel piscar no primeiro acesso. Aceito em
  troca de o funil não baixar três fontes que não usa.
- `geist` é dependência nova: sem o `pnpm-lock.yaml` atualizado no commit, a instalação
  no deploy não bate com o `package.json`.
- A máquina de desenvolvimento está com pouca memória (o servidor visual caiu e buscas
  falharam com `uv_spawn`). Se o `vitest` ou o `build` caírem, rodar com um único
  processo antes de concluir que é erro de código.
