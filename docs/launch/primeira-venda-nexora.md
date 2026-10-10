# Nexora — preparação para o aplicativo e a primeira venda

Data: 09/10/2026. Estado conferido: commit `0b91140`.

## Objetivo de lançamento

Conseguir uma empresa usando o atendente e uma primeira cobrança efetivamente confirmada. Cadastro, conversa com anúncio e abertura de checkout são etapas; nenhum deles é venda. A campanha não garante esse resultado. O fundador definiu **R$ 150 como orçamento máximo total** para a próxima rodada.

## O que já existe

- Interface mobile existente e base de aplicativo web instalável: manifesto, ícones Android/iPhone, modo independente do navegador e service worker.
- Conferência pública: `https://www.meunexora.com.br/manifest.webmanifest` e `/sw.js` responderam 200. O manifesto abre `/painel` em `standalone`, com quatro ícones. A instalação em aparelhos reais não foi validada nesta rodada.
- Cobrança e gerenciamento de assinatura implementados com Stripe. Não foi encontrada integração Asaas neste serviço. O fundador confirmou que ainda precisa integrá-lo.
- Mensalidade de entrada no código: R$ 97. Existem outras opções; o anúncio inicial deve apresentar uma oferta clara e coerente com a tela de compra.

## Aplicativo: caminho recomendado para a primeira versão

Começar pela instalação na tela inicial, enquanto a decisão sobre publicação nas lojas permanece aberta. A base existente permite preparar esse caminho sem construir um produto separado.

Correções necessárias:

1. Nome/descrição do manifesto alinhados ao Atendente no WhatsApp, em vez de “Gestão e Recuperação”.
2. Botão “Instalar Nexora” com resposta útil, oculto quando já estiver aberto como aplicativo instalado.
3. Orientação específica para quem entra pelo navegador interno do Instagram/Facebook; não assumir que esteja no Chrome/Safari.
4. Antes de trocar de navegador/dispositivo, oferecer “Salvar meu acesso” e garantir que o usuário reencontre a mesma conta. Conta convidada depende da sessão original e ainda não tem credenciais recuperáveis.
5. Instruções Android/iPhone atuais; retirar promessas “não ocupa espaço” e número universal de toques.
6. Validar em Android e iPhone: demonstrar, salvar acesso, conectar, instalar, fechar e reabrir a mesma empresa. Testar cancelamento da instalação e sessão expirada.

A instalação é opcional depois da demonstração/ativação. Não é requisito para ver o atendimento. O aplicativo atual não implementa notificações push nem funcionamento offline do painel; não anunciá-los como recursos prontos.

