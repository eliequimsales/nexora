# Configuração por conversa — Nexora

Revisão de 29/10/2026. Escopo: ensinar o atendente pelo painel, interpretar a conversa e usar informações confirmadas no atendimento.

Entrega publicada e conferida em `www.meunexora.com.br`, na versão `dpl_6w29D67Ax7wZQQp5VAgxasTU5F31`. A suíte final passou com 3.505 testes em 169 arquivos, além da verificação de TypeScript. Os limites desta validação estão descritos abaixo.

## Interface

A configuração principal passou a ser uma conversa. O atendente apresenta o assunto e pergunta o que falta. A ordem é sua empresa, serviços e preços, horários e local, jeito de atender, perguntas e regras.

- Uma pergunta curta por vez, com palavras simples.
- “Ver tópicos” abre um índice opcional; não obriga a preencher cartões.
- “Editar dados” mantém a edição direta como alternativa.
- A troca de assunto continua no mesmo chat e preserva as mensagens.
- O botão de conexão do WhatsApp ficou mais visível.
- O salvamento automático, a proteção da mensagem ainda não enviada e o controle de edição concorrente foram mantidos.

## Entendimento e condução

O histórico agora chega ao modelo como uma conversa real de usuário e assistente. O cadastro é enviado separado. A fala atual aparece uma única vez. O modelo deve responder dúvidas e devolver somente as mudanças daquela mensagem, em vez de reescrever a empresa inteira.

O estado estruturado guarda os fatos, os serviços e suas identidades, a pergunta atual, os assuntos adiados e o assunto em andamento. A recuperação consulta as últimas 80 mensagens armazenadas e seleciona até seis pertinentes, com orçamento de contexto. Não há memória ilimitada nem garantia de compreensão de qualquer frase.

Correções importantes desta rodada:

- Uma apresentação ampla não vira um serviço chamado “estética geral com cabelos unhas cílios etc”.
- “Os preços eu passo depois” não vira “valor sob consulta”.
- O fim da lista não provoca outra pergunta exigindo novos serviços.
- Uma despesa citada pelo dono não é criada como serviço por uma regra local que contradiz a interpretação válida da IA.
- “Prefiro falar disso depois” não vira uma resposta ensinada aos clientes.
- Preços e durações são associados ao serviço certo, inclusive quando há vários na mesma mensagem.
- O teste real com “na manicure nois cobra 35 reais. na pedicure eh 40 reais. as duas leva 45 minutos” expôs uma evidência incompleta devolvida pela IA: os valores estavam propostos, mas a citação mencionava apenas a duração. A validação agora também pode comprovar o preço em uma declaração literal, única e atual do mesmo serviço. Não recupera um valor antigo do histórico e recusa valores conflitantes, condições ou preços atribuídos a terceiros. Foram acrescentados 12 testes dessa proteção.
- A repetição desse caso expôs a variante inversa: a IA citou os preços e propôs 45 minutos, mas a aplicação não preservou a duração. A comprovação suplementar agora é feita separadamente para cada campo. Uma duração comum aos dois serviços só é aceita quando o grupo está limitado aos nomes atuais citados na mensagem. Essa correção recebeu mais 14 casos de teste.
- A correção de nome mantém a identidade, o preço e a duração do serviço.
- Uma consulta sobre um dado já confirmado usa o cadastro atual. Se um serviço foi renomeado, a resposta traz o nome novo com o preço e a duração preservados, em vez de repetir um nome antigo do histórico. Referências ambíguas não escolhem um serviço por suposição.
- Uma consulta simples e exclusiva ao nome da empresa é respondida pelo cadastro antes de chamar o modelo, sem propor alterações. Mensagens que combinam essa consulta com outro assunto continuam passando pela IA. Foram acrescentados cinco testes desse limite.
- Um “sim” pode confirmar a interpretação fechada que acabou de ser apresentada em “Você quis dizer…?”. Não aprova uma pergunta aberta ou escondida.
- Dias abertos e fechados são extraídos em grupos e validados contra o que foi dito. Dias não informados não são fechados por suposição.
- Uma pergunta sobre o teste recebe a explicação do teste, sem ser seguida de uma cobrança de duração ou preço.
- Dois caminhos locais ainda propunham preencher o campo da pergunta atual mesmo após receber uma interpretação válida da IA. No teste de ambiguidade, isso gravava “muda o preço dele...” como endereço. Agora esses caminhos só podem atuar sem um contrato válido de extração; quando a IA não identifica um endereço na mensagem, o endereço permanece intacto.
- Escolher um tópico explicitamente retoma a pergunta que falta após uma dúvida. Apenas recarregar ou ler a conversa preserva a pausa. Dois testes cobrem essa diferença; a retomada também foi conferida na interface publicada.
- Uma falha técnica não gera uma interpretação parcial gravada nem uma resposta culpando a forma como o dono escreveu. O texto continua disponível para tentar novamente.

