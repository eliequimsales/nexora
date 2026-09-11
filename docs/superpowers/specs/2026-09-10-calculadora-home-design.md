# Calculadora da home — desenho

- **Data:** 2026-09-10
- **Estado:** decisões fechadas com o dono; documento aprovado para seguir à implementação
- **Onde:** `apps/recepcionista`. A calculadora antiga é `apps/app/components/landing/RecoveryCalculator.tsx`.
- **Sub-projeto 2 de 4** de "trazer a Nexora antiga para a base atual": visual → **calculadora** → diagnóstico → painel de recuperar.
- **Anterior:** `docs/superpowers/specs/2026-09-10-visual-antigo-no-funil-design.md` (a home já tem o bloco "A conta que ninguém faz" esperando a calculadora).

## Por que

A home da Nexora antiga tinha uma calculadora logo depois do hero: o visitante põe os números dele e vê o próprio prejuízo antes de qualquer promessa. No sub-projeto 1 o bloco voltou só com a conta escrita. Agora a calculadora volta de verdade — com a conta que esta base consegue sustentar.

## Decisões do dono

| Pergunta | Decisão |
|---|---|
| Qual conta | **A mesma do diagnóstico**: 15% a 25% de retorno em 90 dias, com as visitas projetadas pelo ritmo. A fórmula sai de dentro de `gerarDiagnostico` para uma função compartilhada, para a home e o diagnóstico nunca divergirem. |
| Ramo | **Não pergunta.** Usa o ritmo padrão de 30 dias (3 visitas na janela) e diz isso na tela. |
| Medição | **Só 2 eventos**, anônimos: a calculadora foi usada (1 vez por sessão) e o botão dela para o diagnóstico foi clicado. Nada que identifique a pessoa, nenhum número digitado, nada que pese no limite da rota pública. |

A conta da calculadora antiga ("1 em cada 10 volta", uma visita cada) não entra: o 10% não tinha fonte e contradiria o diagnóstico.

## 1. A fórmula compartilhada — `lib/recuperacao/estimativa.ts`

Módulo puro, sem imports de servidor. Recebe o que hoje está solto em `lib/importacao/diagnostico.ts`:

```ts
/** Faixa de reativação observada em campanhas de recuperação, em 90 dias. */
export const TAXA_MIN = 0.15;
export const TAXA_MAX = 0.25;
export const JANELA_DIAS = 90;
/** Teto de visitas projetadas: ninguém recupera alguém e mantém 13 idas seguidas. */
export const MAX_VISITAS_PROJETADAS = 4;
/** Abaixo disto não há o que recuperar: o Corte Honesto entra. */
export const MIN_SUMIDOS = 25;
export const MIN_RECUPERAVEL_CENTS = 50_000;

/** "15% a 25%", derivado das taxas — o texto nunca envelhece sozinho. */
export const FAIXA_EM_TEXTO: string;

/** Quantas vezes quem voltou retoma o ritmo na janela: round(90 / ciclo), entre 1 e 4. */
export function visitasNaJanela(cicloDias: number): number;

/** 15% e 25% do potencial, arredondados; central é a média dos dois. */
export function faixaRecuperavel(potencialCents: number): { min: number; central: number; max: number };

/** O mesmo corte do diagnóstico: menos de 25 sumidos ou menos de R$ 500 no mínimo. */
export function abaixoDoCorte(sumidos: number, minCents: number): boolean;
```

`gerarDiagnostico` passa a importar tudo daqui, sem mudar nenhum resultado: os números exatos já travados em `tests/importacao.test.ts` (3 visitas, R$ 45 a R$ 75; 60 × R$ 80 × 3 × 15% = R$ 2.160) continuam valendo e são a prova de que a extração não mexeu na conta. O texto `metodo` do diagnóstico passa a usar `FAIXA_EM_TEXTO` no lugar do "15% a 25%" escrito à mão.