Referências: [Apple — adicionar app web](https://support.apple.com/pt-br/guide/iphone/iphea86e5236/ios), [Google — critérios de instalação](https://web.dev/articles/install-criteria).

## Asaas: integração que precisa ser concluída

Usar checkout hospedado para não coletar dados de cartão na Nexora. Preço, plano e empresa devem ser resolvidos no servidor.

1. Pedido local criado antes do checkout, vinculado à empresa, plano, valor, prazo e condições efetivamente escolhidos.
2. Checkout Asaas para assinatura mensal em cartão e pagamento avulso por Pix conforme o contrato. Não anunciar Pix Automático por associação com Pix avulso.
3. Webhook autenticado por segredo próprio, persistência durável, aquisição atômica recuperável e unicidade do pagamento. Não reutilizar a retomada Stripe atualmente incompleta.
4. Pagamento confirmado deve conceder o período apenas uma vez. Assinatura criada/ativa e retorno de navegador não comprovam quitação.
5. Retorno ao painel mostra “Confirmando pagamento” até que o servidor reconheça a cobrança paga.
6. Cancelamento, atraso, estorno, garantia e comprovante precisam funcionar no novo provedor. O portal e os IDs Stripe não servem para contas Asaas.
7. Preservar pagamentos/assinaturas Stripe existentes; selecionar explicitamente o provedor de novos pedidos.

A aprovação dos documentos é externa e não foi consultada nesta rodada. Para validar integração real também faltam configuração de credenciais, webhook e homologação no ambiente de testes. Não solicitar chave secreta em conversa pública nem incluí-la no repositório.

Referências: [checkout hospedado](https://docs.asaas.com/docs/checkout-asaas), [criar checkout](https://docs.asaas.com/reference/criar-novo-checkout), [eventos de checkout](https://docs.asaas.com/docs/eventos-para-checkout).

## Funil de aquisição e compra

Anúncio de um ramo → WhatsApp da Nexora → demonstração personalizada → teste no painel → salvar acesso quando necessário → conectar WhatsApp → ativar atendente → contratar plano → cobrança confirmada.

A instalação pode aparecer depois de salvar acesso/ativar. O dono pode contratar antes de instalar. Na compra, salvar/verificar acesso deve acontecer dentro de um percurso com retomada do plano escolhido, evitando erro sem ação.

Três ajustes encontrados no código:

- O convidado tem e-mail temporário; ao tentar contratar pode receber uma recusa que pressupõe verificação já enviada. Levar a “Salvar meu acesso”, verificar e retomar a compra escolhida.
- O evento Meta `Purchase` depende atualmente de `?ok=1`, com valor inferido das opções disponíveis. Substituir por cobrança confirmada no servidor, ID único e valor real. Separar primeira aquisição de renovação.
- A entrada descarta parâmetros de origem ao chegar ao painel, e os eventos refletem o diagnóstico antigo. Persistir origem conhecida e medir teste, conexão, ativação, checkout e pagamento. Não inventar atribuição quando a origem não estiver disponível.

Alinhar também promessa e limites antes de publicar: o portão de teste atual contém sete dias ou 50 conversas; parte das telas/termos ainda descreve regras antigas. Presets usados na demonstração não devem virar fatos da empresa sem confirmação.

## Proposta concreta para a retomada de anúncios

- Começar com um ramo que o fundador consiga acompanhar de perto; barbearias são uma opção de teste, não uma superioridade comprovada sobre outros ramos.
- Uma campanha, um público de entrada e um anúncio com uma oferta clara. Usar o orçamento pequeno para acompanhar esse percurso, evitando fragmentá-lo em várias campanhas.
- Criativo principal: vídeo curto da Nexora no celular. Mostrar pergunta e resposta reais, um ajuste simples do dono e o botão de começar. Não usar métricas, velocidade ou resultados financeiros não medidos.
- Destino: WhatsApp com “Oi! Quero ver como a Nexora atenderia na minha empresa.”
- Oferta anunciada: plano de entrada de R$ 97/mês; teste somente conforme os limites reconciliados e disponíveis no produto.
- Acompanhar pessoalmente dúvidas e abandono dos primeiros interessados para descobrir o que impede a compra. Nenhuma mensagem foi enviada nesta preparação.

Texto base do anúncio:

> Seu WhatsApp recebe perguntas quando você está ocupado?
> Veja a Nexora atendendo no celular e descubra como ela funcionaria no seu negócio.
> Plano de entrada por R$ 97/mês.
> Toque em Enviar mensagem para experimentar a demonstração.

Orçamento máximo total autorizado para o planejamento: **R$ 150**. Proposta: cinco dias, média de R$ 30/dia, usando orçamento total e encerramento definidos para respeitar o teto. Data de início depende da liberação e homologação da cobrança. Não houve publicação de anúncios ou gasto.

Revisar diariamente conversa iniciada, ramo adequado, teste, ativação, abertura de checkout e cobrança paga. Falha de compra/demonstração exige pausa imediata. A primeira revisão ao atingir R$ 60 é um ponto operacional de controle, não uma amostra suficiente para concluir que o produto não converte: verificar o percurso e a qualidade dos interessados antes de manter os R$ 90 restantes. Não aumentar o total nem somar outras campanhas dentro desta rodada sem novo limite definido pelo fundador.

## Critério de prontidão

Uma pessoa nova deve conseguir concluir a demonstração, salvar e recuperar a conta, conectar o WhatsApp, abrir o checkout, realizar uma compra de teste e receber a liberação correta. Cancelamento/reentrega precisam manter valores e acesso coerentes. Depois da liberação do Asaas e validação da compra, a campanha pode ser preparada para publicação dentro do orçamento autorizado.

Este documento é um plano baseado na inspeção atual. As correções do aplicativo, a integração Asaas e a campanha **não foram implementadas/publicadas nesta rodada**.
