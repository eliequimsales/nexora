# Plantão — desenho

- **Data:** 2026-09-21
- **Estado:** aprovado pelo fundador em 21/09/2026 ("Proposta aprovada integralmente"). A Fase 0 começa já; as Fases 1, 2 e 3 ganham plano próprio quando começarem.
- **Onde:** `apps/recepcionista`.
- **Proposta visual:** https://claude.ai/artifact/XXrpFz6QUH6VYNsvfqoMCd — telas, simulador de conversas, regras de segurança e diagramas.
- **Relacionado:** arquitetura comercial (esteira) em https://claude.ai/artifact/2vr6TYfUk5xZC84eK2nzGG.

## Por que

Às 22h o dono de um negócio pequeno tem duas escolhas ruins: responder o WhatsApp e perder a noite, ou deixar para amanhã e perder o cliente para quem responde agora. O Plantão tira essa escolha da mesa: atende o WhatsApp do negócio quando a agenda diz "fechado", mostra horários livres de verdade, marca na agenda e, na abertura, devolve o WhatsApp ao dono com o resumo da noite.

Ele também fecha o ciclo da recuperação: a Onda sai à tarde e a resposta do cliente sumido chega à noite. Sem o Plantão, o "tô precisando" esfria até de manhã.

## Decisões do fundador

| Pergunta | Decisão |
|---|---|
| Nome | **Plantão**. No menu, **"Fora do horário"** — o menu diz o que a tela faz, regra que `tests/painel-nav.test.ts` já cobra. |
| Canal | Começa no **QR Code já conectado** (Evolution), com o risco dito na tela de ativação. A arquitetura deixa a API oficial plugável na Fase 3. |
| Preço | **Incluído no plano**, com um **teto justo** de conversas para proteger a infraestrutura. |
| Horário | **Herdado da agenda**: o Plantão atende quando a agenda diz fechado. Nenhuma tela nova de horário. |
| Identidade | Se apresenta como **atendimento automático** do negócio, uma vez, na primeira mensagem. |

### Preço — decidido pelo fundador em 21/09/2026

A esteira aprovada no mesmo dia punha o Plantão como o que justifica o **Nexora Completo**, e a decisão acima o punha **dentro do plano de R$ 97**. A conciliação foi aprovada assim:

- **Plano Nexora (R$ 97/mês)** inclui o Plantão com teto de **200 conversas por mês**.
- **Nexora Completo (R$ 197/mês)** tira o teto de conversas e libera equipe e profissionais ilimitados.
- Passando do teto, o Plantão **não some**: continua respondendo com texto fixo ("anotei, a equipe responde às 9h"), sem IA, e o painel avisa o dono. O teto vira o gatilho do degrau, em vez de um corte.
- O teto e o Completo entram com a Fase 1. O contador de conversas da noite confirma o número antes do lançamento.

Nada da Fase 0 dependia dessa resposta.

## Princípios

1. **A IA conversa; o sistema decide o que é fato.** Horário livre, preço, duração e resposta aprovada chegam prontos do banco. A IA só escreve a frase em volta, e um verificador confere a saída antes de ela sair.
2. **Nunca finge ser gente.** Às 23h, fingir é o que faz o cliente se sentir enganado quando percebe.
3. **O dono manda.** Desligar vale na hora. Se ele responder pelo celular, o Plantão sai da conversa.
4. **Nunca começa conversa e nunca insiste.** Quem não escolheu horário não recebe "e aí?" de madrugada.
5. **Nada responde sozinho sem o dono ligar.** Conectar o WhatsApp para a Onda não liga atendimento nenhum.

## Como funciona, do lado do dono

- **A tela "Fora do horário"** responde cinco perguntas, na ordem em que o dono as faria: está ligado? Quando atende? Como fala? Até onde vai? Quando me chama?
- **Três toques**: ligar, escolher o jeito de falar (lendo a mesma mensagem escrita de três jeitos), testar e ligar. O botão "Ligar" só aparece depois do primeiro teste no simulador.
- **O simulador** roda o próprio Plantão com os dados reais do negócio, sem enviar nada nem salvar marcação, e mostra de onde veio cada fato.
- **O resumo da manhã** (painel e e-mail): o que foi marcado, o que precisa do dono, com o botão que resolve.
- **Urgência de saúde ou segurança**: texto fixo e revisado para o cliente, alerta no celular do dono, silêncio na conversa.

### Regras de segurança

- Horário livre é calculado por código (a mesma função da página pública) e vai num bloco que a IA não escreve.
- Preço e duração saem do serviço cadastrado; serviço sem preço responde "não tenho confirmado".
- Resposta a pergunta só se o dono aprovou no Treinamento; o resto vira pergunta anotada.
- Verificador de saída: todo R$, %, data e hora da resposta precisa existir nos fatos entregues à IA. Se não existir, a mensagem é trocada pela resposta segura.
- No máximo três frases curtas e um emoji; acompanha a formalidade do cliente.
- Não pede CPF, cartão, endereço completo nem detalhe de saúde.
- Reclamação é acolhida e anotada, nunca discutida. "PARAR" é respeitado na hora.
- No máximo 8 respostas por conversa por noite; depois, "anotei para a equipe".
- A blindagem atual contra "ignore as instruções" continua valendo.
- A regra do prompt atual que manda a IA nunca dizer que é automática **se inverte** no Plantão.