## Configuração e atendimento ligados

Quando já existe uma configuração publicada, uma edição válida atualiza somente o que foi confirmado naquela operação. O restante do rascunho antigo continua pendente. O preço e o serviço usados pela agenda são sincronizados na mesma transação; uma disputa de edição desfaz a operação inteira.

Uma resposta ensinada e aprovada no painel entra no rascunho e na publicação existente. Os testes acompanham esse conteúdo até as fontes usadas pelo motor. O ensino vale para as consultas seguintes.

A primeira ativação continua exigindo revisão e teste. Ensinar não liga um atendimento pausado. Nesta rodada não foi implementada a retomada automática de uma conversa já entregue à equipe nem o ensino respondendo diretamente pelo WhatsApp do dono.

## Validação

- **3.505 testes aprovados em 169 arquivos**, incluindo persistência, sincronização de preços, conhecimento aprovado, contexto, interpretação, horários, consulta ao cadastro atual, retomada de tópico, tratamento de limites da IA e explicação sobre a aplicação das alterações. Evidência: `output/playwright/configuracao-conversa/suite-entrega-conversa.log`.
- TypeScript aprovado após uma correção de tipagem restrita a um teste.
- Testes reais da IA usam uma empresa fictícia apenas em memória, sem alterar uma empresa ou enviar WhatsApp.
- Os testes reais foram executados em etapas, com correções entre as execuções. As primeiras quatro validaram empresa, lista de cinco serviços, adiamento de preços e associação de R$80 a corte/escova com durações de 30/45 minutos. Outra execução validou a correção do nome do serviço. A execução seguinte validou a dúvida sobre o teste e o registro de horários, dias fechados e formas de pagamento.
- A oitava etapa, consulta ao serviço renomeado, passou duas vezes com o modelo real: a resposta usou o nome atual, R$80 e 30 minutos.
- A execução real dessa etapa retomou após essas oito etapas. A escrita informal registrou manicure por R$35 e pedicure por R$40, ambas com 45 minutos, preservando os demais campos. A mensagem ambígua pedindo preço de R$90 não alterou o cadastro e manteve a pergunta “a manicure ou a pedicure?” como esclarecimento pendente. No caso independente de confirmação, “sim” aprovou o preço de R$90 apresentado para o serviço certo, preservou 30 minutos e encerrou o esclarecimento.
- O diagnóstico terminou com `valid: true`, oito etapas de contexto inicial, duas novas mensagens reais e a confirmação adicional. Evidência: `output/playwright/configuracao-conversa/validacao-final-conversa-guiada.json`. Os checkpoints não demonstram uma única execução completa desde um cadastro vazio.

## Publicação e uso da interface

A versão `dpl_89PNbTjvgc7kedMVFnfHpZHi7Sfn`, snapshot SHA-256 `d6cfab5fe7af79f6e871f15ec15e150f5a86f341cf50533c0e81752f481c800b`, ficou pronta na Vercel e foi associada a `www.meunexora.com.br`. Nela foram conferidos o chat, o índice e a navegação entre assuntos sem sair da conversa.

Na conta real, foram enviadas apenas duas perguntas administrativas:

