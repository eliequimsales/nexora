# Atendente Virtual e a landing da esteira — plano de implementação

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Transformar o Plantão aprovado no Atendente Virtual (três passos, simulador com o motor real, marcação na agenda, semana grátis, resgate do expediente) e reescrever a landing com a esteira completa.

**Architecture:** Módulos puros em `lib/atendente/` decidem tudo que é regra (intenção, datas, oferta, portão, verificador, textos); `motor.ts` orquestra com dependências injetadas, o que deixa o mesmo motor servir o WhatsApp real e o simulador. A marcação sai da rota pública para `lib/agenda/marcacao.ts` e passa a ser usada pelos dois lados. A tela nova vive em `/painel/atendente`; a landing ganha uma demonstração interativa feita com os mesmos textos do motor.

**Tech Stack:** Next.js 14.2 (App Router), Prisma 5.22 (`db push` no boot), vitest 1.6, Evolution API v2.

**Spec:** `docs/superpowers/specs/2026-09-22-atendente-virtual-design.md`

## Global Constraints

- Trabalho no worktree `.claude/worktrees/atendente-virtual` (branch `worktree-atendente-virtual`). Comandos: `pnpm -C apps/recepcionista exec vitest run <arquivos>`, `pnpm -C apps/recepcionista exec tsc --noEmit`, `pnpm -C apps/recepcionista run build`; depois de mexer no schema, `pnpm -C apps/recepcionista exec prisma generate`.
- Nunca ler nem imprimir `.env`; nome de variável pode aparecer, valor nunca.
- Schema só aditivo, com padrão seguro. Nunca `--accept-data-loss`.
- Telas do painel: `panel-*`/`amber`, sem `nx-*`. Landing: só `nx-*`, e todo componente que ela importa entra na lista do funil em `tests/tema-funil.test.ts`.
- Telas do Atendente sem "IA", "inteligência artificial", "prompt", "token", "modelo", "instância", "webhook"; mais a lista de `tests/linguagem-do-painel.test.ts`.
- Texto sem "1 clique"/"um clique", "disparar", "garantidos", número inventado. Exemplo sempre marcado como exemplo.
- A IA nunca decide fato: horário, preço, duração e marcação vêm do banco, por código.
- Todo número de regra sai de constante (`lib/atendente/constantes.ts`).
- Commits em português sem acento, com `Co-Authored-By: Claude Opus 5 <noreply@anthropic.com>`.
- Sem push, merge ou deploy sem autorização do fundador, um passo de cada vez.

---

### Task 1: Constantes e os três jeitos de falar

**Files:** Create `lib/atendente/constantes.ts`, `lib/atendente/jeitos.ts`; Test `tests/atendente-jeitos.test.ts`.

**Interfaces (Produces):**
- `TETO_CONVERSAS_MES = 200`, `SEMANA_GRATIS_DIAS = 7`, `SEMANA_GRATIS_CONVERSAS = 50`, `MINUTOS_SEM_RESPOSTA = 5`, `MAX_RESPOSTAS_POR_DIA = 8`, `VALIDADE_DA_OFERTA_MS = 2h`, `JANELA_DO_DONO_MS = 12h`.
- `type Jeito = "ACOLHEDOR" | "DIRETO" | "DESCONTRAIDO"`, `JEITOS: Jeito[]`, `lerJeito(valor: unknown): Jeito`.
- `apresentacao({ nome, empresa }): string` — "Eu sou Bia, atendente virtual da X" / "Aqui é o atendimento virtual da X".
- `textos(jeito)` com: `saudacao`, `convite`, `ofertaLead`, `escolherServico`, `confirmacao`, `ocupado`, `semHorario`, `pessoa`, `reclamacao`, `naoSei`, `agradecimento`, `teto`, `limiteDoDia`, `linkAgenda`; e `URGENCIA` fixo.
- `conversaDeExemplo(jeito, dados)` — a mesma conversa nos três jeitos, para o passo 1 e para a landing.

