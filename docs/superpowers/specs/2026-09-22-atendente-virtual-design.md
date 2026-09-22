# Atendente Virtual e a landing da esteira — desenho

- **Data:** 2026-09-22
- **Estado:** pedido do fundador em 22/09/2026 ("Crie seu Atendente Virtual" + landing com a esteira completa). As três decisões em aberto foram delegadas ("faça da melhor forma possível") e estão registradas abaixo.
- **Onde:** `apps/recepcionista`.
- **Base:** o desenho do Plantão aprovado em 21/09/2026 (`docs/superpowers/specs/2026-09-21-plantao-design.md`) e a Fase 0 em produção. Este documento cobre as Fases 1 e 2 dele, com o nome novo.

## O que muda em relação ao Plantão aprovado

| Tema | Plantão (21/09) | Atendente Virtual (22/09) | Por quê |
|---|---|---|---|
| Nome | Plantão, menu "Fora do horário" | **Atendente Virtual**, com nome próprio escolhido pelo dono | Pedido do fundador. O menu diz o que a tela é. |
| Quando atende | Só com a agenda fechada | Agenda fechada **na hora**; no expediente, **quando ninguém responde em 5 minutos** (ligado por padrão, um toque desliga) | O brief pede "à noite ou nos horários de pico". |
| Alcance | Fase 1 oferece, Fase 2 marca | **Marca direto na agenda** (padrão); desligando, só mostra horários com o link | O simulador precisa mostrar "respondendo e agendando". |
| Entrada grátis | — | **Primeira semana por nossa conta**: 7 dias ou 50 conversas desde a primeira vez que liga, sem cartão | Mesma lógica da primeira Onda: prova antes da cobrança. |
| Lembrete antigo | Removido na Fase 1 | Removido agora | O Atendente nunca começa conversa nem insiste. |

O resto do desenho aprovado vale como está: a IA conversa e o sistema decide o que é fato; nunca finge ser gente; o dono manda (respondeu pelo celular, o Atendente sai da conversa); PARAR vale sempre; nada responde sozinho sem o dono ligar.

## 1. Quem ele é

- O dono dá um **nome** (ex.: "Bia"). Na primeira resposta do dia em cada conversa, ele se apresenta: *"Eu sou Bia, atendente virtual da Barbearia do Léo."* Sem nome: *"Aqui é o atendimento virtual da Barbearia do Léo."* O texto evita artigo antes do nome para não supor gênero.
- **Três jeitos de falar**, escolhidos lendo a mesma mensagem escrita nos três: **Acolhedor**, **Direto**, **Descontraído**. Cada jeito tem os próprios textos prontos (saudação, oferta de horários, confirmação, "não sei", pedido de pessoa, reclamação) e orienta a IA nas respostas livres.
- A regra do prompt antigo que mandava a IA nunca dizer que é automática **se inverte**: ela se apresenta como atendente virtual, uma vez.

## 2. Quando ele atende

- **Loja fechada** (o avesso do horário da agenda, mais os dias fechados pelo botão "Fechar hoje"): responde na hora.
- **Loja aberta**: a mensagem é do dono. Se ninguém responder em **5 minutos** e a opção "Também no expediente" estiver ligada (padrão), o Atendente entra.
- **Dono respondeu pelo celular**: o Atendente fica fora daquela conversa por 12 horas (regra da Fase 0).
- **Nunca começa conversa e nunca insiste.** O lembrete automático antigo sai do produto.
- No máximo **8 respostas por conversa por dia**; depois, "anotei para a equipe" e silêncio.

## 3. O que ele sabe fazer

Tudo que é fato vem do banco, por código:

