# Memória contextual da configuração — Nexora

Rodada iniciada em 29/10/2026, revisão em 30/10/2026. Escopo: entender correções e referências durante a configuração por conversa, preservar o assunto e perguntar somente o que falta.

**Estado desta revisão:** implementação e validação local concluídas. O candidato abaixo está em validação com a IA real; ainda não há confirmação de passagem ou publicação desta rodada.

## O problema encontrado

Na sequência apresentada pelo usuário, “cabelos” continuava cadastrado como serviço mesmo depois de ele explicar que o serviço era prancha. “Depende do tamanho” não ficava ligado corretamente ao preço de prancha, e “só esses” provocava outra pergunta sobre a lista.

Não era apenas falta de histórico. O contrato não representava explicitamente a operação sobre um serviço, seu ID e o encerramento da lista. Regras de palavras e o roteiro local podiam sobrepor o sentido extraído pela IA. O sistema também podia dizer “Anotei” sem que um dado tivesse mudado.

## O que mudou

- **Identidade do serviço:** a IA pode indicar criação, atualização ou especificação, com o ID do serviço existente. Uma correção natural não depende de conter palavras como “renomeie”.
- **Categoria e serviço concreto:** a categoria pode permanecer como contexto do serviço. Quando um cadastro provisório sem preço e duração duplica um serviço concreto, a correção pode mesclá-los e preservar o ID e os dados concretos. Conflitos pedem esclarecimento; não são resolvidos apagando informações.
- **Condição de preço:** uma declaração literal como “depende do tamanho” fica ligada ao serviço escolhido. Ela não cria um valor fixo. A condição fica na descrição e o preço permanece sob consulta, sem inventar faixas ou valores. A duração conhecida é preservada.
- **Memória persistida:** o envelope da conversa guarda o serviço em foco, as categorias e se a lista foi concluída. Esses dados sobrevivem à serialização e ao carregamento. O foco acompanha os IDs remapeados em uma mescla.
- **Contexto recente primeiro:** até dez mensagens inteiras são priorizadas, com o cadastro e a memória estruturada. Documentos opcionais do produto não devem tomar o lugar da conversa necessária para entender uma referência curta.
- **Fontes pertinentes:** foi corrigida uma comparação que podia tratar dois IDs ausentes como iguais (`undefined === undefined`) e dar prioridade indevida a fontes genéricas. Uma fonte de serviço só recebe essa prioridade quando o serviço existe e seu ID corresponde ao alvo.
- **Próxima pergunta contextual:** a pergunta da IA pode completar um dado real ainda faltante, inclusive uma regra de preço, sem precisar copiar uma frase fechada do roteiro. A validação de dados, permissões e referências autorizadas continua.
- **Reconhecimento verdadeiro:** o texto de confirmação se baseia nas alterações efetivamente aplicadas. Repetir um cadastro sem mudanças não deve produzir uma nova alegação de que ele foi anotado.
- **Atualização por campo:** campos antigos repetidos pela IA sem prova na fala atual são ignorados como novas alterações. Uma duração nova pode ser aplicada sem exigir que o dono repita a condição de preço já salva.
- **Navegação não vira conhecimento:** encerrar a lista de serviços não cria uma resposta ensinada ou uma regra da empresa. O fechamento não anuncia uma mudança de dados que não aconteceu.
- **Memória preservada na descrição:** uma descrição livre nova não apaga as linhas estruturadas de categoria e condição de preço que o atendente já conhece. A regressão inclui duração nova com esses campos omitidos pela IA.

Os principais arquivos desta rodada são `conversa-semantica.ts`, `conversa-motor.ts`, `conversa.ts`, `conversa-contexto.ts` e `conversa-schema.ts`, em `lib/atendente/`.

## Validação

| Verificação local | Resultado |
| --- | --- |
| Regressões da conversa de prancha, incluindo JSON/envelope | 10 testes aprovados |
| Operações semânticas, identidade, condições e conflitos | 31 testes aprovados |
| Seleção e preservação de contexto | 16 testes aprovados |
| Suíte completa | **3.552 testes aprovados em 171 arquivos** |
| TypeScript | Aprovado |

Evidência da suíte: `output/playwright/configuracao-conversa/suite-contexto-semantico.log`. As contagens dos grupos acima descrevem verificações específicas e não devem ser somadas para inferir a cobertura total.

O candidato `dpl_6oHuDqVi2HRagSeJzURgwxKMrtuX`, snapshot SHA-256 `2a01517adde896d39bbc571fa8127c55a021c82cde257aa7abe194e2cff87367`, executa quatro turnos consecutivos com a IA real em uma empresa fictícia:

1. A correção apresentada no print, identificando prancha como o serviço.
2. “Depende do tamanho”, vinculado à condição do preço.
3. “Só esses”, encerrando a lista de serviços.
4. “Esse aí demora 40 min pra fazer”, mantendo a referência ao serviço.

O estado é serializado em JSON entre os turnos para verificar a retomada da memória. **O resultado desse diagnóstico e a publicação ainda estão pendentes nesta revisão.** Não foi feita uma mudança de configuração na empresa real, uma migração de banco ou um envio pelo WhatsApp para realizar esse cenário.

## Limites

A memória não é infinita: há uma janela de até dez mensagens completas selecionadas, além do cadastro e do estado estruturado. Informações ausentes ou referências ambíguas ainda exigem uma pergunta. Os limites de uso da API não foram ampliados nesta rodada.

Essas mudanças verificam a continuidade da configuração e a aplicação dos dados informados. Elas não demonstram compreensão perfeita de qualquer texto nem eficácia de 100% em atendimentos reais.