## 2. A conta da calculadora — `lib/recuperacao/calculadora.ts`

Funções puras, testáveis sem React:

```ts
export const FATIAS = [0.2, 0.3, 0.4] as const;
/** Os números que a calculadora mostra antes de o visitante digitar. A tela diz que são exemplo. */
export const EXEMPLO = { clientes: 400, ticketReais: 150, fatia: 0.3 };
/** O ritmo que a calculadora assume: o padrão do diagnóstico para quem não informou o ramo. */
export const CICLO_DA_CALCULADORA = MEDIANA_POR_SEGMENTO.padrao; // 30

export function contaDaCalculadora(entrada: { clientes: number; ticketReais: number; fatia: number }): {
  parados: number;          // round(clientes × fatia)
  umaVisitaCents: number;   // parados × ticket
  visitas: number;          // visitasNaJanela(CICLO_DA_CALCULADORA) → 3
  potencialCents: number;   // umaVisitaCents × visitas
  faixa: { min: number; central: number; max: number }; // faixaRecuperavel(potencialCents)
  abaixoDoCorte: boolean;   // abaixoDoCorte(parados, faixa.min), só quando clientes e ticket > 0
};

export function linkDoDiagnostico(entrada: { ticketReais: number; criativo: string | null }): string;
```

Exemplo que vira teste: 400 clientes, R$ 150, 30% → 120 parados; uma visita de cada um = R$ 18.000; 3 visitas; potencial R$ 54.000; **R$ 8.100 a R$ 13.500**; não está abaixo do corte. Com 50 clientes a 30% (15 parados), está abaixo do corte.

**Entradas saneadas:** só dígitos; clientes entre 0 e 1.000.000; ticket entre 0 e 100.000 reais. Campo vazio vale 0 e a conta mostra R$ 0, sem erro.

**Passagem para o diagnóstico pela URL, não pelo navegador.** A antiga guardava o resultado no `sessionStorage`; aqui o botão leva para `/diagnostico?ticket=150&c=<criativo>`, que o diagnóstico já sabe ler (`lib/diagnostico/parametros.ts`):
- `ticket` só entra se for inteiro entre R$ 5 e R$ 5.000 — a mesma faixa de `lerParametros`. Fora dela, o link vai sem ticket.
- `c` é o criativo do anúncio lido da URL da própria home, passado por `limparCriativo`. Sem criativo válido, não entra.
- Nenhum número de clientes nem percentual vai na URL: o diagnóstico não usa, e URL fica em histórico.

## 3. O componente — `components/calculadora.tsx`

`"use client"`, porte da calculadora antiga para os tokens `nx-*`, com `→` e `✓` no lugar de `lucide-react`.

**Entradas (coluna esquerda):**
- "Quantos clientes já passaram pelo seu negócio?" — campo numérico.
- "Quanto um cliente gasta, em média, por atendimento? (R$)" — campo numérico.
- "Quanto da sua base você acha que está parada?" — botões 20% · 30% · 40% (`aria-pressed`).
- Nota: "Não sabe? Comece com 30% e ajuste. O diagnóstico com a sua lista mostra o número de verdade."
- Nota: "Os números já preenchidos são um exemplo. Troque pelos seus."

A antiga dizia que 30% "é o que costuma aparecer quando alguém olha a base pela primeira vez" — frase sem fonte, que não entra.