**Tests:** cada jeito tem todos os textos; apresentação sem artigo antes do nome; sem nome cai em "atendimento virtual"; nenhum texto diz "robô", "IA" ou finge ser pessoa; no máximo 1 emoji por texto; `lerJeito` cai em ACOLHEDOR com lixo; a conversa de exemplo usa empresa, serviço e horários recebidos.

### Task 2: Intenção e datas

**Files:** Create `lib/atendente/intencao.ts`, `lib/atendente/datas.ts`; Test `tests/atendente-intencao.test.ts`.

**Interfaces:**
- `normalizar(texto)`.
- `detectarIntencao(texto, ctx: { servicos: {id, nome}[]; profissionais: string[]; temOferta: boolean; temConvite: boolean }): Intencao` com `tipo` em `URGENCIA | PESSOA | RECLAMACAO | ESCOLHA | HORARIO | PRECO | FUNCIONAMENTO | ENDERECO | PAGAMENTO | SAUDACAO | AGRADECIMENTO | CONFIRMA | LIVRE`, mais `servicoId?`, `profissional?`, `pedido?: PedidoDeDia`.
- `lerPedidoDeDia(texto, agora): PedidoDeDia` — `{ dia?: "AAAA-MM-DD", periodo?: "MANHA" | "TARDE" | "NOITE", aPartirDe?: minutos }` a partir de hoje, amanhã, depois de amanhã, dia da semana, "dia 25", "25/09", manhã/tarde/noite, "depois das 18h".
- `lerEscolha(texto, opcoes: { n: number; hora: string }[]): number | null` — "2", "a 2", "opção 2", "11h", "11:00", "o das 11".

**Tests:** urgência só com termo de saúde/segurança ("preciso de horário urgente" é HORARIO); pessoa pelos termos padrão; reclamação; escolha só com oferta ativa; "sim" vira CONFIRMA só com convite; serviço reconhecido pelo nome sem acento; datas na virada do mês e da semana com `agora` fixo em Brasília; "sábado" num sábado é o próximo sábado depois das 19h? não: hoje se ainda der, senão o próximo.

### Task 3: Oferta de horários e a semana desenhada

**Files:** Create `lib/atendente/oferta.ts`, `lib/atendente/semana.ts`; Test `tests/atendente-oferta.test.ts`.

**Interfaces:**
- `type Livre = { inicio: Date; fim: Date; profissional: string | null }`.
- `escolherTres(livres: Livre[], pedido: PedidoDeDia): Livre[]` — respeita dia/período/aPartirDe; espalha (primeira livre e as seguintes com 90 min de folga, completando se faltar).
- `formatarOpcoes(opcoes, jeito, servico): string` — "1 · qua 23/09, 9h30 com o Léo" (o texto do bloco é todo por código).
- `type EstadoDaConversa = { tipo: "SERVICO"; opcoes: {n, servicoId, nome}[]; pedido; criadoEm } | { tipo: "HORARIO"; servicoId; opcoes: {n, inicio, fim, profissional}[]; criadoEm } | { tipo: "CONVITE"; criadoEm }`, `lerEstado(json, agora)` (vencido há mais de 2 h vira null).
- `semanaDoAtendente(horarios, diasFechados)` — por dia, faixas "VOCE" e "ATENDENTE" em minutos, para o desenho da tela.

**Tests:** três opções espalhadas; período "tarde" só depois das 12h; dia sem vaga cai no próximo; formato com e sem profissional; estado vencido; semana com virada de madrugada e dia fechado.

### Task 4: Acesso e portão

**Files:** Create `lib/atendente/portao.ts`; Delete `lib/plantao/portao.ts` (substituído); Modify `tests/plantao-portao.test.ts` → `tests/atendente-portao.test.ts`.