- **Horário livre**: a mesma função da página pública (`calcularSlots`), com os profissionais da agenda. Três opções numeradas, montadas por código, espalhadas no dia (a primeira livre e outras duas com folga de 90 minutos).
- **Marcar**: o cliente responde "2", "11h" ou "o das 11" e o código resolve, na **mesma transação serializável** da página pública, extraída para `lib/agenda/marcacao.ts`. Horário ocupado no meio: oferece os próximos três. Origem `ATENDENTE` na agenda e na lista de clientes.
- **Preço e duração**: do serviço cadastrado. Serviço sem preço: "não tenho o valor confirmado aqui; anotei para a equipe".
- **Horário, endereço e pagamento**: do cadastro, sem IA.
- **Dúvidas**: só com resposta das Perguntas frequentes ou do Treinamento aprovado. O resto passa pela IA, que só escreve a frase; um **verificador** confere todo R$, %, data e hora da resposta contra os fatos. Número que não veio do banco derruba a mensagem, e sai a resposta segura com anotação para o dono.
- **Pessoa, reclamação, urgência**: decididas por palavra, antes da IA, com texto fixo. Urgência de saúde ou segurança manda o cliente para o 192 e avisa o dono no WhatsApp dele (mensagem para o próprio número) e por e-mail.
- **Resposta à Onda**: quando o Atendente marca horário para quem recebeu mensagem da Onda nos últimos 21 dias, o contato da Onda vira "marcou".

## 4. Planos e a semana grátis

| Conta | Atendente |
|---|---|
| Com plano ou teste (ativo, passe, tolerância, cancelado com acesso, teste) | **Incluído**, até **200 conversas por mês**. Passando do teto: texto fixo, sem IA ("anotei, a equipe te responde"), uma vez por conversa por dia, e aviso no painel. |
| Sem plano (grátis, teste vencido, bloqueado, cancelado) | **Primeira semana por nossa conta**: 7 dias ou 50 conversas desde a primeira vez que ligou, uma vez por negócio. Depois, silêncio e a parede com o que a semana fez (conversas atendidas, horários marcados, valor dos atendimentos marcados). |
| Qualquer conta | **Simulador livre**, com limite de uso. |

"Conversa" é uma conversa atendida num dia: a mesma pessoa em dois dias conta duas. É o que dá para contar sem ambiguidade e o que o painel mostra.

Ligar o WhatsApp (`CONECTAR_WHATSAPP`) passa a ser liberado para conta sem plano também enquanto a semana do Atendente estiver disponível ou em andamento.

O **Nexora Completo** (sem teto, equipe ilimitada) **não entra nesta entrega**: exige preços novos na Stripe e o limite de profissionais na agenda, que outra frente está mexendo. Até lá, passar do teto leva ao suporte.

## 5. A tela "Atendente Virtual"

Novo item no menu, o quarto: **Atendente Virtual** (`/painel/atendente`). O teste do menu muda junto, de propósito.

### Antes de ligar: três passos

1. **Quem ele é e como fala.** Campo do nome com sugestões e três cartões com a mesma conversa escrita nos três jeitos, usando o nome do negócio, o primeiro serviço com preço e os próximos horários livres de verdade (ou dados de exemplo marcados como exemplo). Botão "Ouvir em voz alta", quando o navegador tiver voz.
2. **O que ele sabe.** Cartões puxados da agenda e do cadastro, sem formulário: serviços com preço e duração ("editar na Agenda"), horário com atalhos e "Fechar hoje", perguntas que ele já responde (Perguntas frequentes + Treinamento), endereço e pagamento com campo rápido só quando faltam. A semana desenhada: "aberto — você atende · fechado — Bia atende". Duas escolhas: "Marcar direto na agenda" e "Também no expediente, quando ninguém responder em 5 minutos".
3. **Testar e ligar.** O simulador: um WhatsApp na tela, com sugestões ("Tem horário amanhã?", "Quanto custa?", "Onde fica?", "Vocês abrem domingo?"). Roda o próprio motor com os dados reais, sem enviar nada e sem salvar marcação; cada resposta mostra de onde veio o fato. O botão **"Ligar no meu WhatsApp"** aparece depois do primeiro teste; sem WhatsApp ligado, abre a conexão por código ou QR e liga em seguida. Uma frase honesta perto do botão: a conexão por QR não é a oficial do WhatsApp, e números podem ser restringidos; o Atendente só responde quem escreveu primeiro, o que reduz o risco, mas não zera.

