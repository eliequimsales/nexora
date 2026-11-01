# Configuração do atendente por conversa

Este é o registro da entrega inicial. A revisão posterior, as correções e a situação para anúncios estão em [auditoria-atendente-para-anuncios.md](auditoria-atendente-para-anuncios.md).

Implementação local de 26/10/2026, em `/painel/atendente`.

## Resultado desta entrega

A página principal passa a ser uma conversa administrativa com o responsável da empresa. O atendente pergunta a próxima informação que falta, aproveita o cadastro existente e organiza respostas livres em um rascunho persistido. Resumo, edição, teste e aplicação ficam acessíveis no mesmo fluxo.

Esta entrega implementa a configuração por texto e a ligação com o conhecimento e o motor existentes. Ela não representa a conclusão de todos os objetivos do plano nem comprova uma taxa de resolução em empresas de produção.

## O que é novo

- Conversa ampla, com interface móvel semelhante à de mensagens, sem uma moldura de celular no computador.
- Perguntas sobre lacunas reais: serviços, preço, duração, objetivo do atendimento, modalidade/local, expediente, pagamento, apresentação, regras e autorização de agendamento quando necessária.
- Respostas rápidas em um toque, sem substituir uma mensagem já digitada.
- Captação de várias informações na mesma mensagem e correções posteriores, com validação de valores e evidências literais da mensagem do responsável.
- Perguntas para esclarecer preço variável, modalidade de atendimento e dias ainda não informados. Endereço ausente não é tratado como comprovação de atendimento online.
- Salvamento de mensagem, interpretação, resposta e rascunho em uma única escrita com controle de concorrência.
- Retomada do histórico recente e do estado da configuração após recarregar. O histórico administrativo mantém até 80 mensagens; o conhecimento estruturado permanece no rascunho/publicação.
- Identificador de mensagem para repetição segura e identificação da pergunta respondida, impedindo associar uma resposta antiga ao próximo campo em outra aba.
- Recuperação de erros sem apagar a mensagem; proteção de saída com texto pendente, recuperação de conflito no editor e possibilidade de copiar alterações antes de recarregar.
- Resumo editável, simulador com o motor real, avaliação das respostas e aplicação explícita da configuração.
- Conexão do WhatsApp visível; aplicação de conhecimento, conexão e ativação continuam sendo ações distintas.
- Ensino/aprovação/rejeição/exclusão na central de ensino sincronizam o item correspondente no rascunho transacionalmente. A publicação anterior é preservada até a aplicação explícita.
- Descrições confirmadas de serviços passam a integrar as fontes de resposta do motor.
- Estruturação JSON respeita o provedor configurado. OpenAI recebe esquema estrito; os demais caminhos preservam seu protocolo e a validação local. Falhas usam extração local conservadora.

## O que já existia e foi reaproveitado

Memória das conversas de clientes, agenda interna, confirmação de reservas, validação de fontes, pausa para a equipe, simulador, publicação por versão, editor e salvamento automático. Esses recursos não foram criados do zero nesta entrega.

## Salvamento e utilização com clientes

1. O responsável escreve e as informações inequívocas são organizadas e salvas no rascunho.
2. Informações importadas continuam exigindo conferência. Valores, duração, horários e permissões não são inventados.
3. O teste utiliza a revisão salva do rascunho, sem enviar WhatsApp nem criar reserva.
4. As respostas são avaliadas. Mudança relevante invalida a avaliação da versão anterior.
5. “Usar estas informações” aplica a configuração validada. Isso não conecta um número nem liga o atendimento automaticamente.
6. Um ensinamento posterior volta ao rascunho e não altera silenciosamente o snapshot ativo.

Uma fala de cliente não pode ensinar política empresarial. A conversa de configuração exige a sessão da empresa e escritas com verificação de origem. A IA interpreta dados; não recebe autorização para publicar ou executar cobranças.

## Validação

- Suíte completa: 2.925 testes aprovados em 143 arquivos, sem falhas.
- Checagem de tipos: aprovada.
- Compilação de produção: aprovada, com as 44 páginas estáticas geradas e as rotas concluídas.
- Fluxo HTTP e navegador com empresa fictícia em banco PostgreSQL local descartável, sem usar dados de clientes de produção.
- Dois serviços, seus preços e suas durações foram informados em uma única mensagem. Uma correção posterior de preço persistiu após recarregar e foi utilizada no simulador.
- Os quatro cenários exigidos foram avaliados na interface e a aplicação criou os serviços na agenda do banco fictício. A aplicação não ativou o WhatsApp.
- Um novo ensinamento foi incluído após a aplicação: a resposta apareceu no teste do rascunho, os testes anteriores foram invalidados e a versão ativa permaneceu inalterada.
- Conferência visual em 1440×1000, 390×844 e 360×740. Não houve transbordamento horizontal; a entrada ficou visível no celular e o botão flutuante de sugestões não encobriu o envio.
- Os testes automatizados usam provedores simulados. A conferência de navegador usou a extração local, sem chamadas pagas de IA. A qualidade da interpretação livre com as credenciais e o modelo de produção ainda precisa de validação operacional.
- Nenhum envio real de WhatsApp, reserva de produção, cobrança, anúncio ou publicação remota foi realizado.

Os registros locais de QA estão em `output/playwright/configuracao-conversa/`, ignorado pelo Git. Contêm somente a empresa e os atendimentos fictícios desta verificação.

## Arquivos principais

- `components/atendente/conversa-configuracao.tsx`: conversa, resumo, edição, teste e aplicação.
- `app/painel/atendente/page.tsx`: entrada da nova interface.
- `app/api/atendente/configuracao/conversa/route.ts`: leitura e envio autenticados.
- `lib/atendente/conversa-schema.ts`: contrato compartilhado.
- `lib/atendente/conversa.ts`: orquestração da interpretação e resposta.
- `lib/atendente/conversa-motor.ts`: próxima pergunta, extração e validação.
- `lib/atendente/configuracao.ts`: persistência compatível com versões anteriores e gravação conjunta dos turnos.
- `lib/atendente/conhecimento-configuracao.ts` e `lib/training.ts`: ligação transacional dos ensinamentos com o rascunho.
- `lib/atendente/preenchimento.ts`: duração explícita, incluindo durações compostas, sem confundir expediente.
- `lib/atendente/conhecimento.ts` e `lib/atendente/motor.ts`: descrições de serviço com validação da fonte correspondente.
- `lib/ai/provider.ts`: estruturação pelo provedor configurado.
- Rotas de ensino/revisão e `app/painel/treinamento/page.tsx`: utilização consistente do rascunho e mensagens de status verdadeiras.
- `components/feedback/botao-feedback.tsx`: acesso às sugestões sem cobrir a composição de mensagens no celular.

## Itens do plano que continuam pendentes

Captação por áudio, arquivos e páginas; acervo documental e recuperação semântica; ampliação das ações de remarcação/cancelamento e cobrança por estabelecimento; novas integrações externas; indicadores de resolução efetiva; piloto com empresas e comprovação em produção. Não há promessa de atendimento infalível ou de ser a opção mais barata do mercado.

Referência técnica consultada: [Structured Outputs — documentação oficial da OpenAI](https://developers.openai.com/api/docs/guides/structured-outputs).
