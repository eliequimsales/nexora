# Esteira de vendas — desenho

- **Data:** 2026-09-21
- **Estado:** aprovado pelo fundador em 21/09/2026 ("perfeito, faça todas as alterações necessárias"), com as respostas sobre implantação e preço do mesmo dia.
- **Onde:** `apps/recepcionista`.
- **Proposta visual:** https://claude.ai/artifact/2vr6TYfUk5xZC84eK2nzGG
- **Depende de:** Plantão Fase 0 (em produção desde o deploy `f4fdde2a`, commit `fbd0a90`).

## Por que

A esteira troca "tabela de preços" por um caminho em que cada cobrança aparece depois de uma prova tirada da lista do próprio dono. Esta entrega implementa as quatro peças que não dependem do Plantão estar pronto: a primeira Onda grátis, a parede que mostra o que ela fez, o anual no momento da prova e a implantação no checkout.

## Decisões do fundador

| Pergunta | Decisão |
|---|---|
| Entrada | **Primeira Onda por nossa conta**, sem cartão, no lugar do teste de 7 dias para contas novas. |
| Preço do Plantão | Plano Nexora (R$ 97) inclui o Plantão com teto de **200 conversas por mês**; Nexora Completo (R$ 197) tira o teto e libera equipe ilimitada. Entra com a Fase 1 do Plantão. |
| Implantação | Item opcional no checkout, **R$ 97, uma vez**. Price na variável `STRIPE_IMPLANTACAO_PRICE_ID` (o fundador cria na Stripe). Combinada pelo WhatsApp em `NEXT_PUBLIC_WHATSAPP_SUPORTE`. **5 vagas por semana.** |

## 1. A primeira Onda grátis

**Regra.** Conta no estado `GRATIS` pode gerar a Onda, mandar as mensagens prontas e ligar o WhatsApp enquanto a primeira Onda estiver disponível:

- **Disponível:** a conta nunca gerou uma Onda (`Company.primeiraOndaEm` vazio).
- **Em andamento:** gerou há menos de **7 dias** e registrou menos de **12 mensagens** (`TAMANHO_DA_ONDA`) em `RecoveryTouch`.
- **Usada:** qualquer outro caso. A parede sobe, com o resultado da primeira Onda.

A janela de 7 dias fecha a brecha de quem manda pelo link do WhatsApp e nunca marca "já mandei": sem ela, a contagem nunca chegaria a 12. Com ela, a parede sobe na segunda Onda, como a esteira promete.

**Detalhes que a leitura do código exigiu:**

- A contagem é de mensagens: toques desde `primeiraOndaEm`, **sem os pulados** (pular quem mudou de cidade não pode gastar a Onda grátis).
- Com a primeira Onda **disponível**, a conta gera a Onda e liga o WhatsApp; **mandar** só depois de ela existir (em andamento). Liberar o envio antes deixaria quem chama a rota direto mandar sem nunca começar a contagem.
- O prazo só começa quando a Onda gerada **tem clientes**: abrir "Reativar clientes" antes de subir a lista não gasta os dias.
- A primeira Onda tem o tamanho padrão (12): o lote de 25 fica para quem tem plano.

**Quem ganha.** Toda conta em `GRATIS`, inclusive as que aceitaram os Termos de 15/09 (que não prometiam teste): é presente, não promessa quebrada. Quem aceitou os Termos de 18/09 continua com os 7 dias que eles prometiam. Contas novas aceitam os Termos de 21/09 e não ganham relógio de teste.

**Onde.** A decisão é pura (`lib/billing/primeira-onda.ts`); `exigirAcesso` a consulta só para `GRATIS` e só para as três ações da primeira Onda. A primeira Onda gerada grava `primeiraOndaEm`. "Meus clientes" continua sem mensagem pronta para `GRATIS`: a primeira Onda mora em "Reativar clientes".

## 2. A parede com o que a primeira Onda fez

Quando a primeira Onda acaba, a recusa da Onda leva a oferta com o resultado dela, tirado das marcações do próprio dono: mensagens registradas, quantos responderam (respondeu, marcou ou voltou), quantos voltaram e quanto voltou em Dinheiro recuperado. Sem resposta marcada, a parede diz isso sem drama: resposta costuma chegar nos dias seguintes, e é em "Reativar clientes" que se marca quem apareceu. A garantia aparece na parede quando a compra a levaria (acima do Corte Honesto e sem garantia usada antes).