### Depois de ligar

- **Estado**: "Bia está atendendo agora" ou "Bia volta a atender hoje às 19h, quando você fechar", com Desligar e Fechar hoje.
- **Enquanto você estava fechado**: conversas atendidas, horários marcados, valor dos atendimentos marcados e a lista "Precisa de você" (pergunta que ele não sabia, pedido de pessoa, reclamação, urgência), cada item com o botão que resolve: responder no WhatsApp ou ensinar no Treinamento.
- **Uso**: "37 de 200 conversas neste mês" ou, na semana grátis, "faltam 4 dias ou 31 conversas".
- Testar de novo e ajustar nome, jeito e escolhas a qualquer momento.

### Resumo da manhã por e-mail

No primeiro minuto depois da abertura, se houve conversa com a loja fechada: um e-mail curto com o que foi marcado e o que precisa do dono, uma vez por dia (`CompanyProfile.atendenteResumoDia` é a reivindicação).

### Regra de ouro das telas

Nenhuma palavra técnica: sem "IA", "inteligência artificial", "prompt", "token", "modelo", "instância", "webhook". O dono vê um funcionário, não uma tecnologia. As telas novas entram na varredura de linguagem do painel.

## 6. A landing da esteira

- **Hero**: a dor que o dono sente hoje — *"Seu cliente mandou mensagem às 22h. Quem respondeu primeiro ficou com ele."* — e a promessa dupla: o Atendente atende quando você não pode e marca na agenda; a Onda traz de volta quem parou de vir. À direita (embaixo no celular), a **demonstração interativa**: um WhatsApp em que o visitante escolhe a cena (22h pedindo horário, domingo perguntando preço, loja cheia sem resposta em 5 minutos) e o jeito de falar, e vê a conversa acontecer com "digitando…". Usa os mesmos textos do motor e se declara exemplo.
- **Os dois jeitos de perder cliente**: "Quando ninguém responde" (Atendente) e "Quando o cliente para de voltar" (Reativação, com a frase aprovada "Seus clientes não avisam que estão indo embora. Eles simplesmente param de voltar.").
- **Atendente Virtual**: os três passos e as regras como argumento (nunca finge ser gente, preço e horário só do cadastro, você manda, não insiste).
- As seções de hoje da reativação: calculadora, Onda de exemplo, como funciona, o que a Nexora não é (revisto para não contradizer agenda e Atendente).
- **Risco zero**: primeira Onda por nossa conta **e** a primeira semana do Atendente. R$ 97/mês com tudo (Atendente até 200 conversas por mês), garantia.
- **Perguntas** novas: se ele finge ser gente, se atende de dia, o que acontece quando não sabe, se o número corre risco, o que acontece depois da semana grátis.
- Todo número sai de constante: `TETO_CONVERSAS_MES`, `SEMANA_GRATIS_DIAS`, `SEMANA_GRATIS_CONVERSAS`, `MINUTOS_SEM_RESPOSTA`, e as da Onda e da garantia.

## 7. Arquitetura