## Arquitetura

### O caminho de cada mensagem

1. **Chega pelo webhook** (token obrigatório e sem repetição — já existe).
2. **Saiu do número do dono?** Se o id está no registro de envios da Nexora, é eco e é ignorada. Senão, o dono assumiu aquela conversa.
3. **Pediu para parar?** Honra e confirma com texto fixo — com ou sem Plantão (já existe).
4. **Portão do Plantão:** desligado, dono assumiu ou agenda aberta → silêncio, com a mensagem já salva.
5. **Urgência, reclamação ou pedido de pessoa?** Decidido por palavras, antes da IA. Texto fixo e anotação para o dono.
6. **Busca os fatos no banco:** horários livres, serviços e preços, respostas aprovadas.
7. **A IA escreve a frase em volta**, no jeito escolhido, sem número próprio.
8. **Verificador:** todo número veio do banco? Se não, resposta segura e anotação.
9. **Envia com "digitando…"** de 1 a 3 segundos, proporcional ao tamanho, e registra o id do envio.

### Estados de uma conversa na noite

`CHEGOU → ENTENDENDO → OFERECENDO → MARCADO`, com `ENTENDENDO → ANOTADO` quando a resposta não está no banco, `OFERECENDO → ENTENDENDO` quando o cliente quer outro dia, e `OFERECENDO → OFERECENDO` (três horários novos) quando o escolhido foi ocupado no meio. De qualquer etapa: `URGENTE`, `COM_O_DONO` e `ENCERRADO` (8 respostas ou fim do turno).

`OFERECENDO` guarda na conversa os três horários oferecidos. É isso que faz um "2" virar marcação sem passar pela IA.

### O turno

O turno abre no fechamento e fecha na abertura. Conversa que começou dentro dele fica com o Plantão até o turno acabar ou o dono assumir; na abertura, as abertas passam para o dono junto com o resumo. Mensagem que chega com a loja aberta é do dono.

### Dados

```prisma
// CompanyProfile
plantaoAtivo          Boolean   @default(false)       // Fase 0
plantaoTestadoEm      DateTime?                       // Fase 1
plantaoJeito          String    @default("ACOLHEDOR") // Fase 1: ACOLHEDOR | DIRETO | DESCONTRAIDO
plantaoAlcance        String    @default("OFERECER")  // Fase 1: AVISAR | OFERECER | MARCAR
plantaoAlertaUrgencia Boolean   @default(true)        // Fase 1: telefone de Company.phone
diasFechados          Json      @default("[]")        // Fase 1: agenda e Plantão leem o mesmo

// Conversation
donoAssumiuEm    DateTime?  // Fase 0
plantaoTurnoId   String?    // Fase 1
plantaoEtapa     String?    // Fase 1
plantaoOferta    Json?      // Fase 2
plantaoRespostas Int @default(0) // Fase 1

// Registro de envios da Nexora — Fase 0
model EnvioWhatsApp { id, instance, messageId, criadoEm; @@unique([instance, messageId]) }

// PlantaoTurno — Fase 1: uma noite fechada, uma linha
// Appointment.source e Customer.source ganham "PLANTAO" — Fase 2
```

Toda mudança de schema é aditiva, com padrão seguro: o boot do container aplica com `prisma db push`, e `--accept-data-loss` continua proibido.

### O canal

Um contrato único de canal — receber, enviar, "digitando…" e "o dono respondeu" — com a Evolution (QR) como primeira implementação e a API oficial com coexistência como segunda, na Fase 3. Na Fase 0 o contrato começa a existir de fato: **todo envio passa por `enviarWhatsApp`**, que envia e registra o id.

## Fase 0 — fechar a porta que já está aberta

Hoje, conectar o WhatsApp para a Onda liga junto o atendente antigo: a conexão configura o webhook (`lib/whatsapp/instance.ts`) e o fluxo da conversa (`lib/conversation-service.ts`) não tem chave de liga/desliga antes da IA. Com o webhook ativo, toda mensagem recebida ganharia resposta automática, 24 horas, de um prompt que manda nunca dizer que é automático. Nos logs de produção lidos em 21/09/2026 não havia nenhuma resposta automática recente.

### Entregas