- **Marcar continua livre depois da parede.** A recusa da Onda leva junto os contatos que esperam resposta, e a tela mostra a lista "Quem dessa lista apareceu?" embaixo da oferta. Sem isso, a parede mostraria "ninguém respondeu" para quem só não teve onde marcar.
- Primeira Onda que não saiu (nenhuma mensagem) não vira prova: a parede volta a ser a conta da lista.
- Abaixo do Corte Honesto, a recomendação honesta vence — a não ser que a primeira Onda já tenha trazido mais que uma mensalidade.
- A âncora deixa o jargão: "cada cliente seu gasta em média R$ X por visita" no lugar de "ticket médio".

## 3. O anual no momento da prova

Aparece para quem paga mês a mês quando o Dinheiro recuperado dos últimos 30 dias passa de **3 mensalidades**:

- **Pix de 30 dias:** botão para pagar o ano; ele começa quando o passe atual acaba (`periodoDoPasse`).
- **Cartão:** a mesma prova, com a troca pelo WhatsApp de suporte (ou pelo e-mail de atendimento, enquanto o número não estiver configurado). Uma assinatura cancelada no fim do período continua `active`, e o passe comprado nesse meio-tempo começaria a contar na hora — o dono pagaria duas vezes os mesmos dias. A troca assistida evita isso sem mexer na máquina de estados da cobrança.
- Quem já está no anual (o passe de fim mais distante é o anual) não vê a oferta.
- Aparece onde a prova aparece: "Minha conta", "Dinheiro recuperado" e "Meus clientes".

## 4. A implantação no checkout

- `optional_items` da Checkout Session com o Price de `STRIPE_IMPLANTACAO_PRICE_ID`, na assinatura e no pagamento avulso.
- Só oferecida quando: a variável existe, a conta nunca comprou, a semana ainda tem vaga (menos de 5 vendidas desde segunda 0h em Brasília) e a assinatura não está entrando em período de teste.
- Na convergência do checkout pago, os itens da sessão são lidos; com a implantação entre eles, nasce `Implantacao` (uma por empresa, sessão única) e o fundador recebe um e-mail com nome, e-mail e telefone da empresa. A leitura acontece depois do acesso gravado: um problema com a implantação nunca atrasa o que o dono pagou.
- Duas sessões abertas ao mesmo tempo podem cobrar a implantação duas vezes. A segunda não vira outra linha: vai para o ErrorLog como `implantacao-paga-duas-vezes`, para devolver.
- Em "Minha conta", quem comprou vê o botão para marcar pelo WhatsApp de suporte.
- Os Termos descrevem o serviço: chamada de até 30 minutos, o que entra, e devolução se não acontecer em 15 dias por falta de horário da Nexora.

## Termos de 21/09/2026

`VERSAO_DOCUMENTOS` passa a `2026-09-21`, com a cláusula da primeira Onda no lugar da do teste de 7 dias e a cláusula da implantação. Os números saem das constantes (`TAMANHO_DA_ONDA`, `DIAS_DA_PRIMEIRA_ONDA`, `PRECO_IMPLANTACAO_CENTS`).

## Painel e landing

- O painel avisa em que ponto da primeira Onda a conta está: disponível, em andamento (quantas mensagens, até quando) ou usada (a próxima está pronta, com o preço).
- A landing e o cadastro trocam "7 dias grátis" por "a primeira Onda é por nossa conta", mantendo as frases que os testes de promessa amarram. A pergunta "Preciso de cartão de crédito?" acompanha.
- "Meus clientes", para a conta sem plano com a primeira Onda por usar, aponta para ela em vez de pedir um plano.
- A tela da Onda e "Minha conta" param de falar em "1 clique" e em "disparar", e os e-mails de fim de teste param de chamar de "mês grátis" o teste de 7 dias.

## Fora do escopo

Completo e teto do Plantão (Fase 1 do Plantão); troca automática do cartão para o anual; e-mail de fim da primeira Onda.

## Critérios de aceite

- Conta nova nasce em `GRATIS`, gera a primeira Onda e manda até 12 mensagens em até 7 dias, sem cartão; depois a Onda recusa com a oferta e o resultado.
- Conta com os Termos de 18/09 mantém os 7 dias.
- Parede com resultado verdadeiro, inclusive quando ninguém respondeu.
- Anual só aparece acima de 3 mensalidades recuperadas em 30 dias, com o caminho certo para Pix e para cartão.
- Implantação só no checkout quando todas as condições valem; compra registrada uma vez só; fundador avisado.
- Suíte, `tsc --noEmit` e build sem erro.