```
lib/atendente/
  constantes.ts   — teto, semana grátis, 5 minutos, 8 respostas, 12 horas
  jeitos.ts       — os três jeitos: textos prontos e a conversa de exemplo (puro)
  intencao.ts     — o que o cliente quer, por palavra (puro)
  datas.ts        — "amanhã de manhã", "sábado", "dia 25", "depois das 18h" (puro)
  oferta.ts       — escolhe três horários, formata e lê a escolha (puro)
  semana.ts       — a semana desenhada: quem atende em cada faixa (puro)
  portao.ts       — acesso (incluído, teto, semana grátis, acabou) e quando responder (puro)
  verificador.ts  — todo número da resposta existe nos fatos? (puro)
  prompt.ts       — as instruções da IA, com a blindagem de hoje e a identidade honesta (puro)
  motor.ts        — decide a resposta; dependências injetadas: horários, marcação, IA
  fatos.ts        — os fatos da empresa, lidos do banco
  uso.ts          — conversas do mês e da semana grátis; registro do atendimento
  executar.ts     — manda, salva e anota (caminho real do WhatsApp)
  resgate.ts      — a cada minuto: resposta do expediente depois de 5 min e resumo da manhã
lib/agenda/marcacao.ts — a marcação serializável, usada pela página pública e pelo Atendente
```

- **O motor é um só** para o WhatsApp real e para o simulador. O simulador troca as dependências: nada é enviado, nada é salvo, e "marcar" só confere se o horário continua livre.
- **Estado da conversa** (`Conversation.atendenteEstado`, Json): a escolha pendente — lista de serviços ou três horários numerados, com a hora em que foi oferecida (vale 2 horas). É isso que faz um "2" virar marcação sem passar pela IA.
- **Envio com "digitando…"**: `enviarWhatsApp` aceita um atraso (1 a 3 s, proporcional ao tamanho), repassado à Evolution.

### Dados (tudo aditivo)

```prisma
// CompanyProfile
plantaoAtivo                 Boolean   @default(false)       // já existe: é o "ligado"
atendenteNome                String    @default("")
atendenteJeito               String    @default("ACOLHEDOR") // ACOLHEDOR | DIRETO | DESCONTRAIDO
atendenteMarca               Boolean   @default(true)        // marcar direto na agenda
atendenteExpediente          Boolean   @default(true)        // entra no expediente depois de 5 min
atendenteTestadoEm           DateTime?                       // o "Ligar" só aparece depois do teste
atendenteLigadoPrimeiraVezEm DateTime?                       // começo da semana grátis
atendenteResumoDia           String    @default("")          // último dia com resumo da manhã
diasFechados                 Json      @default("[]")        // ["2026-10-12"]: "Fechar hoje"

// Conversation
atendenteEstado Json?

// Um atendimento: uma conversa atendida num dia.
model AtendenteAtendimento {
  id, companyId, conversationId, dia ("AAAA-MM-DD" em Brasília)
  criadoEm, atualizadoEm, foraDoHorario Boolean
  respostas Int, marcados Int, valorMarcadoCents Int
  precisaDoDono Boolean, motivo String, urgente Boolean
  clienteNome String?, clienteTelefone String
  @@unique([conversationId, dia]) @@index([companyId, criadoEm])
}
```

## 8. Fora do escopo

Nexora Completo e limite de profissionais; API oficial do WhatsApp; áudio; cancelar ou remarcar pelo Atendente (ele anota para o dono); marcação automática de "respondeu" na Onda quando o cliente só responde.

## 9. Critérios de aceite

- Com o Atendente desligado, nada responde sozinho (menos a confirmação do PARAR).
- Loja fechada: "tem horário amanhã?" recebe três horários reais; "2" marca na agenda com origem ATENDENTE, sem passar pela IA.
- Loja aberta: nada sai antes de 5 minutos; resposta do dono pelo celular cala o Atendente naquela conversa.
- Número inventado pela IA nunca sai: o verificador troca pela resposta segura.
- O simulador usa o mesmo motor, não envia e não salva marcação; o "Ligar" só aparece depois dele.
- Conta sem plano liga de graça por 7 dias ou 50 conversas; depois, silêncio e parede com o resultado.
- Plano: 200 conversas por mês; depois, texto fixo e aviso.
- Menu com quatro itens; telas novas sem jargão; landing sem promessa que o código não cumpre, com os números saindo das constantes.
- Suíte, `tsc --noEmit` e build sem erro.