**Resultado (coluna direita):**
- Sobretítulo em `text-nx-error`: "Parado na sua base agora".
- Grande: "{parados} clientes parados". Abaixo: "{R$ uma visita} é uma visita de cada um."
- Sobretítulo em `text-nx-success`: "Em 90 dias, voltando no ritmo".
- Grande, em `text-nx-success`: "{R$ min} a {R$ max}".
- Linha de método: "{FAIXA_EM_TEXTO} de retorno — a mesma faixa que o diagnóstico usa na sua lista. Considera {visitas} visitas de quem volta a cada {CICLO_DA_CALCULADORA} dias."
- **Abaixo do corte** (só com clientes e ticket > 0): caixa `border-nx-warning/25 bg-nx-warning-muted` — "Com esses números, a Nexora provavelmente não compensa para você agora. O diagnóstico confirma com a sua lista, de graça." O botão continua lá: o diagnóstico é grátis e é ele quem decide.
- Botão dourado com brilho: "Ver quais clientes são esses →" → `linkDoDiagnostico(...)`.
- Abaixo: "Grátis. Sem cartão. Você vê a lista antes de decidir qualquer coisa."

**Rodapé da calculadora — a conta à vista:** "{parados} clientes × {R$ ticket} × {visitas} visitas = {R$ potencial}. Campanhas de recuperação costumam trazer de volta {FAIXA_EM_TEXTO} disso em {JANELA_DIAS} dias."

Todo número de regra (15%, 25%, 90, 30, 3) sai das constantes. O componente não escreve nenhum deles à mão.

## 4. A home — `app/page.tsx`

- O bloco da conta vira `<section id="calculadora" className="scroll-mt-20 ...">`: sobretítulo "A conta que ninguém faz", título "Quanto dinheiro está parado na sua base?", subtítulo "Três números seus. A conta aparece na hora, com a fórmula à vista." e `<Calculadora />`. Sai o parágrafo "Faz a conta agora…".
- O segundo botão do hero volta a ser "Calcular quanto estou perdendo" → `#calculadora` (a trava de âncoras do sub-projeto 1 garante que a seção existe).
- A home continua componente de servidor; só a calculadora roda no navegador.
- `tests/tema-funil.test.ts`: `components/calculadora.tsx` entra na lista `FUNIL` — a trava que segue imports reprova até entrar.

## 5. Medição — os 2 eventos

- `lib/funil.ts`: `EVENTOS` ganha `usou_calculadora` e `clicou_calculadora` (sete no total).
- **`usou_calculadora`:** dispara na primeira vez que o visitante muda qualquer entrada — nunca ao carregar a página. Uma vez por sessão da aba: marca `nx_calc` = `"1"` no `sessionStorage`. Com armazenamento bloqueado, cai para uma vez por visita à página.
- **`clicou_calculadora`:** dispara no clique do botão para o diagnóstico, uma vez por visita à página. O `registrar` já usa `keepalive`, então o evento sai mesmo com a navegação.
- Os dois passam só o nome do evento — o `registrar` existente não aceita mais nada. Nenhum número digitado sai do navegador.
- `app/api/funil/route.ts`: o comentário "uma visita legítima dispara até cinco eventos" vira "até sete"; o limite de 60 por IP em 10 minutos não muda.
- `app/api/funil/resumo/route.ts`: rótulos "usou a calculadora" e "clicou para o diagnóstico (calculadora)". Essas duas linhas não mostram percentual sobre "chegou" (que é chegada no diagnóstico, outra página); em vez disso, uma linha: `---> calculadora: X% de quem usou clicou para o diagnóstico`.

**Política de privacidade (`lib/legal/privacidade.ts`, seção 13).** O parágrafo do `sessionStorage` passa a ser:

> "Guardamos também, na memória da aba (sessionStorage), um número sorteado e uma marca de que a calculadora da página inicial já foi usada — os dois somem quando você fecha a aba. Servem para uma coisa só: saber em que ponto as pessoas desistem — se usam a calculadora e seguem para o diagnóstico, se travam ao colar a lista, se desistem antes de ver o número. Não identificam você, não guardam os números que você digita, não atravessam visitas e não saem daqui."

`VERSAO_DOCUMENTOS` (`lib/legal/identidade.ts`) sobe de `2026-09-01` para `2026-09-10`: é a data de atualização dos documentos, e mudar o texto sem mudar a data faria a política mentir. Ainda não há assinante, então o aviso de 30 dias por e-mail não alcança ninguém.