- “Qual é o nome da minha empresa?” recebeu “Nexora”.
- “esse teste vai manda msg de verdade pros meus clientes ou fica só aqui no painel? nn muda nada” recebeu “Não. O teste fica aqui no painel e não envia mensagens pelo WhatsApp.”

O cadastro antes e depois ficou idêntico, na revisão 37. O histórico passou de 10 para 14 mensagens e o atendimento automático continuou pausado.

Depois dessa conferência, foi corrigida apenas a retomada da pergunta ao escolher explicitamente um tópico. A versão dessa correção, `dpl_BpuxSiwqjWHTAhMbeyRbcunAPYhR`, snapshot SHA-256 `286f84f601ef39ac8f4736d0afa34dd2332854eac9da3982313a3defa251d50e`, ficou pronta e o domínio foi conferido nela. Os padrões de construção do projeto foram restaurados. A função de interpretação não mudou e o diagnóstico da IA não foi repetido nessa construção.

Nessa versão, a página foi reaberta e o assunto “Serviços e preços” foi escolhido em “Ver tópicos”. A pergunta pendente voltou no próprio chat: “Tenho Plano Completo... Essas informações estão corretas?”. A retomada não abriu um formulário. Esse comportamento também foi repetido na versão final, conforme a conclusão abaixo.

A tentativa de ajustar o navegador para 390 pixels não alterou a largura observada, que permaneceu em 1.265 pixels. A conferência visual móvel não foi concluída nesta rodada; essa tentativa não serve como evidência de tela móvel.

As correções não ampliam a cota do provedor de IA. Uma resposta aprovada e os testes observados não comprovam capacidade ilimitada de chamadas seguidas. Quando uma chamada falha, a mensagem fica disponível para tentar novamente sem gravar uma interpretação parcial.

## Continuidade: interrupções por limite da IA

Foi implementada uma alternativa para a configuração quando o modelo padrão Groq GPT-OSS 120B recebe HTTP 429. Nesse caso, pode ser feita uma única chamada ao GPT-OSS 20B, da mesma conta, com o mesmo contexto, contrato de resposta e prazo total. Não há espera nem repetição no modelo que atingiu o limite. Uma escolha explícita de modelo não é trocada. O padrão do aplicativo continua sendo o 120B.

O limite é de três chamadas no total, contando a repetição de formato que já existia. Toda resposta continua passando pela validação de fatos da aplicação. Se os dois modelos falharem, não é gravada uma interpretação parcial. A alternativa não amplia a cota e pode falhar quando ambos estiverem esgotados.

O 20B já aprovou duas vezes o caso real de escrita informal: manicure por R$35 e pedicure por R$40, ambas com 45 minutos. No caso seguinte, ele formulou perguntas corretas, como “Qual serviço você quer atualizar, manicure ou pedicure?” e “Qual deles você quer mudar para R$90?”, mas as devolveu como texto de diálogo, sem preencher o objeto de esclarecimento. O painel então perdia a pergunta e mostrava uma explicação genérica.

Foi corrigida a recuperação conservadora dessa escolha: ela só atua em uma ordem clara para alterar preço, duração ou serviço quando há vários serviços e nenhum alvo único. A pergunta é “Qual serviço você quer alterar?”, com opções do cadastro, sem criar preços ou fatos. O esclarecimento tem prioridade sobre o tutorial genérico. Quatro variantes de pergunta e intenção foram testadas.

Nessa continuidade, a suíte passou com 3.481 testes em 168 arquivos; os 48 testes específicos do provedor e o TypeScript também passaram. A versão `dpl_sVK7M9EeY9sioPtNtRZ5QFhQumWW`, snapshot SHA-256 `0b04d79e048c6a1993980bbfc479b28638af1ac712a20bca11c1bdfc863baf8b`, ficou pronta e o domínio foi confirmado nela. Os padrões de construção foram restaurados.

