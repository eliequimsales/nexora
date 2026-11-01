# Avaliação de resultado dos atendimentos

Implementação local de 26/10/2026.

- O diário deixa de inferir sucesso de `total de conversas - encaminhadas`.
- Responder, finalizar ou retirar uma pendência da fila continuam sem significar resolução comprovada.
- A conversa do painel permite ao responsável registrar: resolução sem ajuda, resolução pela equipe, correção necessária, intervenção, resultado desconhecido ou retorno pelo mesmo problema.
- Cada avaliação preserva a empresa, origem `OWNER`, identificador da tentativa, mensagem de referência, contexto recente e revisão publicada disponível no momento.
- A origem da requisição e a sessão são verificadas. A empresa vem da sessão, e a conversa é consultada no escopo dessa empresa.
- Mensagens posteriores tornam a avaliação anterior desatualizada. O relatório mostra retorno/novas mensagens; isso não comprova automaticamente que o cliente voltou pelo mesmo problema.
- Resolução autônoma exige fala da IA e ausência de participação humana registrada ou de status de solicitação/participação da equipe. A regra é conservadora em conversas reutilizadas com intervenções antigas.
- Correção exige uma observação útil e reabre a dúvida para revisão na mesma transação. Não transforma automaticamente o texto do responsável em conhecimento aprovado ou publicado.
- Repetir a mesma tentativa não duplica avaliação ou lacuna. Reutilizar a tentativa com conteúdo diferente é conflito.
- O chat carrega as 500 mensagens mais recentes e deixa de anunciar presença online ou proteção das mensagens pela IA sem evidência.

## Aplicação no banco

A migração aditiva `prisma/migrations/20261026_avaliacao_atendimento/migration.sql` cria `ConversationEvaluation`, com exclusão em cascata ao remover a conversa/empresa. Precisa ser aplicada antes de publicar código que consulta as novas avaliações. Não há classificação automática de dados antigos.

## Verificação local

`tests/atendimento-avaliacao.test.ts`, `tests/atendimento-avaliacao-rotas.test.ts` e `tests/training.test.ts`: 36 testes aprovados, incluindo 24 novos sobre autorização, resultado desconhecido, participação humana, correção, concorrência e persistência idempotente.

Estas métricas são avaliações do responsável, sem auditoria independente. Custos de IA, tempo de solução e satisfação do cliente não são medidos nesta entrega.
