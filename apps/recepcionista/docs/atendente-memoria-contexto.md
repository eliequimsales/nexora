# Motor do atendente: memória, contexto e ações

Atualização de 26/10/2026: remarcação, cancelamento e demais correções posteriores estão descritos em [auditoria-atendente-para-anuncios.md](auditoria-atendente-para-anuncios.md). Os números e limites abaixo registram a entrega anterior.

## O que mudou

O atendimento já tinha catálogo de informações aprovadas, consulta da agenda interna, reserva transacional e pausa para a equipe. Esta alteração acrescenta continuidade estruturada, apresentação das respostas e uma barreira tipada para as ações.

### Memória de cada conversa

- Preferências de serviço, profissional, dia, período e hora exata, primeiro nome explicitamente informado e dúvida pendente.
- Persistência no campo JSON já existente da conversa, em `_memoriaAtendente`. Não exige alteração de esquema do banco.
- Empresa e conversa são validadas na leitura. Preferências usam IDs do catálogo atual; serviço removido não continua válido.
- Datas relativas são resolvidas no momento do pedido e guardadas como datas absolutas. Preferência não é reserva.
- Validade máxima de 30 dias sem atualização; ofertas de horários continuam com sua validade própria.
- Preços, regras e instruções livres não entram nessa memória. A fala do cliente nunca vira uma política do negócio.
- Correções explícitas e desistências substituem preferências anteriores. A memória também é devolvida pelo simulador e preservada quando uma oferta expira ou o assunto muda.

O histórico completo continua no banco; o modelo recebe o trecho recente e o contexto estruturado. Não se promete que todo o histórico será colocado em toda chamada.

### Conversa profissional

- Uma pergunta necessária por vez, resposta à intenção atual e ausência de apresentação repetitiva.
- Três variações determinísticas de saudação, preço e agradecimento, preservando os fatos.
- Uso contido de emojis, sem emojis nos casos delicados.
- Até três balões, com preservação de listas, valores, URLs, códigos e horários.
- Espera proporcional de três a cinco segundos no total da resposta e presença opcional de digitação. Urgências não aguardam.
- Uma mensagem nova ou tomada humana interrompe a entrega. Falha de presença não impede o envio. Falha no canal não causa repetição automática.

O atendente continua identificado como virtual. O indicador de digitação comunica a preparação da resposta e não autoriza fingir identidade humana.

### Ações

As entradas das ferramentas são estritas. Empresa, cliente, preços, autorização e chave estável da operação vêm do servidor.

Na agenda interna, consulta e reserva passam pelo despacho validado. A reserva exige a escolha específica de uma opção e resultado comprovado pelo registro de agendamento. A chave de operação é estável em tentativas da mesma mensagem. Um timeout de escrita permanece com resultado desconhecido e exige verificação.

Um pedido explícito como “quero marcar corte amanhã às 14h” também pode confirmar a escolha, desde que o horário exato exista e a empresa autorize agendamento direto. Perguntas de disponibilidade, pedidos condicionais e consultas de preço não reservam automaticamente. Se faltar o dia, o atendente pergunta; não escolhe hoje por conta própria. Se o horário solicitado não estiver livre, uma alternativa não é reservada automaticamente.

No caminho de interpretação livre, a IA recebe somente a ferramenta de consulta de horários quando ela está disponível. Não recebe autorização para inventar uma reserva ou uma cobrança. A resposta final usa o resultado do motor.

O simulador continua sem enviar WhatsApp e sem criar reservas ou cobranças. Sua consulta usa a agenda e a configuração de teste existentes.

### Frustração e passagem para a equipe

São reconhecidos sinais explícitos como pedido de reembolso, cobrança incorreta e reclamação. O tom muda para empatia e situações críticas pausam o atendimento virtual. Uma segunda dúvida consecutiva sem informação confirmada também solicita intervenção.

O resumo é gravado na conversa do painel junto da mudança para `WAITING_HUMAN`, antes da resposta. Ele contém motivo, preferência de serviço/data/profissional e as últimas falas do cliente, identificadas como relato. Essa gravação não significa que alguém leu ou recebeu uma notificação externa. Se a persistência falhar, o cliente não recebe uma confirmação falsa de encaminhamento.

## Limites e integrações pendentes

- Não foi encontrada uma integração Google Calendar configurada: esta entrega usa a agenda interna existente.
- Stripe/Asaas existentes cobram a assinatura da Nexora; não são reaproveitados para cobrar os clientes dos estabelecimentos.
- O contrato de cobrança do estabelecimento foi implementado para um adaptador próprio de Stripe Connect ou Mercado Pago, com beneficiário por empresa, preço autorizado, idempotência persistente e validação do resultado. Sem esse adaptador, a capacidade fica indisponível e o atendente pede intervenção. Nenhuma cobrança foi criada nesta alteração.
- Cancelamento, reembolso e exceções continuam dependendo da equipe; não se promete automação que não esteja conectada.
- O canal atual continua sendo a integração Evolution existente. Esta alteração não migra para a API oficial da Meta.

## Validação

Os testes usam banco, canal, IA e agenda simulados. Cobrem memória longa, mudança de dia, correção, isolamento de empresa, fatos aprovados, empatia, pausa, confirmação específica, idempotência, timeout e interrupção durante a entrega. A validação local não é prova de envio em produção ou de credenciais externas configuradas.

Validação concluída em 23/10/2026:

- Suíte completa: **2.807 testes aprovados**, nenhuma falha.
- `tsc --noEmit --incremental false`: aprovado.
- `pnpm build`: aprovado, incluindo compilação, checagem de tipos e geração das páginas.
- `git diff --check`: aprovado.
- Nenhuma mensagem real de WhatsApp, cobrança ou reserva de produção foi criada nos testes. Não houve publicação em produção nesta entrega.

## Arquivos principais

- `lib/atendente/memoria.ts`: memória validada e serialização compatível com o estado existente.
- `lib/atendente/motor.ts`: continuidade, comportamento, sinais críticos, consulta estruturada e pedido exato de reserva.
- `lib/atendente/encaminhamento.ts`: sinais explícitos de frustração e resumo para a equipe.
- `lib/atendente/entrega.ts` e `lib/whatsapp/evolution.ts`: balões, espera, presença e interrupção.
- `lib/atendente/acoes.ts`: contratos de ações, capacidades, confirmações e validação dos resultados.
- `lib/ai/provider.ts`: protocolo de ferramentas para OpenAI/Groq, Anthropic e Ollama; texto JSON comum não autoriza ações.
- `lib/atendente/prompt.ts` e `lib/atendente/jeitos.ts`: regras profissionais e variações de texto.
- `lib/atendente/datas.ts`, `oferta.ts` e `intencao.ts`: interpretação e filtragem da hora exata.
- `lib/atendente/executar.ts`: integração no atendimento real, persistência e despacho autorizado.
- `app/api/atendente/simular/route.ts` e `components/atendente/celular.tsx`: memória e apresentação no teste existente.

Referência de implementação de Function Calling: https://developers.openai.com/api/docs/guides/function-calling#strict-mode