O diagnóstico real do 20B passou: a mensagem ambígua preservou o cadastro e produziu “Qual serviço você quer alterar?”. A confirmação adicional “sim” aplicou R$90 ao serviço apresentado e preservou 30 minutos. O resultado foi `valid: true`, com nove etapas de contexto inicial, uma nova mensagem real e a confirmação adicional. Evidência: `output/playwright/configuracao-conversa/validacao-continuidade-conversa-guiada.json`. O 20B foi forçado somente no diagnóstico fictício em memória; o aplicativo continua com 120B como padrão. Os casos anteriores de escrita informal foram aprovados em outras execuções. Não é uma execução completa única.

## Explicação sobre quando uma alteração vale

Na conferência real da continuidade publicada, a pergunta “se eu trocar um preço aqui, quando meu atendente passa a usar? nn quero alterar nada agora” recebeu uma explicação incorreta: “A alteração só passa a valer depois que você revisa e ativa o atendente novamente.”

A correção foi integrada por meio de `explicacaoDaAtualizacaoDaConfiguracao`, que compartilha o texto aprovado com a fonte `produto:topicos`. Uma consulta exclusivamente sobre quando os dados editados passam a valer recebe a regra correta antes de chamar a IA: em uma publicação existente, mudanças confirmadas entram em uso assim que são salvas; pendências continuam para revisão; na primeira configuração, é preciso revisar e testar antes de ativar.

O caminho é somente de leitura e não intercepta comandos, preços concretos ou perguntas que misturam assuntos. Ele usa uma extração vazia válida e preserva o cadastro. Foram adicionados 23 testes da explicação e um de integração. A suíte completa chegou a 3.505 testes em 169 arquivos e o TypeScript passou.

A versão final `dpl_6w29D67Ax7wZQQp5VAgxasTU5F31`, snapshot SHA-256 `bac6eceef7e0d74cf0b992052f85719bee16ad001a44d9e387d322d1686d2d08`, ficou pronta. O domínio `www.meunexora.com.br` foi confirmado nela e os padrões de construção foram restaurados. Os modelos não foram repetidos após essa mudança de leitura: a validação adicional foi feita com testes unitários, integração e a consulta real na interface. A última evidência real do 20B continua em `validacao-continuidade-conversa-guiada.json`.

A pergunta original foi repetida fielmente na interface e recebeu: “Se o atendente já tem uma configuração em uso, as mudanças confirmadas aqui atualizam essa configuração assim que são salvas. O que precisa esclarecer fica para revisão. Na primeira configuração, revise e teste antes de ativar o atendente.” Evidência: [Explicação da atualização confirmada](../output/playwright/configuracao-conversa/conversa-atualizacao-confirmada.png).

Na conferência final, o cadastro permaneceu idêntico ao inicial, na revisão 37. O histórico passou de 10 para 18 mensagens e o atendimento automático continuou pausado. A página foi reaberta e “Serviços e preços” foi escolhido no índice: a pergunta de revisão voltou no próprio chat. A captura final foi substituída e inspecionada: [Conversa guiada publicada](../output/playwright/configuracao-conversa/conversa-guiada-publicada.png). Publicação, retomada e conferência da interface de computador concluídas.

## Arquivos principais

- `components/atendente/conversa-configuracao.tsx` e `configuracao-por-topicos.tsx`: conversa e navegação por assunto.
- `lib/atendente/conversa.ts`, `conversa-contexto.ts`, `conversa-conducao.ts`, `conversa-motor.ts` e `conversa-horarios.ts`: interpretação, memória, perguntas e validação das mudanças.
- `lib/atendente/conversa-consulta.ts`: respostas a consultas claras usando os dados atuais e confirmados do cadastro.
- `lib/atendente/configuracao-sincronizacao.ts` e `configuracao.ts`: atualização atômica da configuração existente e dos dados operacionais.
- `lib/atendente/conhecimento-configuracao.ts`: uso do que foi ensinado e aprovado.
- `lib/ai/provider.ts`: histórico nativo, contrato de saída e erros seguros.

O atendimento aos clientes continua usando fontes aprovadas e ações autorizadas. Esta entrega não estabelece eficácia de 100% em todos os atendimentos nem substitui a validação comercial com empresas reais.