**Interfaces:**
- `acessoDoAtendente({ estado, primeiraVezEm, conversasNaSemana, conversasNoMes, agora }): "INCLUIDO" | "TETO" | "SEMANA_GRATIS" | "SEMANA_ACABOU"`.
- `lojaFechada({ horarios, diasFechados, agora }): boolean`.
- `decidirQuando({ ligado, acesso, horarios, diasFechados, expediente, donoAssumiuEm, ultimaDoClienteEm, respondidaDepois, agora, origem: "WEBHOOK" | "RESGATE" }): { acao: "RESPONDER" | "ESPERAR" | "SILENCIO"; motivo }`.
- `podeLigar(acesso): boolean`.

**Tests:** os casos da Fase 0 continuam (desligado, dono assumiu 12 h, aberto sem expediente); fechado responde; aberto com expediente espera e o resgate responde depois de 5 min; dia fechado é fechado; semana grátis por 7 dias ou 50 conversas; teto no plano; conta paga nunca cai em semana grátis.

### Task 5: Verificador e as instruções da IA

**Files:** Create `lib/atendente/verificador.ts`, `lib/atendente/prompt.ts`; Test `tests/atendente-verificador.test.ts`; Modify `tests/hardening.test.ts` (a blindagem vale para o prompt novo).

**Interfaces:**
- `numerosSemFonte(resposta, textoDosFatos): string[]` — R$, %, horas (9h, 9h30, 09:30), datas (25/09) que não aparecem nos fatos.
- `montarPrompt({ fatos, jeito, nome, contexto: "FECHADO" | "EXPEDIENTE", primeiraDoDia, agoraTexto }): string` — identidade honesta ("atendente virtual"), a blindagem de hoje (limite de confiança, ataques nomeados, não revelar, desconto inventado), fatos, regras (3 frases, 1 emoji, não inventar, não oferecer horário por conta própria, não confirmar marcação, não pedir CPF/cartão, sem orientação de saúde, transferir quando não souber).

**Tests:** R$ e hora inventados são pegos; os que estão nos fatos passam; o prompt contém a blindagem inteira (`tests/hardening.test.ts` roda nos dois prompts) e diz "atendente virtual"; nunca contém "Nunca diga que é uma inteligência artificial".

### Task 6: Schema e a marcação compartilhada

**Files:** Modify `prisma/schema.prisma`; Create `lib/agenda/marcacao.ts`, `lib/agenda/livres.ts`; Modify `app/api/agendar/[slug]/route.ts` (passa a usar `marcarNaAgenda`); Test `tests/atendente-marcacao.test.ts`.

**Interfaces:**
- Campos do spec (CompanyProfile, Conversation, model `AtendenteAtendimento`).
- `horariosLivres({ companyId, duracaoMin, dias, agora, profissional?, diasFechados }): Promise<Livre[]>` — a mesma regra da rota pública (um horário é livre se algum profissional estiver livre; sem profissionais, agenda única), com a antecedência de 60 min.
- `marcarNaAgenda({ companyId, servico, inicio, profissional?, cliente: { nome, telefone }, origem: "LINK" | "ATENDENTE", simulacao?: boolean }): Promise<{ ok: true; profissional; inicio; fim } | { ok: false; motivo: "OCUPADO" }>` — transação serializável, `entradaPorLink`, supressão, `ehConflitoDeConcorrencia`; com `simulacao`, só confere.

**Tests:** a rota pública chama `marcarNaAgenda` e continua com as mesmas mensagens; a marcação usa `isolationLevel: "Serializable"`; simulação não chama `create`; dias fechados não têm horário (puro, via `livres.ts`).

### Task 7: Fatos e uso

**Files:** Create `lib/atendente/fatos.ts`, `lib/atendente/uso.ts`; Test `tests/atendente-fatos.test.ts`.

