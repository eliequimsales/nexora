# Termo de consentimento — SUBSTITUÍDO

> **Este documento foi substituído em 2026-09-01.**

O texto que estava aqui prometia coisas que o sistema não fazia. Os quatro erros
mais graves, registrados para que não voltem:

1. Dizia que o aceite ficava gravado em `organizations.lgpdAcceptedAt` — coluna
   que nunca existiu neste produto. Nada era registrado no cadastro.
2. Prometia autenticação multifator para acesso aos dados. Não havia MFA.
3. Prometia exportação em CSV em até 5 dias úteis. Não havia rota de exportação.
4. Limitava a 1 mensagem por cliente a cada 30 dias, enquanto o Protocolo de
   4 Toques envia até 4 mensagens em 25 dias.

O documento vigente que rege a relação entre o dono do negócio (controlador) e a
Nexora (operadora) é o **Contrato de Operador**, exigido pelo art. 39 da LGPD:

- No produto: **/operador**
- No código: `apps/recepcionista/lib/legal/operador.ts`

Os demais documentos vigentes:

- **Termos de Uso** — `/termos` · `lib/legal/termos.ts`
- **Política de Privacidade** — `/privacidade` · `lib/legal/privacidade.ts`

O texto vive em TypeScript, e não em Markdown, de propósito: a versão é uma
constante que o cadastro grava junto com a data do aceite, e os números do
contrato (preço, dias de teste, tolerância) são importados das constantes do
produto. Assim o contrato não pode divergir do sistema sem quebrar o build.