## 6. Testes — cada um escrito antes da mudança que ele cobre

- **`tests/estimativa.test.ts` (novo):** `visitasNaJanela` (30 → 3, 24 → 4, 180 → 1, 7 → 4, 0 → 4); `faixaRecuperavel(5_400_000)` → 810.000 / 1.080.000 / 1.350.000; `abaixoDoCorte` nas bordas (24 sumidos; 25 com R$ 500; 25 com R$ 499,99); `FAIXA_EM_TEXTO` = "15% a 25%". **Sincronia:** `lib/importacao/diagnostico.ts` importa de `@/lib/recuperacao/estimativa` e não declara mais `TAXA_MIN`, `TAXA_MAX`, `JANELA_DIAS`, `MAX_VISITAS_PROJETADAS`, `MIN_SUMIDOS` nem `MIN_RECUPERAVEL_CENTS`, nem escreve "15% a 25%" à mão.
- **`tests/importacao.test.ts`, `diagnostico-funil.test.ts`, `genero.test.ts`:** sem mudança — continuam passando depois da extração.
- **`tests/calculadora.test.ts` (novo):** o exemplo de 400 / R$ 150 / 30%; o caso abaixo do corte; entradas vazias ou absurdas; `linkDoDiagnostico` com ticket dentro e fora da faixa e com criativo válido e inválido; ida e volta — o link passado por `lerParametros` devolve o mesmo ticket. Guardas do componente: `components/calculadora.tsx` não escreve "15%", "25%", "90 dias" nem "30 dias"; só grava `nx_calc` no `sessionStorage`; só registra `usou_calculadora` e `clicou_calculadora`.
- **`tests/funil.test.ts`:** "são exatamente sete", incluindo os dois novos.
- **`tests/tema-funil.test.ts`:** `components/calculadora.tsx` na lista do funil.
- **`tests/legal.test.ts`:** a política cita a calculadora na medição e diz que os números digitados não são guardados.
- **Regressão:** suíte inteira verde (649 hoje), `tsc` limpo.

## 7. Conferência

- `pnpm test`, `tsc --noEmit` e `pnpm build`, com o servidor de desenvolvimento desligado (ver a memória de verificação local: o `prisma generate` falha com o `next dev` de pé).
- `next dev` só com `DATABASE_URL` inválida e `FOLLOWUP_INTERVAL_MINUTES=30000`. Em 390 px e 1280 px, medido pelo Playwright:
  - sem rolagem lateral;
  - com o exemplo, a tela mostra "120 clientes parados" e "R$ 8.100 a R$ 13.500";
  - trocar os números atualiza o resultado, e o botão aponta para `/diagnostico?ticket=<ticket>`;
  - mudar duas entradas gera **um** POST `usou_calculadora`; clicar no botão gera um `clicou_calculadora`;
  - "Calcular quanto estou perdendo" leva ao bloco da calculadora.

## Fora deste sub-projeto

- Perguntar o ramo (decidido: não).
- Medir outros botões da home ou a chegada na home (decidido: só os 2 eventos).
- Sub-projeto 3 (diagnóstico da antiga) e 4 (painel de recuperar).
- Preencher `lib/legal/identidade.ts` — com o dono.

## Riscos

- **Extração da fórmula:** um arredondamento diferente mudaria o valor do diagnóstico. Coberto pelos números exatos de `tests/importacao.test.ts`, que não mudam.
- **Versão dos documentos:** subir a versão muda o texto do e-mail de confirmação e o registro de aceite de quem se cadastrar depois. Não há cadastro real ainda.
- **Hidratação em dev:** o CSP bloqueia o `eval` do React Refresh no `next dev`. Na conferência de 10/09 os formulários hidrataram mesmo assim; se a calculadora não reagir no dev, conferir no `next start` antes de tratar como defeito.
