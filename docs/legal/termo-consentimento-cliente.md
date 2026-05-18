# Termo de Responsabilidade e Consentimento — Tratamento de Dados de Clientes

> **Aviso**: este documento é um modelo de trabalho preparado por um time não jurídico.
> Antes de usar em produção, faça uma revisão com advogado(a) com experiência em LGPD.
> O conteúdo aqui transfere para a barbearia contratante a responsabilidade primária
> sobre o consentimento dos clientes finais. A Nexora atua como operadora de dados.

---

## 1. Partes

**CONTRATANTE** (controladora dos dados pessoais):
- Razão social: ______________________________
- CNPJ (ou CPF se MEI): ______________________
- Endereço: __________________________________
- Responsável legal: __________________________
- Email: ____________________________________

**OPERADORA** (operadora dos dados pessoais):
- Nexora Tecnologia LTDA *(ou nome jurídico equivalente)*
- CNPJ: ____________________________
- Endereço: ____________________________
- Contato DPO: dpo@nexora.com.br

## 2. Objeto

A CONTRATANTE contrata a OPERADORA para prestar serviço de **identificação de
clientes inativos e envio de mensagens de recuperação** (cortesia, lembrete e
reativação), de acordo com a Lei nº 13.709/2018 (**LGPD**).

A OPERADORA tratará os dados pessoais dos clientes da CONTRATANTE
exclusivamente para essa finalidade.

## 3. Dados tratados

A CONTRATANTE fornecerá à OPERADORA, voluntariamente e a seu critério, os
seguintes dados de seus clientes:

- Nome
- Telefone (WhatsApp)
- Email
- Histórico de atendimento (data do último serviço, ticket)

Esses dados são classificados como dados pessoais não sensíveis nos termos do
art. 5º, I, da LGPD.

## 4. Base legal e consentimento

A CONTRATANTE declara, sob sua inteira responsabilidade, que:

- **a) Possui base legal válida** para o tratamento desses dados — seja
  consentimento expresso do cliente final (art. 7º, I da LGPD), execução de
  contrato (art. 7º, V), ou legítimo interesse (art. 7º, IX) com balanceamento
  registrado;
- **b) Informou o cliente final** sobre a finalidade do tratamento, na forma
  do art. 9º da LGPD, antes de coletar o número de telefone/email;
- **c) Obteve consentimento específico** para envio de comunicação comercial
  (incluindo recuperação de cliente inativo) quando o consentimento for a
  base legal aplicável;
- **d) Mantém registro auditável** desse consentimento, com data e meio
  (fichinha física assinada, formulário digital, etc).

A CONTRATANTE reconhece que **a OPERADORA não tem como verificar o
consentimento dos clientes finais** e que **a responsabilidade pelo
consentimento é exclusivamente da CONTRATANTE**.

## 5. Limites do uso

A CONTRATANTE compromete-se a:

- **Não importar** listas de clientes obtidas em desconformidade com a LGPD;
- **Não enviar** mensagens a clientes que tenham solicitado descadastramento
  (opt-out) — o sistema da OPERADORA detecta e bloqueia automaticamente
  palavras como "parar", "sair", "cancelar", mas a obrigação primária
  permanece com a CONTRATANTE;
- **Limitar a frequência** de mensagens (no máximo 1 mensagem de recuperação
  por cliente a cada 30 dias);
- **Não usar** o sistema para fins promocionais agressivos, vendas cruzadas
  não solicitadas, ou comunicação política/religiosa.

## 6. Direitos do titular

A CONTRATANTE é responsável por garantir aos seus clientes os direitos
previstos no art. 18 da LGPD, em especial:

- Acesso aos dados que a CONTRATANTE possui sobre eles;
- Correção de dados incorretos;
- **Eliminação ou anonimização dos dados** mediante solicitação;
- **Revogação do consentimento** a qualquer momento (opt-out).

Quando o cliente final pedir uma dessas ações:

- Se chegar diretamente à CONTRATANTE: a CONTRATANTE atualiza no sistema
  (arquivar lead, marcar opt-out) e a OPERADORA replica o efeito.
- Se chegar à OPERADORA: a OPERADORA executa a ação solicitada e notifica
  a CONTRATANTE em até 5 dias úteis.

## 7. Mensagens via WhatsApp

A CONTRATANTE reconhece que:

- O WhatsApp é uma plataforma de propriedade da Meta, cujos Termos de
  Serviço proíbem o envio de mensagens automatizadas em massa sem uso da
  API oficial (WhatsApp Business Cloud API);
- A OPERADORA disponibiliza dois modos de operação:
  - **Modo manual**: a OPERADORA gera o texto da mensagem, e a CONTRATANTE
    envia pelo WhatsApp Business da própria barbearia. Sem risco de
    violação dos Termos da Meta — a mensagem é enviada manualmente.
  - **Modo automatizado (futuro)**: integração com WhatsApp Business Cloud
    API oficial, sujeita a verificação de negócio e aprovação de templates
    pela Meta.
- A CONTRATANTE **assume integralmente o risco** de eventual penalidade
  aplicada pela Meta caso opte por usar provedores não oficiais
  (Z-API, UltraMsg, etc) por sua própria conta e risco fora da OPERADORA.

## 8. Segurança e confidencialidade

A OPERADORA compromete-se a:

- Armazenar os dados em banco PostgreSQL com criptografia em repouso;
- Limitar acesso aos dados a colaboradores autorizados, com autenticação
  multi-fator;
- Não compartilhar os dados com terceiros, exceto subprocessadores
  estritamente necessários para a operação (provedor de IA, provedor de
  envio de email), todos com contrato de confidencialidade equivalente;
- Comunicar à CONTRATANTE qualquer incidente de segurança em até 24 horas.

## 9. Subprocessadores

A OPERADORA utiliza os seguintes subprocessadores autorizados:

| Subprocessador | Finalidade | Local |
|---|---|---|
| Anthropic (Claude API) | Geração de mensagens | EUA |
| Resend | Envio de email transacional | EUA |
| Stripe | Processamento de pagamento da assinatura | EUA |
| Provedor de banco/hospedagem | Armazenamento | A definir |

A CONTRATANTE manifesta ciência e concorda com a lista acima.

## 10. Rescisão e exclusão de dados

Em caso de rescisão do contrato de prestação de serviço:

- A OPERADORA fornecerá um arquivo CSV com todos os dados dos clientes
  da CONTRATANTE em até 5 dias úteis;
- A OPERADORA excluirá os dados de seus sistemas em até 30 dias após a
  rescisão, salvo obrigação legal de retenção (notas fiscais, audit logs).

## 11. Disposições finais

- Este termo prevalece sobre qualquer disposição conflitante em outros
  documentos contratuais entre as partes;
- A CONTRATANTE pode revisar este termo a qualquer tempo na seção
  "Configurações > Privacidade" do sistema;
- Qualquer alteração será comunicada com antecedência mínima de 30 dias.

---

## Aceite

Ao clicar em "Li e concordo" no cadastro da Nexora, ou ao manter o uso do
sistema, a CONTRATANTE manifesta sua concordância integral com os termos
acima.

**Data do aceite digital**: registrado automaticamente em
`organizations.lgpdAcceptedAt` no momento da assinatura.