**Interfaces:**
- `type Fatos = { empresa, nome, jeito, marcaDireto, expediente, servicos[{id,nome,precoCents,duracaoMin}], profissionais: string[], horarios, diasFechados, endereco, pagamento, perguntas: Faq[], linkAgenda: string | null }`.
- `fatosDaEmpresa(companyId, sobrescrever?)` — perguntas = FAQs + Treinamento aprovado; `serviceRules` em JSON (lista de profissionais) nunca vira regra.
- `textoDosFatos(fatos, agora)` — o texto que a IA recebe e que o verificador confere.
- `usoDoAtendente(companyId, agora)` → `{ conversasNoMes, conversasNaSemana, primeiraVezEm }`.
- `registrarAtendimento(...)` — upsert por conversa e dia.

**Tests:** `textoDosFatos` traz preço formatado, duração, horário compacto e perguntas; JSON de profissionais não entra como regra; dia local em Brasília na virada da meia-noite.

### Task 8: O motor

**Files:** Create `lib/atendente/motor.ts`; Test `tests/atendente-motor.test.ts`.

**Interfaces:**
- `responder(entrada: { texto, historico, estado, primeiraDoDia, clienteNome, fatos, agora, contexto, telefone }, deps: { livres, marcar, ia }): Promise<Saida>` com `Saida = { mensagens: string[]; estado: EstadoDaConversa | null; marcou?: {...}; anotar?: { motivo; pergunta? }; urgente?: boolean; fontes: string[]; usouIa: boolean }`.

**Cenários testados com dependências falsas:** saudação com apresentação; "tem horário amanhã?" com um serviço → três opções; com vários serviços → pergunta o serviço, "2" escolhe, depois três horários; "2" marca; ocupado no meio → três novos; "marcar direto" desligado → horários com link; preço do serviço; serviço sem preço → anota; horário, endereço, pagamento; pessoa, reclamação, urgência; pergunta livre → IA; IA com número inventado → resposta segura e anotação; IA que pede equipe → anota; falha da IA → "não sei" e anota; segunda mensagem do dia não repete a apresentação.

### Task 9: O caminho real do WhatsApp

**Files:** Create `lib/atendente/executar.ts`; Modify `lib/conversation-service.ts`, `lib/whatsapp/evolution.ts` + `lib/whatsapp/envio.ts` (atraso), `tests/envio-whatsapp.test.ts`; Test `tests/atendente-executar.test.ts`.

- `conversation-service`: depois do PARAR, o portão novo decide; RESPONDER chama `executarAtendimento`; ESPERAR só registra (o resgate responde); o fluxo antigo de IA e as respostas rápidas antigas saem.
- `executarAtendimento`: fatos, uso e acesso (TETO → texto fixo uma vez por dia; limite de 8 → "anotei" uma vez), motor, envio com atraso, `Message` AI, estado da conversa, `AtendenteAtendimento`, lacuna no Treinamento, urgência (WhatsApp do dono e e-mail), contato da Onda vira MARCOU.

**Tests (estruturais e com deps falsas):** a conversa usa `decidirQuando` depois do PARAR; nenhum caminho automático fora do Atendente; atraso proporcional entre 1 e 3 s; `envio.ts` continua o único que chama `sendWhatsAppText`.

### Task 10: Resgate do expediente e resumo da manhã

**Files:** Create `lib/atendente/resgate.ts`; Modify `instrumentation.ts`; Delete `lib/followup.ts`, `app/api/cron/follow-ups/route.ts`, `tests/followup.test.ts` (o que vale é movido: `servidorFora` para `lib/whatsapp/envio.ts`, com os testes); Test `tests/atendente-resgate.test.ts`.

- A cada minuto: empresas com o Atendente ligado e WhatsApp ligado; conversas com mensagem do cliente sem resposta (nem do dono, nem do Atendente) há 5 min ou mais na loja aberta, ou qualquer pendente com a loja fechada; no máximo 60 min de idade. Queda do servidor encerra a rodada.
- Resumo da manhã: primeira rodada depois da abertura, se houve atendimento com a loja fechada; `atendenteResumoDia` como reivindicação.

**Tests:** seleção pura (`pendentesParaResgate`) com os casos de 4 min, 5 min, dono respondeu, Atendente já respondeu, 61 min; resumo só uma vez por dia; o lembrete antigo não existe mais.

