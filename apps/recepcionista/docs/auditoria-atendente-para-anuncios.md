# Revisão funcional do atendente e da configuração por conversa

Data: 26/10/2026. Implementação e homologação locais. Nenhum anúncio ou deploy foi realizado.

## Resultado e alcance

Esta revisão acrescenta funcionalidades e corrige falhas encontradas durante o uso real da interface com empresas fictícias. Não equivale à conclusão das dez etapas amplas do produto ou à comprovação de atendimento em produção.

## Alterações desta revisão

### Configuração e informações corretas

- A duração “uma hora e meia” permanece no serviço correto, com 90 minutos.
- Nomes compostos, como “Corte e barba”, não são divididos em serviços com preços incorretos.
- Parcelas não são interpretadas como o preço integral. Preços negados não substituem preços vigentes.
- Extrações da IA não podem apagar negações, condições ou exceções da oração de origem em pagamentos e regras.
- Uma instrução negada não autoriza atendimento durante o expediente. Relatos de preços ditos por clientes pedem confirmação empresarial.
- Informar serviços enquanto o nome da empresa está ausente não transforma a mensagem inteira no nome do negócio.
- A entrada de visitante pergunta o nome real; “Minha Empresa” é tratado como nome provisório.
- O salvamento do acesso definitivo conserva o ensino e atualiza a referência do cadastro quando a única mudança comprovada foi o nome autorizado. Alterações simultâneas em outros campos continuam exigindo conferência.
- Visitantes salvam o acesso antes de abrir a conexão do WhatsApp.

### Materiais e recuperação de conhecimento

- Entrada de texto e arquivos TXT, MD, CSV e JSON, com prévia editável, limites de tamanho e validação de UTF-8.
- CSV aceita tabelas de serviços/preços/duração e perguntas/respostas.
- Material mantém texto de origem, nome, tipo, resumo criptográfico, data e validade opcional. Conteúdo importado exige revisão.
- Tabelas exclusivamente de perguntas/respostas não criam uma segunda pergunta idêntica de revisão para o texto bruto.
- Fontes de materiais vencidos deixam de ser disponibilizadas ao motor. Materiais com validade não copiam preços para campos permanentes.
- Remoção de material afeta o rascunho e suas fontes; campos anteriormente extraídos continuam editáveis, com aviso explícito.
- A seleção considera a pergunta e o conteúdo antes de limitar resultados, permitindo recuperar conhecimento aprovado antigo. São aplicados termos equivalentes e exclusão de respostas conflitantes.
- Transcrição de áudio do responsável tem integração com Groq/OpenAI, conforme configuração. Sem credenciais, a interface informa indisponibilidade. A gravação exige conferência do texto transcrito.
- Texto preparado para importação é protegido ao fechar, navegar ou mudar para edição.

### Agenda e controle

- Remarcação e cancelamento usam a agenda interna, vinculados à empresa e ao telefone do cliente no canal.
- A autorização de criar reservas não autoriza alterações. O responsável define cancelamento/remarcação e antecedência mínima, inclusive zero explícito.
- O motor localiza reservas, esclarece a escolha e exige confirmação de uma proposta específica antes da alteração.
- A transação revalida política publicada, titularidade, situação, versão da reserva e disponibilidade. A própria reserva é excluída da busca de ocupação ao mudar seu horário.
- Operações persistem uma identidade para conferir resultado e reutilizar confirmações sem duplicação. Resultado desconhecido não é anunciado como sucesso.
- O simulador permanece sem alterar reservas ou enviar WhatsApp.
- As cinco publicações anteriores podem ser recuperadas para um novo rascunho. Recuperar não troca a versão ativa e exige nova revisão e testes.

### Avaliações, relatórios e conexão

- Uma avaliação persistida do responsável registra resultado, contexto, mensagem de referência e revisão publicada.
- Os resultados separam resolução pelo atendente, equipe, correção, intervenção, desconhecido, retorno e ausência de avaliação.
- A chegada de nova mensagem invalida a resolução anterior na contagem. O cálculo “total menos encaminhadas” foi removido.
- Uma conversa com participação ou solicitação da equipe não é aceita como resolvida sem ajuda.
- Correções abrem uma pendência revisável; não publicam política automaticamente.
- A nova tabela `ConversationEvaluation` tem migração aditiva e isolamento por empresa.
- A conexão não inicia uma sequência de provisionamentos ao renderizar ou editar o telefone. Cada ação explícita inicia no máximo uma tentativa; chamadas simultâneas são bloqueadas.
- Número incompleto não libera geração de código. Indisponibilidade mostra mensagem compreensível, sem expor variáveis ou detalhes internos e sem apresentar código fictício.
- Mutações de ativação e ajustes usam a proteção de origem existente.

### Pixel existente da Meta

