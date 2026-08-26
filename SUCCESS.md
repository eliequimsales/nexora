# SUCCESS — Definição de Pronto do MVP

> Uma única definição. O MVP **não** está pronto enquanto esta frase não for verdade — mesmo que "o código funcione".

**O MVP está pronto quando um dono de e-commerce consegue, em menos de 10 minutos:**

1. enviar um CSV dos seus clientes;
2. entender quanto dinheiro provavelmente está deixando na mesa (em **R$**);
3. confiar no motivo dessa estimativa (causas auditáveis + confiança honesta);
4. e **executar pelo menos uma ação concreta**.

## Por que esta definição existe

Impede o erro nº 1 de engenharia: declarar vitória porque "o código funciona" enquanto o cliente ainda não percebe valor. **Sucesso = valor percebido pelo cliente, não teste verde.**

## Como é verificado

Pelo **Teste de Valor** (BDD de ponta a ponta) em
`apps/api/src/modules/assistente-financeiro/revenue-engine/__tests__/value-test.spec.ts`.
Ele só passa quando a experiência completa (CSV → Provider → Revenue Engine → Decision → ação executável) existir.

## Alinhamento com a Constituição

- **North Star:** Receita Recuperada incremental e comprovada.
- **Artigo IV (Regra Zero):** termina em ação, nunca em informação pura.
- **Artigo X (Dinheiro antes de vaidade):** R$ primeiro, RRI depois.
- **Artigo VI (Verdade acima de marketing):** confiança baixa é admitida.
- **Guardrail 6:** Time to Value < 10 min.
