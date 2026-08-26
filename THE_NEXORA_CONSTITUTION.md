# The Nexora Constitution

> A lei suprema da Nexora. Acima de spec, arquitetura, código, roadmap e opinião.
> Em qualquer conflito, **a Constituição vence**.
> Os **Artigos** e a **North Star** mudam apenas por decisão explícita do fundador, registrada em `brain/06_Decisoes/decisoes-tecnicas.md`. A **Doutrina** evolui livremente com o aprendizado.
> Toda pessoa e todo agente de IA que constrói a Nexora lê este documento primeiro.

---

## Preâmbulo

A Nexora existe para uma única coisa: **maximizar o lucro dos seus clientes através de decisões inteligentes automatizadas.** Todo o resto — produto, engenharia, marketing, vendas — serve a isso.

---

## Artigos imutáveis

**I — Missão.** Maximizar o lucro do cliente via decisões inteligentes automatizadas.

**II — Transformação.** Levar o cliente de *"não sei onde perco dinheiro"* para *"sei exatamente qual decisão gera mais lucro"*.

**III — Regra Suprema.** Nada entra no produto se não aumentar a receita recuperada do cliente.

**IV — Regra Zero.** Toda tela termina em uma decisão; toda decisão termina em uma ação. Nunca em informação pura.

**V — Working Backwards.** Toda feature começa pelo resultado do cliente, nunca pela tecnologia.

**VI — Verdade acima de marketing.** Se a confiança é baixa, o sistema admite. Honestidade nunca é sacrificada por impacto de venda.

**VII — Engine Universal.** O núcleo nunca conhece setores — conhece apenas sinais normalizados. Toda inteligência é composta por sinais substituíveis (heurística → estatística → IA), nunca por regras fixas de setor.

**VIII — Mesmo schema.** Todo Signal Provider produz exatamente o mesmo schema canônico.

**IX — Aprendizado.** Toda ação melhora a próxima decisão.

**X — Dinheiro antes de vaidade.** O cliente sempre vê primeiro o valor em R$; qualquer score (RRI) é secundário. Nunca o contrário.

**XI — Filosofia.** A Nexora não analisa empresas — ela toma decisões. Não somos analytics.

**XII — Visão & Wedge.** Visão: ser o Sistema Operacional Financeiro das empresas. Wedge: começar recuperando receita de clientes existentes; expandir somente depois de dominar o wedge com métricas objetivas. **Visão ≠ Roadmap.**

---

## North Star Metric

> **Receita Recuperada — incremental e comprovada — pelos clientes da Nexora.**

- Não é MRR, ARR nem nº de usuários. Essas são *consequências*, não o norte.
- **"Incremental e comprovada"** = medida contra um grupo de controle (holdout). Receita que voltaria sozinha **não conta** (Artigo VI). Sem holdout, a métrica vira vaidade e trai a própria Constituição.
- É a única métrica que alinha engenharia, produto, vendas e marketing numa só verdade.

---

## Conselho de Decisão

Gate de toda **feature de produto** antes de entrar no roadmap. Ela responde 7 perguntas:

1. Recupera receita?
2. Aproxima o usuário da próxima decisão?
3. Termina em ação?
4. Reduz o tempo até valor?
5. Aumenta a confiança (do sistema ou do usuário)?
6. Melhora o Learning Engine?
7. É reutilizável pelos próximos Signal Providers?

Se a resposta a qualquer uma for **"não"**, a feature de produto volta — sem exceções.

**Exceção explícita (para a regra não virar letra morta):** trabalho habilitador — segurança, infraestrutura, compliance, cobrança — não precisa recuperar receita diretamente. Mas só se justifica se *habilita* algo que passa no Conselho.

---

## Doutrina (forte, mas pode evoluir — NÃO é imutável)

Distinta dos Artigos. São os melhores defaults de hoje; mudam com o aprendizado, sem emenda constitucional. Nunca podem violar um Artigo.

- **Money First UI — sem "dashboard", fila de prioridades.** É a melhor expressão atual do Artigo X. Pode evoluir (enterprise pode exigir visões agregadas) — desde que dinheiro continue antes de vaidade.
- **Dois RRIs:** operacional 0–100 (ranking interno) e executivo = receita recuperável ÷ receita anual (%). Fórmulas recalibráveis.
- **RFM como primeiro modelo de sinal.** Será complementado/substituído por outros Signal Providers (Subscription, B2B, Healthcare...).

---

## Emenda

Artigos e North Star: mudam só por decisão explícita do fundador, registrada em decisões técnicas. Doutrina: muda livremente conforme o aprendizado prova o que funciona.

---

*Detalhes operacionais vivem fora desta Constituição: arquitetura em `brain/03_Arquitetura/revenue-engine.md`, estratégia em `brain/00_Visao/estrategia-empresa-bilhao.md`, specs em `docs/specs/`. Eles mudam. Esta Constituição, não.*