- A política do navegador agora permite os destinos específicos usados pelo Pixel existente, preservando os demais bloqueios.
- O fallback de `noscript` não utiliza imagens gerenciadas pelo React, evitando o pré-carregamento indevido observado nos testes.
- Identificadores aceitam apenas formato numérico antes de entrarem no HTML/JavaScript.
- Essa mudança trata bloqueios observados no navegador; recebimento e atribuição de eventos ainda exigem conferência no Gerenciador de Eventos da Meta.
- Referências: [CSP frame-src](https://developer.mozilla.org/en-US/docs/Web/HTTP/Reference/Headers/Content-Security-Policy/frame-src) e [CSP form-action](https://developer.mozilla.org/en-US/docs/Web/HTTP/Reference/Headers/Content-Security-Policy/form-action).

### Revisão final da conexão do WhatsApp

- Token e endereço de recebimento são validados antes de provisionar o canal.
- A configuração de recebimento precisa concluir antes de iniciar o pareamento. Uma falha não anuncia conexão bem-sucedida.
- Ausência de código, resposta desconhecida ou falha de consulta não apagam nem recriam automaticamente uma sessão existente.
- O estado de conexão é reconhecido nos dois formatos retornados pelo gateway.
- A espera pelo pareamento exige código ou QR válido retornado pelo gateway. Uma resposta vazia vira indisponibilidade explícita.
- Uma consulta da conexão física não apaga a falha de recebimento. Uma nova conexão configurada ou um evento autenticado pode superar essa falha.
- Foram acrescentados 14 testes regressivos com telefones fictícios. Nenhum deles conecta ou envia mensagens reais.
- Compatibilidade com o par de configurações cadastrado com letras finais minúsculas: só usa o par quando os dois valores existem; uma configuração parcial não mistura endereço e credencial de origens diferentes. Cinco testes adicionais cobrem essa seleção e preservam a validação do endereço.

## Testes de uso executados

O navegador operou o aplicativo local e as rotas reais, usando PostgreSQL descartável. Não foram substituídas as respostas da aplicação por dados simulados no navegador.

1. Entrada sem conta por `/comecar`, identificação do negócio e conversa inicial.
2. Criação de acesso definitivo pela interface e recarga, preservando o ensino e sem conflito artificial do cadastro.
3. Informação de dois serviços, preços e durações na mesma mensagem; expediente, endereço, pagamentos, permissões e prazo.
4. Importação de texto e upload efetivo de CSV, com serviço a R$220/60 minutos salvo para revisão.
5. Tentativa de fechar material não salvo: painel e texto preservados.
6. Aprovação das informações importadas e recarga sem perda.
7. Testes de preço, pedido de horário, passagem humana e informação desconhecida; avaliação e aplicação pela interface.
8. Correção de R$150 para R$170, novo teste e segunda aplicação.
9. Recuperação da publicação anterior pela interface: rascunho voltou a R$150, publicação permaneceu R$170 e os testes foram invalidados.
10. Avaliação de conversa fictícia pela interface. Nova mensagem reabriu o resultado e retirou a resolução da contagem no banco.
11. Gestão real na agenda do banco local: remarcação de 14h para 14h30, cancelamento confirmado, repetição sem duplicação e bloqueio de outro titular.
12. Telefone curto e completo, indisponibilidade do canal, tentativa por código e QR sem repetição automática ou confirmação falsa.
13. Conferência do celular em 360×740: composição visível e ausência de transbordamento horizontal. Capturas realizadas em 360×740 e 1440×1000.

## Validação final

- Suíte completa após a correção do recebimento LID: 3.132 testes aprovados em 158 arquivos, sem falhas.
- Checagem de tipos: aprovada.
- Compilação de produção: aprovada, incluindo checagem de tipos, geração das páginas e conclusão das rotas.
- `git diff --check`: aprovado.
- Registros de QA: `output/playwright/configuracao-conversa/`, ignorados pelo Git e contendo somente empresas fictícias.

## Condições antes de investir nos anúncios

Preparação adicional da publicação: `.vercelignore` exclui credenciais, saídas de QA, scripts locais e testes do pacote. O TypeScript também exclui as saídas locais, evitando importar fixtures ausentes no pacote isolado. A checagem de tipos passou após esse ajuste. O acesso à equipe `nexora-e110` na Vercel foi autorizado em 27/10/2026. Nenhum pareamento foi efetuado nesta etapa.

### Verificações na hospedagem em 27/10/2026

- Produção anterior confirmada: `dpl_2KqCVNGXQ1oCeG3R2Wh8g5H3dMnm`, referência de retorno.
- Dois pacotes de teste compilaram na Vercel: `dpl_C1ALXyyAe7bREHf7kib6QRkH4By8` e `dpl_GjNzM382tpzSc9j8ws8MvWf32x95`.
- As duas migrações SQL aditivas foram executadas em transação. A estrutura de configuração já existia; a tabela de avaliações estava ausente. Após o COMMIT, foram confirmados tipos, obrigatoriedade, valores padrão, índices, chave primária e referências com atualização/exclusão em cascata. Nenhuma conversa antiga recebeu resolução automática.
- Foi encontrado um único cadastro para o número autorizado, com canal desconectado. A consulta não alterou o cadastro, a instância ou o atendimento.
- O endereço canônico antigo do gateway retornou HTTP 404. Existem duas configurações mais recentes com nomes diferentes por maiúscula/minúscula, restritas à produção. A Vercel recusou a tentativa de renomear configurações protegidas; as duas alterações temporárias de destino foram integralmente revertidas. Nenhum valor secreto foi lido ou substituído.
- O aplicativo recebeu compatibilidade com os nomes existentes. A primeira tentativa de produção foi interrompida pela guarda antes de liberar o site; a verificação foi refinada para distinguir uma instância ausente de credencial inválida. O gateway selecionado foi autenticado com sucesso, e o endereço público de recebimento foi validado.
- Publicação concluída: `dpl_Bu9AddkzjULHnpHqd9a8hnjukPTW`, em `https://www.meunexora.com.br`, com estado `READY` e domínio conferido na Vercel. Pacote de fontes: SHA256 `aed36c270de21f7c3e4a14cd10a54322b073726f2226fe1b2998ccd1485a6314`; código local sobre a base `e681e1f`, com alterações ainda não comitadas. O artefato operacional de conferência foi incluído apenas no pacote da publicação e não expõe rota HTTP.
- Conferência HTTP após a publicação: `/`, `/status` e `/login` retornaram 200; `/api/atendente` sem sessão retornou 401. A política do navegador já contém os ajustes do Pixel desta revisão. Esses resultados não comprovam pareamento, envio ou resposta real no WhatsApp.
- A sessão do navegador requer login da conta Nexora para operar a conexão pelo fluxo normal do produto. O login foi solicitado ao responsável; não houve fabricação de sessão ou troca de credenciais.

### Revisão autenticada após o login

- O login foi concluído pelo responsável. A consulta autenticada com `sync=1` confirmou conexão física aberta; o telefone salvo estava truncado. A conta autenticada é a conta comercial da Nexora, distinta do cadastro inicialmente localizado somente pela busca do telefone.
- O responsável confirmou que conectou o número autorizado. A verificação no serviço consultou apenas a instância desta conta, conferiu o nome exato e confirmou que `ownerJid` corresponde ao número autorizado. Uma atualização condicionada ao telefone antigo e à instância ainda conectada corrigiu somente `Company.phone`. Nenhuma sessão foi removida ou recriada.
- Após a correção, a consulta autenticada retornou `CONNECTED`, sem erro e com telefone `21966106737`.
- O teste na aplicação publicada encontrou uma falha: um serviço com preço confirmado ainda retornava pendência comercial nas perguntas “Quanto custa?” e “Qual é o valor do Plano Atendente 24h?”. O catálogo já continha a fonte autorizada, mas o fluxo comercial dependia da seleção pela IA.
- O fluxo agora responde perguntas simples de preço diretamente pela fonte do serviço aprovado. Ambiguidades pedem esclarecimento; condições adicionais continuam exigindo o fluxo completo. A projeção continua excluindo serviços não confirmados. Foram acrescentados 22 testes regressivos; a suíte completa e a compilação passaram.
- Correção publicada em `dpl_DgUYJmNXZNraoUfq2PAkNnEj5QHc`, estado `READY`, com domínio `www.meunexora.com.br`. Pacote de fontes: SHA256 `acda3a9b80d8879ecdd1ed9d6c84fc1fa5b95dab1a05d91a7961e770a10fdc17`.
- Reteste na interface de produção: “Qual é o valor do Plano Atendente 24h?” passou a responder “Plano Atendente 24h (Mensal) custa R$ 97,00.”. A interface apontou a fonte “Preço de Plano Atendente 24h (Mensal)”. Capturas antes/depois: `output/playwright/configuracao-conversa/teste-publicado-preco-pendente.png` e `teste-publicado-preco-corrigido.png`. O preço não foi alterado; a resposta passou a usar o serviço já confirmado.
- O atendimento automático da conta está pausado e a configuração contém informações ainda pendentes de revisão. A conexão física não foi anunciada como comprovação de resposta automática.
- Foi solicitado ao responsável um envio identificado a partir de outro WhatsApp próprio para validar entrada e resposta pelo painel. Até a confirmação desse envio, não há validação de transporte de mensagens reais nesta revisão.

### Mensagem real e compatibilidade LID

- O responsável confirmou o envio e a chegada de “TESTE NEXORA 2710” no WhatsApp da empresa. A busca na caixa de entrada e a consulta escopada ao banco não localizaram esse marcador.
- A configuração do callback foi lida e conferida diretamente na instância autorizada: habilitada, endereço/token corretos, eventos necessários presentes e envio para um único endpoint. Não foi preciso alterar essa configuração.
- Uma consulta de leitura ao armazenamento do gateway encontrou o registro real do teste. Metadados observados, sem imprimir conteúdo privado ou telefone do remetente: `fromMe=false`, `remoteJid` com domínio `@lid`, `key.remoteJidAlt` com telefone individual canônico, texto e ID de mensagem presentes.
- O parser antigo rejeitava `@lid` e o schema descartava `remoteJidAlt`. O parser foi corrigido para usar o telefone alternativo validado somente nesse caso. Não transforma os dígitos do LID em telefone. Grupos, status, broadcasts, alternativas conflitantes e mensagens próprias continuam protegidos; sufixos de aparelho não entram no telefone.
- A correção compartilha a resolução do contato entre mensagens do cliente e do dono. Foram acrescentados 16 testes; a suíte completa de 3.132 testes e a compilação foram aprovadas.
- Publicação da correção concluída em `dpl_EXJAd75Ep3H6b2Y4FF4FCSLejKf5`, estado `READY`, com domínio `www.meunexora.com.br`; pacote SHA256 `b5eb4c4fc07ae3c8c5fc4ae0a1054fb619845a3040d37076b0c23bbc54400542`. O recebimento por um novo evento e a resposta pelo painel ainda precisam ser conferidos.
- Os comandos padrão de instalação/compilação do projeto foram restaurados para evitar que uma publicação futura pelo Git dependa do artefato operacional temporário. O código da aplicação continua usando os scripts do pacote validados.
- Foi solicitado novo envio “TESTE NEXORA 2710 B” após a liberação. A mensagem descartada antes da correção não foi inserida artificialmente no banco para representar sucesso do webhook.

### Reteste B e investigação da entrega do evento

- O responsável confirmou novo envio. A sessão da caixa de entrada perdeu acesso; a interface exibia estado vazio sem explicar a falha. Após novo login, a conta foi confirmada e `GET /api/conversations` retornou efetivamente `conversations: []`.
- Os dois registros reais do teste foram encontrados no armazenamento do gateway. O parser corrigido aceitou ambos ao conferir o formato armazenado: telefone alternativo canônico com 13 dígitos, remetente externo, ID/texto presentes e campos de tipos válidos. Isso não comprova que o callback ao vivo usa exatamente o mesmo envelope do armazenamento.
- Uma chamada técnica autenticada ao callback, com evento sem mensagem e sem efeito no atendimento, retornou HTTP 200 e `ignored: true`. Isso confirma autenticação e acesso ao endpoint a partir da verificação; não comprova entrega originada no Render.
- A consulta do WAF não retornou configuração customizada (`404 Config not found`) nem ataque ativo (`anomalies: []`). Nenhuma proteção foi alterada. As proteções gerenciadas não foram descartadas como hipótese apenas com esse resultado.
- A integração Render foi conectada e o responsável autorizou explicitamente o workspace `My Workspace`. Os logs foram consultados no serviço que corresponde exatamente ao endereço configurado do gateway. O diagnóstico adicional está registrado abaixo; a consulta aos logs não foi tratada como comprovação de entrega.
- Nenhuma resposta de WhatsApp foi enviada pelo painel até este ponto, porque a conversa de teste ainda não está disponível. O envio não foi anunciado como bem-sucedido.

### Caixa de entrada: falha de acesso e recuperação

- Corrigido `app/painel/conversas/page.tsx`: HTTP 401 agora limpa conversas e contagens em memória e mostra aviso com “Entrar novamente”, preservando o retorno para `/painel/conversas`. Não há saída da conta ou navegação automática.
- Outros erros HTTP, falha de rede, tempo de espera esgotado ou resposta JSON inválida mostram aviso com “Tentar novamente”. Falhas deixam de aparecer como “Nenhuma conversa”; o próximo carregamento válido limpa o aviso. Busca e filtros são preservados.
- O carregamento limita a espera a 20 segundos, evita consultas periódicas sobrepostas e descarta respostas de consultas anteriores.
- Validação: 8 testes existentes de navegação aprovados; depois da mudança, suíte completa com 3.132 testes em 158 arquivos, checagem de tipos e compilação de produção aprovadas. A correção está nas versões `dpl_AxdG9h7pKqZqLsfJNsWAHSYBs4Cy` e `dpl_E5TEVkDr2tC9Bbys5PayiZtUK9W8`, ambas `READY`, com pacote SHA256 `d4e4ffa09264170bc5707117631d208fe7064691012fc2a97398e604a5b56d0f`.
- Essa correção da interface não aprova o transporte real: na última conferência, o banco da Nexora continuava com zero conversas e o gateway guardava os dois testes. Recebimento e resposta pelo painel continuam pendentes.

1. Publicação, domínio, login e reteste de preço confirmados. As migrações `20261026_avaliacao_atendimento` e `20261020_configuracao_nexa` estão aplicadas/conferidas. Concluir a revisão das informações empresariais e os cenários antes de ativar a nova configuração.
2. A presença das credenciais foi conferida na hospedagem. Os testes locais usaram interpretação conservadora e provedores simulados; o reteste de preço publicado usa consulta determinística. Respostas que dependem da IA ainda exigem validação positiva específica; não foram apurados custos de geração.
3. Número autorizado conectado e identidade conferida no gateway. O terceiro teste real chegou à Nexora; a tomada humana e um envio único pelo painel foram registrados. O responsável confirmou que recebeu essa resposta no outro WhatsApp, concluindo a validação de recebimento, tomada humana e resposta pelo painel. Recuperação de falhas e atendimento automático continuam exigindo verificações próprias.
4. Validar o e-mail de acesso e a entrega da verificação no provedor de produção. No QA não havia remetente/provedor de e-mail configurado.
5. Conferir os eventos na Meta e a destinação do anúncio. Nenhuma campanha ou orçamento foi criado ou alterado.
6. Realizar um piloto acompanhado e registrar resolução comprovada antes de prometer uma taxa de eficácia.

Portanto, a homologação local e as migrações na hospedagem foram concluídas; a liberação operacional de anúncios depende das verificações externas ainda pendentes.

## Diagnóstico do recebimento no Render — 27/10/2026

- Serviço conferido: `srv-dbbcllbbc2fs73an38j0`, Evolution 2.3.7, Prisma Client 6.19.0. Nos logs de 21:51:36 UTC, o processamento do segundo teste falhou com Prisma `P2010` / PostgreSQL `42703`: coluna `instanceId` ausente durante a atualização das mensagens não lidas. Telefones, conteúdo privado e credenciais não foram incluídos no diagnóstico salvo.
- A consulta somente de leitura confirmou `evolution.Chat.instanceId` e `evolution.Message.instanceId`; o ID da instância e os IDs dos dois testes coincidem com os registros retornados pelo gateway. A tabela `public.Message`, pertencente à Nexora, não tem `instanceId`. Não foi acrescentada coluna na tabela da Nexora nem alterado o caminho global de schemas do banco.
- A conexão configurada no Render já tinha `schema=evolution`, SSL e endpoint Neon direto. Portanto, não se afirmou que faltava configurar o schema na URL. O histórico primário do Neon descreve descarte de parâmetros iniciais pelo proxy, compatível com a falha, ainda dependente de confirmação pelo teste real: https://github.com/neondatabase/neon/issues/1287.
- Mitigação isolada: acrescentado apenas `pgbouncer=true` à conexão existente do gateway. O engine instalado força `SET search_path` após cada conexão nesse modo, em vez de depender do parâmetro inicial. Não troca o endpoint por um pooler e não muda autenticação. Há possível custo de desempenho porque o modo desativa o cache de prepared statements e executa `DEALLOCATE ALL` nas transações. Referência exata: https://github.com/prisma/prisma-engines/blob/2ba551f319ab1df4bc874a89965d8b3641056773/quaint/src/connector/postgres/native/mod.rs.
- A imagem foi fixada no mesmo digest que já estava em execução, `sha256:e15508de128b9ab232d9cabb2441ca897a4802fba2c8186ed384b4f4508767d9`, evitando atualizar `latest` durante o reparo. Reinício iniciado em `dep-dbgidfpsrm7s73ekhdsg`. O startup encontrou 57 migrações já existentes, nenhuma pendente e nenhuma aplicada. A verificação de mensagens reais continua separada do sucesso desse reinício.
- Reinício confirmado `live` às 22:35:08 UTC de 27/10. A consulta autenticada do aplicativo confirmou `CONNECTED` para o número autorizado. Nenhum `P2010`/`42703` apareceu no recorte de logs posterior consultado. Ocorreram falhas de descriptografia e reconexões no provedor; não foram apresentadas como resolvidas apenas pela ausência do erro SQL.
- O responsável confirmou o envio de “TESTE NEXORA 2710 C”. O painel autenticado exibiu a mensagem na conversa `cmvraq0wx0001nvctnzmei00s`. Em 28/10, foi executado “Assumir conversa” e enviado uma única vez: “Teste recebido pela Nexora. Esta é a confirmação de envio pelo painel.”. A resposta foi registrada no histórico como mensagem da equipe. Captura: `output/playwright/configuracao-conversa/teste-real-recebimento-envio.png`. Depois, o responsável confirmou “Sim, recebi” no telefone destinatário. Essa confirmação completa a evidência de entrega deste envio real; não depende apenas da bolha no painel e não comprova, por si só, atendimento automático.

## Interpretação contextual da configuração — 28/10/2026

- Problema reproduzido com o exemplo enviado pelo responsável: uma apresentação ampla sobre estética/cabelos/unhas/cílios virava um único serviço e gerava uma pergunta de preço para a frase inteira. O preenchimento local rodava antes da interpretação da IA; a resposta final era exclusivamente montada por um roteiro de campos.
- O contrato válido da IA passou a prevalecer sobre a criação local de nomes, inclusive quando a IA escolhe não cadastrar serviços. Declarações inequívocas com preço continuam recuperáveis por validação literal. Categorias e apresentações amplas pedem detalhamento; não viram procedimentos presumidos. Combos e nomes compostos são preservados quando declarados como uma unidade.
- O modelo recebe descrição, serviços, horários, endereço, pagamentos, regras, permissões e até 16 mensagens recentes da própria empresa. Esclarecimentos contextuais têm evidência literal e uma única pergunta, sem solicitar credenciais ou inventar fatos. A pergunta é persistida no mesmo envelope JSON e retomada após recarregar.
- Corrigidas associações indevidas entre campos: ensinar pagamento não renomeia o atendente. Uma intenção de ajudar com agendamentos não concede permissão para confirmar reservas. Alterações pelo formulário e remoção de serviços invalidam perguntas pendentes sobre os valores antigos; a antecedência usa o campo persistido correto.
- Registros amplos antigos permanecem preservados para revisão. Depois de informar os serviços concretos, o roteiro deixa de insistir no composto antigo; ele não é apagado silenciosamente. Ausência de preço é apresentada como “valor ainda não informado”, separada da política explicitamente definida “sob consulta”.
- Chamadas administrativas passaram a usar `configurationCompletion`, com GPT-OSS 120B como padrão no Groq e prazo próprio de 20 segundos, configurável até 30. O contrato JSON é enviado explicitamente; GPT-OSS usa saída estrita. `AI_CONFIG_MODEL` permite escolha específica. A seleção não muda o modelo do atendimento a clientes. Falhas de interpretação geram aviso e metadados sanitizados, sem registrar mensagens privadas ou credenciais.
- Verificação local final: 3.191 testes aprovados em 159 arquivos; TypeScript e `git diff --check` aprovados. A compilação local passou antes dos últimos ajustes de pendência, que recebem também a compilação da publicação. A publicação exige um teste semântico com a API real e empresa fictícia somente em memória; não altera o rascunho da conta nem envia mensagens.
- Verificação real aprovada na hospedagem: Groq GPT-OSS 120B padrão, contrato válido, nenhuma criação indevida de serviço e esclarecimento produzido pelo próprio modelo em 1.885 ms nesta amostra. Para o exemplo enviado, perguntou: “Entendi que vocês trabalham com estética geral, incluindo cabelos, unhas e cílios. Quais serviços específicos oferecem em cada uma dessas áreas?”. Uma amostra não estabelece taxa geral de acerto ou latência garantida.
- Publicação final `dpl_ChcvFheDAtRWSrYwu6RvUJs3GsUV`, estado `READY`, compilação de produção aprovada e domínio `www.meunexora.com.br` conferido apontando para essa publicação. Snapshot SHA256 `e430df88a1d4d84d37b0878bfab631dbbd6d378edccf645586886c1204556737`. As configurações temporárias de compilação foram restauradas ao padrão. O teste operacional foi incluído apenas no pacote de publicação, sem endpoint novo e sem migração de banco. Código local sobre `e681e1f`, ainda sem commit ou push.
## Configuração por tópicos e diálogo fundamentado — 28/10/2026

### Interface e salvamento

- A configuração passou a ser organizada em cinco tópicos, com conversa e formulários de edição no próprio contexto. O responsável pode consultar e ajustar as informações do tópico sem depender de uma sequência única de perguntas.
- Os formulários inline usam o salvamento automático do rascunho. A interface distingue a edição em andamento, o salvamento e as falhas; a revisão e o teste continuam necessários antes de aplicar as informações ao atendimento.
- A conversa conserva o tópico e o campo em discussão. Uma dúvida do responsável pode suspender a pergunta do roteiro; a próxima mensagem não é aplicada a um campo que ficou oculto. Esclarecimentos continuam vinculados ao campo persistido.

### Entendimento e resposta ao responsável

- O contrato da mesma chamada de IA passou a combinar fatos com evidência, diálogo explicativo e esclarecimento. A resposta ao responsável pode explicar o funcionamento da configuração, responder uma dúvida e reconhecer uma correção. Esse texto explicativo não é transformado em conhecimento da empresa.
- As explicações recebem fontes identificadas: capacidades verificadas do produto e informações confirmadas da própria empresa. Materiais brutos e itens em revisão não autorizam afirmações. IDs de fontes inexistentes, nomes e valores sem suporte, pedidos de segredo e alegações falsas de salvamento, conexão, publicação ou reserva são recusados pelo validador.
- A ajuda do produto inclui a diferença entre receber pedidos e ajudar com agendamentos: pedidos reúnem a necessidade do cliente para continuidade pela equipe; agendamentos dependem do modo escolhido, da autorização e da disponibilidade. A explicação não autoriza reserva ou cobrança por conta própria. O teste continua sem enviar WhatsApp ou criar reservas reais; conectar e ativar permanecem etapas distintas.
- Mensagens mistas são tratadas por oração. Uma declaração explícita pode atualizar o rascunho enquanto a dúvida da mesma mensagem recebe uma explicação. Uma pergunta ou hipótese, como sugerir um preço ainda não definido, não passa a ser política da empresa apenas porque contém um número.
- Foram reforçados os casos de correção, referência ao serviço anterior por pronome e alterações de grupos explicitamente identificados. O contexto do campo e os serviços conhecidos orientam a associação; a IA não deve criar um novo serviço ou atribuir a todos os itens uma informação que não foi declarada para o grupo.
- A resposta explicativa não introduz uma pergunta solta. Quando é necessário perguntar, o esclarecimento usa o campo próprio e permanece disponível após recarregar a conversa.

### Validação desta rodada e publicação candidata

- Os **3.191 testes** registrados na seção anterior pertencem à rodada de interpretação contextual. Na nova rodada, a suíte completa aprovou **3.262 testes**, antes dos últimos pequenos ajustes e do refino final da interface. Esse resultado não é apresentado como execução posterior a todos os refinamentos; as verificações finais de desktop, celular e publicação serão acrescentadas pelo responsável pela entrega.
- A versão candidata `dpl_822EHjAtbk2otuoCKa2Som75uWwW` atingiu `READY` com a interface por tópicos. A identificação da publicação que incorpora o refino final da interface ainda será registrada após a conferência.
- A verificação semântica com a API real aprovou o encadeamento do serviço **Corte**, seguido da referência **“Ele custa 80”** e da pergunta sobre a diferença entre pedidos e agendamentos. O resultado registrou `valid: true`, preservou a associação ao serviço e produziu uma explicação breve pelo próprio modelo em **3.919 ms** nessa amostra. Essa medição não representa latência garantida nem taxa geral de acerto.
- Esta rodada utiliza o GPT-OSS 120B já existente na configuração, na mesma chamada de interpretação. Não acrescenta modelo contratado, SDK, integração de cobrança, migração de banco ou chamada adicional para gerar o diálogo. O estado continua no envelope de configuração existente.
- O escopo validado aqui é a **configuração do atendente**. A qualidade do atendimento automático a clientes, os resultados comerciais e a prontidão para investir em anúncios continuam dependendo de suas verificações operacionais próprias. O sucesso desse fluxo não estabelece eficácia de 100% do atendente.

### Correção final, publicação e teste na conta real

- O primeiro teste na interface publicada expôs uma falha que o cadastro pequeno do teste anterior não revelava: o provedor respondeu HTTP 413 ao contexto da conta real. A publicação da interface, isoladamente, não comprovava o funcionamento do diálogo. A repetição desnecessária do contrato e das informações empresariais foi removida.
- O envio de contexto passou a selecionar os assuntos pertinentes entre as informações já salvas. O pacote tem alvo de 8.000 e limite de 10.000 caracteres; preserva a mensagem atual completa, a pergunta vigente, a identidade da empresa e as referências necessárias ao assunto. Fontes selecionadas são mantidas inteiras, sem cortar ressalvas ou negações. Os dados completos continuam armazenados. O histórico enviado é limitado a seis mensagens; fatos anteriores permanecem no estado estruturado, sem depender de reenviar todo o histórico.
- A chamada administrativa usa saída de até 2.000 tokens (limite de 2.200), sem repetir o schema no prompt quando o provedor já aceita contrato estrito. GPT-OSS no Groq recebe esforço de raciocínio baixo nessa chamada. O motor de atendimento a clientes não foi trocado nesta rodada. Erros registram somente categoria, tamanho e metadados técnicos.
- A redação explicativa continua validada contra fontes aprovadas. Se a redação livre sobre o produto for recusada, o sistema pode usar o texto original da fonte de produto que foi selecionada e citada. Não usa esse recurso quando há fontes empresariais citadas, não publica a redação recusada e não transforma explicações em fatos da empresa.
- Verificação final local: **3.288 testes aprovados em 162 arquivos**, TypeScript aprovado e `git diff --check` sem erros. A compilação de produção foi aprovada pela hospedagem para o pacote final.
- Antes da liberação, foi repetida a pergunta sobre pedidos e agendamentos com o **cadastro real da conta autorizada**, em leitura e cálculo somente em memória. Resultado: contrato válido, rascunho idêntico, nenhuma alteração factual, resposta fundamentada pelo próprio modelo, sem precisar do texto substituto da fonte. Pacote de 5.752 caracteres, seis fontes e seis mensagens recentes; 1.915 ms nessa amostra. Esses números não constituem garantia de latência ou taxa geral de acerto.
- Publicação final **`dpl_EsCHxGaQsY2bPfcqVWrPD3HA2Zg9`**, estado **`READY`**, com o domínio `www.meunexora.com.br` conferido apontando para ela. Snapshot SHA256 **`1ac60d5bb4c400399bdcf90f1f3afeafcd47b4b0a5d84e8336a46d49fba96a9f`**. Comandos temporários de compilação/instalação foram restaurados ao padrão após a publicação. Nenhuma migração de banco foi executada nesta rodada. Código local sobre `e681e1f`, sem commit ou push novo.
- Reteste pelo fluxo normal da interface autenticada: **“Qual é a diferença entre receber pedidos e fazer agendamentos?”** recebeu a explicação das duas opções e das condições para reservar. Não voltou ao questionário, não exibiu aviso de indisponibilidade e não alterou o cadastro. Uma segunda pergunta, **“Qual nome eu já informei para a empresa? Só quero conferir, sem mudar nada.”**, recebeu **“O nome informado para a empresa é Nexora.”**.
- A conferência após a primeira pergunta manteve revisão **37**, rascunho idêntico e atendimento automático **pausado**. As mensagens de conferência ficam no histórico administrativo, separado das informações da empresa. A verificação final após a segunda pergunta consta no registro de QA desta entrega.
- Interface conferida na largura móvel de 345 pixels úteis: saudação e cinco tópicos legíveis, sem transbordamento horizontal; o conteúdo usa a rolagem normal da página, sem a antiga janela pequena de conversa. O histórico anterior fica recolhido. Cada tópico abre o formulário correspondente no mesmo contexto, com o salvamento automático existente. O controle de viewport não alterou a largura observada na última tentativa de desktop; essa captura não é apresentada como comprovação de um segundo tamanho de tela. O override foi restaurado.
- Evidências finais: `output/playwright/configuracao-conversa/topicos-publicado-final.png` e `dialogo-publicado-final.png`; suíte completa em `suite-final-topicos.log`, dentro da mesma pasta. Esta entrega valida o fluxo de configuração e as duas consultas observadas, sem estabelecer eficácia integral do atendimento automático ou liberação de anúncios.

## Configuração por conversa guiada — revisão de 29/10/2026

Esta rodada substitui a tela principal de cartões e formulários por uma conversa. O índice de assuntos fica em “Ver tópicos”; os formulários continuam disponíveis apenas como edição opcional. O atendente apresenta cada assunto e faz uma pergunta curta. A conexão do WhatsApp tem um botão próprio e visível.

### Comportamento e contexto

- A chamada de configuração usa mensagens reais de usuário/assistente em ordem, com a fala atual uma única vez. O cadastro e as fontes ficam separados do diálogo. O contexto recupera referências relevantes entre as últimas 80 mensagens armazenadas, enviando até seis mensagens inteiras e os itens pertinentes do cadastro. Isso não equivale a memória ilimitada.
- O fluxo segue empresa, serviços e preços, horários e local, jeito de atender, perguntas e regras. Informações claras de outros assuntos também podem ser recebidas na mesma fala. Ao terminar um assunto, a próxima pergunta avança sem exigir um botão.
- Preço deixado para depois não vira “sob consulta”. Uma resposta curta não confirma um campo antigo oculto. Pergunta sobre uma funcionalidade não concede autorização para executar uma ação.
- Consultas claras sobre informações confirmadas usam o cadastro atual. A correção do nome de um serviço prevalece sobre o nome antigo nas mensagens; preço e duração continuam ligados à mesma identidade. Referências ambíguas seguem para esclarecimento.
- A consulta simples e exclusiva ao nome da empresa pode ser respondida antes do modelo, sem alterações. Consultas combinadas continuam na interpretação da IA; cinco testes verificam esse limite.
- Um preço proposto pela IA pode ser comprovado na declaração literal, única e atual do mesmo serviço quando a evidência devolvida veio incompleta. A verificação não busca preços antigos no histórico e recusa conflitos, condições e valores de terceiros. Doze testes foram acrescentados após a falha real de extração dos preços de manicure e pedicure.
- A variante inversa do mesmo teste propôs 45 minutos, mas a aplicação omitiu essa duração ao receber uma citação limitada aos preços. A comprovação suplementar passou a tratar cada campo separadamente; uma duração comum a dois serviços exige um grupo limitado aos nomes atuais presentes na mensagem. Mais 14 casos de teste cobrem essa correção.
- Dois preenchimentos locais ainda atuavam depois de uma interpretação válida da IA: a proposta genérica de dados e o preenchimento do campo da pergunta atual. No teste de ambiguidade, isso salvava “muda o preço dele...” como endereço. Os dois caminhos agora só atuam sem um contrato válido de extração; a interpretação válida sem endereço preserva esse campo.
- A escolha explícita de tópico retoma a pergunta faltante depois de uma dúvida; a leitura comum preserva a pausa. Dois testes cobrem o último ajuste, também conferido na interface publicada.
- Em falha do modelo, não é gravada uma interpretação parcial por regras locais. O texto continua no navegador para nova tentativa; o sistema não pede que o dono se explique melhor por causa de um erro técnico.
- A chamada administrativa mantém o provedor e usa esforço médio, com teto de 3.072 tokens de saída. Falhas de contrato HTTP 400 identificadas podem repetir uma única vez em JSON validado pela aplicação. HTTP 429 não repete a chamada no mesmo modelo; a alternativa ao modelo padrão está descrita na continuidade publicada abaixo. Os registros técnicos limitam-se a categorias, códigos autorizados e números, sem credenciais ou conteúdo de erro privado.

### O que foi ligado ao atendimento

- Quando já existe uma configuração publicada, uma edição válida atualiza somente os campos confirmados daquela operação. Serviço, preço, nome e regras não esperam uma segunda publicação para chegar à configuração ativa. O restante do rascunho antigo permanece pendente.
- A projeção do preço e dos serviços para a agenda e a atualização do envelope são atômicas, com controle de revisão. Uma falha concorrente desfaz a operação; um serviço removido desativa somente o item da própria empresa.
- Ao aprovar uma resposta ensinada no fluxo de conhecimento, o mesmo item entra no rascunho e na publicação existente. Os testes seguem a resposta até as fontes usadas pelo motor do atendente. Perguntas de clientes não viram regras da empresa por conta própria.
- A primeira ativação continua exigindo revisão e teste; ensinar ou editar não liga um canal pausado. Texto incompleto ou informação ainda em revisão não recebe confirmação automaticamente.
- O reaproveitamento do ensino vale para consultas seguintes. Não foi implementada nesta rodada a retomada automática de uma conversa já entregue à equipe, nem ensinar respondendo diretamente a uma mensagem no WhatsApp do dono. O fluxo existente encaminha o responsável para o painel.

### Validação desta rodada

Suíte local: **3.505 testes aprovados em 169 arquivos**, conforme `output/playwright/configuracao-conversa/suite-entrega-conversa.log`. Os 48 testes específicos do provedor e o TypeScript também passaram.

Com o modelo real, as primeiras quatro etapas validaram empresa, cinco serviços, adiamento de preços e valores/durações de corte e escova. Uma execução posterior validou a correção do nome; outra validou a dúvida sobre o teste e os horários, dias fechados e pagamentos. Houve correções entre essas execuções. Os dados são fictícios e ficam somente em memória, sem alterar uma empresa ou enviar WhatsApp.

A consulta ao serviço renomeado, oitava etapa, passou duas vezes com o modelo real: nome atual, R$80 e 30 minutos. A execução seguinte retomou após essas oito etapas e aprovou os três casos restantes: escrita informal com manicure a R$35 e pedicure a R$40, ambas por 45 minutos; ambiguidade sem alterar o cadastro, preservando a pergunta “a manicure ou a pedicure?”; confirmação “sim” para R$90 no serviço indicado, mantendo 30 minutos e encerrando o esclarecimento. O diagnóstico retornou `valid: true`, com duas novas mensagens reais e uma confirmação adicional. Evidência: `output/playwright/configuracao-conversa/validacao-final-conversa-guiada.json`. Os checkpoints não comprovam uma única sequência completa desde um cadastro vazio.

A versão `dpl_89PNbTjvgc7kedMVFnfHpZHi7Sfn`, snapshot SHA-256 `d6cfab5fe7af79f6e871f15ec15e150f5a86f341cf50533c0e81752f481c800b`, ficou pronta e recebeu o domínio. Na interface real, a consulta ao nome respondeu “Nexora”; a dúvida informal sobre o teste explicou que ele fica no painel e não envia WhatsApp. O cadastro permaneceu idêntico, na revisão 37; o histórico passou de 10 para 14 mensagens e o atendimento automático continuou pausado. O índice e a navegação permaneceram no chat.

Após essa conferência foi corrigida somente a retomada explícita de tópico. A versão dessa correção, `dpl_BpuxSiwqjWHTAhMbeyRbcunAPYhR`, snapshot SHA-256 `286f84f601ef39ac8f4736d0afa34dd2332854eac9da3982313a3defa251d50e`, ficou pronta e `www.meunexora.com.br` foi conferido nela. Os padrões de construção do projeto foram restaurados. A IA não foi repetida nessa construção, pois a função de interpretação não mudou.

A página dessa versão foi reaberta. Ao escolher “Serviços e preços” em “Ver tópicos”, a pergunta pendente voltou no próprio chat: “Tenho Plano Completo... Essas informações estão corretas?”. Não abriu um formulário. A retomada também foi repetida na versão final, descrita abaixo.

A largura observada foi de 1.265 pixels; o ajuste solicitado para 390 pixels não foi aplicado pelo navegador. Não há validação visual móvel desta rodada. Esta revisão também não amplia a cota do provedor de IA nem comprova capacidade ilimitada de chamadas seguidas.

### Continuidade: interrupções por limite da IA

Foi implementada e publicada uma única alternativa Groq GPT-OSS 20B quando o modelo padrão 120B da configuração recebe HTTP 429. A chamada usa a mesma conta, contexto, contrato e prazo total, sem espera ou repetição no modelo limitado. Modelos escolhidos explicitamente não são trocados; o padrão do aplicativo continua sendo o 120B. O teto é de três chamadas, contando a repetição de formato já existente.

A validação de fatos continua obrigatória. Se ambos os modelos falharem, a interpretação parcial não é gravada. A cota não é ampliada e a falha continua possível quando ambos esgotarem.

O 20B aprovou duas vezes o caso real de escrita informal com R$35/R$40 e 45 minutos para ambos os serviços. No caso de ambiguidade, gerou perguntas corretas, mas colocou o texto no diálogo e deixou o objeto de esclarecimento vazio; o painel perdia a pergunta e exibia uma explicação genérica.

A recuperação foi corrigida para uma situação restrita: ordem clara de alterar preço, duração ou serviço, vários serviços no cadastro e nenhum alvo único. Ela pergunta “Qual serviço você quer alterar?” e oferece opções do cadastro, sem inventar preços ou fatos. O esclarecimento prevalece sobre o tutorial genérico. Quatro variantes de pergunta e intenção foram testadas.

A versão `dpl_sVK7M9EeY9sioPtNtRZ5QFhQumWW`, snapshot SHA-256 `0b04d79e048c6a1993980bbfc479b28638af1ac712a20bca11c1bdfc863baf8b`, ficou pronta, recebeu o domínio e teve os padrões de construção restaurados. No diagnóstico real, o 20B preservou o cadastro diante da ambiguidade e perguntou “Qual serviço você quer alterar?”. A confirmação adicional aplicou R$90 e preservou 30 minutos. O resultado foi `valid: true`, com nove etapas de contexto inicial, uma nova mensagem real e a confirmação adicional. Evidência: `output/playwright/configuracao-conversa/validacao-continuidade-conversa-guiada.json`. O modelo foi forçado somente nesse diagnóstico fictício em memória. Os casos de escrita informal foram aprovados em execuções anteriores; não houve uma única execução completa.

### Explicação sobre a aplicação de alterações

A pergunta real “se eu trocar um preço aqui, quando meu atendente passa a usar? nn quero alterar nada agora” recebeu “A alteração só passa a valer depois que você revisa e ativa o atendente novamente.” Essa explicação está incorreta para uma configuração já publicada. A fonte aprovada já distingue a atualização das mudanças confirmadas em uma publicação existente da revisão e do teste exigidos na primeira ativação.

Foi integrada a resposta canônica `explicacaoDaAtualizacaoDaConfiguracao`, com texto compartilhado com a fonte `produto:topicos`. Uma consulta pura sobre quando os dados editados entram em uso é respondida antes do modelo: publicação existente recebe mudanças confirmadas assim que são salvas; pendências seguem para revisão; primeira configuração exige revisão e teste antes de ativar. O caminho de leitura usa extração vazia válida e preserva o cadastro; não intercepta comandos, preços concretos nem perguntas mistas. Os 23 testes da explicação e um de integração passaram.

A versão final `dpl_6w29D67Ax7wZQQp5VAgxasTU5F31`, snapshot SHA-256 `bac6eceef7e0d74cf0b992052f85719bee16ad001a44d9e387d322d1686d2d08`, ficou pronta, e `www.meunexora.com.br` foi verificado nela. Os padrões de construção foram restaurados. Não houve outra rodada dos modelos após a explicação canônica: foram feitos testes unitários, integração e conferência real dessa consulta na interface. A evidência real do 20B permanece em `validacao-continuidade-conversa-guiada.json`.

A pergunta original foi repetida fielmente e recebeu: “Se o atendente já tem uma configuração em uso, as mudanças confirmadas aqui atualizam essa configuração assim que são salvas. O que precisa esclarecer fica para revisão. Na primeira configuração, revise e teste antes de ativar o atendente.” Captura: `output/playwright/configuracao-conversa/conversa-atualizacao-confirmada.png`.

O cadastro final ficou idêntico ao inicial, na revisão 37; o histórico passou de 10 para 18 mensagens e o atendimento automático continuou pausado. Depois de reabrir a página e escolher “Serviços e preços” no índice, a pergunta de revisão voltou no próprio chat. A captura final `output/playwright/configuracao-conversa/conversa-guiada-publicada.png` foi substituída e inspecionada. Publicação, retomada e interface de computador concluídas. Permanecem os limites já declarados: cota do provedor não ampliada, tela móvel sem validação visual nesta rodada e diagnósticos reais executados em checkpoints.

Relatório desta rodada: [Configuração por conversa](configuracao-por-conversa-2026-10-29.md).

## Capacidades que continuam fora desta entrega

Leitura de áudios dos clientes no canal, PDF/XLSX e importação de páginas; busca semântica com embeddings; Google Calendar e outros sistemas externos; cobranças dos estabelecimentos e confirmação de pagamentos; recuperação automática completa de entregas desconhecidas; métricas por pedido em conversas com várias necessidades, custo e satisfação; comprovação com empresas reais. Não há migração para a API oficial da Meta nesta revisão.

Os limites de cobrança e tratamento de exceções financeiras continuam com a equipe. A gestão de reservas implementada valida autorização e antecedência; não executa reembolso.