1. **Chave `plantaoAtivo`, desligada por padrão, e o portão.** Função pura `portaoDoPlantao` decide `DESLIGADO`, `DONO_ASSUMIU` ou `ABERTO` (agenda aberta agora); só responde com o Plantão ligado, a loja fechada e o dono fora da conversa. Entra logo depois do PARAR em `handleIncomingMessage`, e antes de qualquer resposta automática (pedido de pessoa, resposta do cadastro, IA).
2. **Registro de envios.** `sendWhatsAppText` passa a devolver o id da mensagem enviada. `enviarWhatsApp` (em `lib/whatsapp/envio.ts`) envia e registra o id em `EnvioWhatsApp`, e é o único caminho de envio do app: Onda, lembretes da agenda, resposta do dono pelo painel, respostas automáticas e lembrete antigo.
3. **Mensagem do dono (`fromMe`).** Um parser próprio lê as mensagens que saem do número do dono. Com id no registro, é eco da Nexora e é ignorada; com id desconhecido, espera 2,5 s e confere de novo, porque o eco pode chegar antes de o envio terminar de ser registrado; mais velha que 10 minutos, é sincronização de histórico e é ignorada. O resto marca `donoAssumiuEm` na conversa, criando a conversa se ela ainda não existir (só telefone e hora, nunca o texto). O portão fica em silêncio por 12 horas depois disso; a Fase 1 troca a janela fixa pela duração do turno.
4. **Horário único.** `lib/agenda/horario.ts` com `HORARIO_PADRAO` (o padrão que a página pública de agendar já usava: segunda a sexta 8h–20h, sábado 8h–19h, domingo fechado) e `horarioDaEmpresa`, lido pela página de agendar, pelo atendimento e pela tela de configurações. `isOpenNow` continua como está; quem a chama nunca mais passa lista vazia.
5. **Lembrete antigo.** Só roda para empresa com `plantaoAtivo` e WhatsApp ligado. "Instância não existe" (o 404 que aparece a cada 5 minutos nos logs) deixa de ser erro de uma conversa: o perfil é marcado como sem conexão, com o aviso para ligar de novo pelo QR Code, e a rodada daquela empresa para.
6. **Tela de configurações honesta.** Com o WhatsApp conectado, o selo diz "WhatsApp ligado", e não "Atendente online e atendendo"; o teste sugerido deixa de prometer resposta sozinha; e a tela avisa que as respostas automáticas estão desligadas até o Plantão.

### Decisões de implementação

- **PARAR continua confirmado com o Plantão desligado.** É a saída que a Onda oferece, não atendimento — revogação de consentimento vale a qualquer hora.
- **Silêncio não apaga dado.** A mensagem do cliente é salva antes do portão, como hoje.
- **Registro de envios guarda só o id** — nem texto, nem telefone.

### Critérios de aceite

- Com `plantaoAtivo` falso, nenhuma mensagem recebida gera resposta automática, exceto a confirmação de PARAR.
- Com `plantaoAtivo` verdadeiro, a loja aberta segue sem resposta automática.
- Eco de envio da Nexora nunca marca "o dono assumiu"; mensagem digitada pelo dono marca.
- Nenhum arquivo além de `lib/whatsapp/envio.ts` chama `sendWhatsAppText`.
- Página de agendar e atendimento concordam sobre o horário, inclusive sem horário cadastrado.
- O lembrete antigo não roda para ninguém com o Plantão desligado, e para de insistir em instância inexistente.
- Suíte completa, `tsc --noEmit` e build sem erro.

## Fase 1 — o Plantão que avisa e oferece

A tela "Fora do horário" com os três toques e o simulador; `plantaoTestadoEm` como trava do "Ligar"; identidade honesta; fatos injetados do banco; verificador de saída; urgência com alerta; `PlantaoTurno` e o resumo das 9h; contador de mensagens da noite; `diasFechados` e o botão "Fechar hoje". Alcance até "Oferecer horários", com o link da agenda. O lembrete automático antigo é removido: o Plantão não insiste.

## Fase 2 — marcar pela resposta

Oferta numerada guardada na conversa; "2" ou "segunda 10h" resolvidos por código; marcação na mesma transação serializável da página pública; origem `PLANTAO` na agenda e na lista de clientes; resposta à Onda marcada à noite entrando no Dinheiro recuperado pela regra de atribuição de hoje.

## Fase 3 — canal oficial e áudio

O contrato de canal com a API oficial e coexistência no mesmo número como opção de risco zero; ouvir áudio.

## Riscos

- **Classificar eco como dono** silenciaria o Plantão na própria conversa: coberto pelo registro de envios e pela segunda conferência depois de 2,5 s.
- **Classificar o dono como eco** faria o Plantão responder por cima dele: só acontece se o id digitado pelo dono estiver no registro — ids são únicos por instância.
- **Número restringido** no QR: o Plantão só responde a quem escreveu primeiro, e a Onda continua pequena.
- **Horário padrão errado** faria o Plantão falar com a loja aberta: a ativação da Fase 1 mostra ao dono o horário que vale antes de ligar.

## Fora do escopo

Transcrição de áudio antes da Fase 3; atendimento durante o expediente; qualquer envio iniciado pelo Plantão; cobrança por mensagem.