### Task 11: Cobrança

**Files:** Modify `lib/billing/acesso.ts` (Acao `LIGAR_ATENDENTE`), `lib/billing/guarda.ts` (semana grátis libera `LIGAR_ATENDENTE` e `CONECTAR_WHATSAPP`); Test `tests/atendente-cobranca.test.ts`, `tests/billing-acesso.test.ts`.

### Task 12: Rotas

**Files:** Create `app/api/atendente/route.ts` (GET estado completo da tela; PUT nome, jeito, escolhas, endereço, pagamento, horário, fechar/reabrir hoje), `app/api/atendente/ligar/route.ts` (POST ligar/desligar: teste feito, WhatsApp ligado, `exigirAcesso("LIGAR_ATENDENTE")`, grava `atendenteLigadoPrimeiraVezEm`), `app/api/atendente/simular/route.ts` (POST: motor com dependências de simulação, limite de uso, marca `atendenteTestadoEm`); Test `tests/atendente-rotas.test.ts`.

**Tests (estruturais):** sessão obrigatória; validação zod; limite de uso; o simulador não chama `enviarWhatsApp`, não cria agendamento e passa `simulacao: true`; ligar recusa sem teste e sem WhatsApp.

### Task 13: A tela Atendente Virtual e o menu

**Files:** Create `app/painel/atendente/page.tsx`, `components/atendente/{passo-jeito,passo-sabe,simulador,semana,painel-ligado}.tsx`; Modify `app/painel/layout.tsx` (quarto item), `components/painel/navegacao.tsx` (ícone e grade de 4 no celular), `tests/painel-nav.test.ts`, `tests/linguagem-do-painel.test.ts`; Test `tests/atendente-tela.test.ts`.

**Tests:** menu com quatro itens na ordem Meus clientes, Reativar clientes, Atendente Virtual, Dinheiro recuperado; telas novas na varredura de linguagem e sem as palavras técnicas; o "Ligar" depende do teste; a frase do risco do QR está perto do botão; a recusa 402 vira botão.

### Task 14: Configurações e conexão honestas

**Files:** Modify `app/painel/configuracoes/page.tsx` (Plantão → Atendente Virtual; sai o lembrete antigo e os campos que o Atendente substituiu: jeito livre, primeira mensagem, mensagem de fechado, regras em texto livre), `components/painel/modal-conectar-whatsapp.tsx` (sem "1 clique"/"disparos"); tests afetados (`plantao-fase0-tela`, `horario-unico`, `painel-acoes`, `fase2-disparo-whatsapp`).

### Task 15: A landing da esteira

**Files:** Modify `app/page.tsx`, `lib/perguntas.ts`; Create `components/demo-atendente.tsx` (cliente, `nx-*`); Modify `tests/tema-funil.test.ts` (novo componente na lista do funil), `tests/landing-conteudo.test.ts`, `tests/promessas-da-landing.test.ts`.

**Tests:** hero novo com a dor da resposta; a frase aprovada da reativação continua na página; demonstração usa os textos de `jeitos.ts` e se declara exemplo; números do Atendente saem das constantes; nenhuma frase proibida; link para `#calculadora` com "Calcular quanto estou perdendo" continua.

### Task 16: Termos de 22/09

**Files:** Modify `lib/legal/identidade.ts` (`VERSAO_DOCUMENTOS = "2026-09-22"`), `lib/legal/termos.ts` (o Atendente: incluído até 200 conversas, semana grátis, identidade, risco do número; a frase "NÃO envia mensagem no seu lugar" passa a valer só para a recuperação); tests legais.

### Task 17: Verificação final

- [ ] Suíte inteira, `tsc --noEmit`, build.
- [ ] Revisão das telas no navegador (landing em dev; painel se houver banco local — nunca o de produção).
- [ ] Memória atualizada; relatório ao fundador com o que falta do lado dele (chave da IA, se não houver) e sem push/deploy sem autorização.
