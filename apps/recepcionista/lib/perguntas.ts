import {
  MAX_RESPOSTAS_POR_DIA,
  MINUTOS_SEM_RESPOSTA,
  SEMANA_GRATIS_CONVERSAS,
  SEMANA_GRATIS_DIAS,
  TETO_CONVERSAS_MES,
} from "@/lib/atendente/constantes";
import { GARANTIA_DIAS, ONDAS_MINIMAS } from "@/lib/billing/garantia";
import { PLANOS } from "@/lib/billing/planos";
import { emReais, PRECO_ANUAL_CENTS, PRECO_MENSAL_CENTS } from "@/lib/billing/preco";
import { MIN_RECUPERAVEL_CENTS, MIN_SUMIDOS } from "@/lib/recuperacao/estimativa";
import { TAMANHO_DA_ONDA } from "@/lib/recuperacao/onda";

/**
 * AS PERGUNTAS DE QUEM CHEGA, E O QUE A NEXORA NÃO É.
 *
 * Uma lista só para a landing e para as páginas de ramo. A resposta de "e se
 * ninguém voltar?" não pode dizer uma coisa na home e outra na página da
 * barbearia, e cada número vem da constante que o código aplica — resposta de
 * FAQ escrita à mão é a primeira a ficar para trás quando a regra muda.
 */

export type Pergunta = { pergunta: string; resposta: string };
export type NaoE = { titulo: string; explicacao: string };

export const PERGUNTAS_FREQUENTES: Pergunta[] = [
  {
    pergunta: "A Nexora manda mensagem para os meus clientes sozinha?",
    resposta:
      "Para quem sumiu, não: na reativação, ela escreve a mensagem, e você lê e manda do seu próprio WhatsApp. É de propósito — número que manda muita mensagem não pedida pode ser limitado ou bloqueado pelo WhatsApp, e o número do seu negócio é a sua agenda. O Atendente Virtual, se você ligar, só responde quem escreveu primeiro: nunca começa conversa e nunca insiste.",
  },
  {
    pergunta: "O Atendente Virtual finge ser uma pessoa?",
    resposta:
      "Não. Na primeira resposta do dia, ele se apresenta como atendente virtual do seu negócio, com o nome que você escolher. Preço, horário e endereço ele só diz o que está no seu cadastro, e horário livre ele tira da sua agenda de verdade.",
  },
  {
    pergunta: "Ele atende também com a loja aberta?",
    resposta: `Só se ninguém responder em ${MINUTOS_SEM_RESPOSTA} minutos — e só se você deixar essa opção ligada. Com a loja aberta, a mensagem é sua. Se você responder pelo celular, ele sai daquela conversa.`,
  },
  {
    pergunta: "E quando ele não sabe a resposta?",
    resposta:
      "Ele diz que não tem aquela informação confirmada, anota a pergunta para você e avisa quando a equipe volta. Nunca inventa preço, prazo ou desconto. O que você ensinar, ele passa a responder.",
  },
  {
    pergunta: "Meu número corre risco com o Atendente?",
    resposta: `A conexão por QR Code não é a oficial do WhatsApp, e números podem ser restringidos. O Atendente só responde quem escreveu primeiro, no máximo ${MAX_RESPOSTAS_POR_DIA} respostas por conversa por dia, e nunca manda mensagem sozinho — isso reduz o risco, mas não zera.`,
  },
  {
    pergunta: "O que acontece depois da semana grátis do Atendente?",
    resposta: `A primeira semana é por nossa conta, sem cartão: ${SEMANA_GRATIS_DIAS} dias ou ${SEMANA_GRATIS_CONVERSAS} conversas, o que vier primeiro, a partir de quando você ligar. Depois, ele para de responder até você escolher um plano — e você vê o que ele fez na semana antes de decidir. No plano de ${emReais(PRECO_MENSAL_CENTS)} por mês, ele atende até ${TETO_CONVERSAS_MES} conversas por mês.`,
  },
  {
    pergunta: "Preciso de cartão de crédito?",
    resposta: `Não para começar: o diagnóstico e a primeira Onda são grátis e não pedem cartão. Para as próximas Ondas, dá para pagar ${emReais(PLANOS.pix_30_dias.valorCents)} por ${PLANOS.pix_30_dias.dias} dias no Pix, sem renovação automática, ou ${emReais(PRECO_ANUAL_CENTS)} por 12 meses à vista. No cartão, a assinatura é de ${emReais(PRECO_MENSAL_CENTS)} por mês.`,
  },
  {
    pergunta: "E se ninguém voltar?",
    resposta: `Aí o dinheiro volta para você. Com a Garantia Dinheiro Recuperado, se em ${GARANTIA_DIAS} dias você mandar as mensagens de ${ONDAS_MINIMAS} ondas, marcar quem voltou e o dinheiro que voltou não chegar a ${emReais(PRECO_MENSAL_CENTS)}, devolvemos tudo o que você pagou. Vale uma vez por negócio, para lista com pelo menos ${MIN_SUMIDOS} clientes sumidos e ${emReais(MIN_RECUPERAVEL_CENTS)} para recuperar.`,
  },
  {
    pergunta: "Como eu cancelo?",
    resposta:
      "Pelo painel, sem falar com ninguém e sem multa. No mensal, você continua com acesso até o fim do período que já pagou. No Pix e no anual não há o que cancelar: eles não renovam sozinhos.",
  },
  {
    pergunta: "E se a minha lista de clientes for pequena?",
    resposta: `O diagnóstico avisa antes de você pagar. Com menos de ${MIN_SUMIDOS} clientes sumidos ou de ${emReais(MIN_RECUPERAVEL_CENTS)} para recuperar, a recomendação é não assinar agora, porque a mensalidade tende a custar mais do que volta.`,
  },
  {
    pergunta: "Quanto tempo isso toma por semana?",
    resposta: `Uns nove minutos. São ${TAMANHO_DA_ONDA} mensagens prontas, uma vez por semana, para ler, ajustar se quiser e mandar.`,
  },
  {
    pergunta: "O que acontece com a lista que eu colo?",
    resposta:
      "No diagnóstico, a lista não é gravada: ela é lida na memória do servidor e descartada junto com a resposta. Se você criar a conta, a base fica na sua conta e continua sua, para exportar ou apagar pelo painel quando quiser.",
  },
];

export const O_QUE_A_NEXORA_NAO_E: NaoE[] = [
  {
    titulo: "Não é disparo em massa",
    explicacao: `São ${TAMANHO_DA_ONDA} mensagens por semana, escolhidas pelo ritmo de cada cliente, e cada uma sai do seu WhatsApp depois que você lê.`,
  },
  {
    titulo: "Não começa conversa pelo seu número",
    explicacao:
      "Na reativação, a Nexora escreve a mensagem e quem manda é você. O Atendente Virtual, se você ligar, só responde quem escreveu primeiro — nunca puxa conversa nem insiste.",
  },
  {
    titulo: "Não é robô fingindo ser gente",
    explicacao:
      "O Atendente se apresenta como atendente virtual, e preço e horário ele só diz o que está no seu cadastro. O que ele não sabe, ele anota para você.",
  },
  {
    titulo: "Não é CRM",
    explicacao:
      "Não pede para você cadastrar cliente por cliente nem mudar o seu jeito de trabalhar. A agenda que vem junto é simples: o seu link para o cliente marcar sozinho, e é nela que o Atendente marca.",
  },
  {
    titulo: "Não é promessa de faturamento",
    explicacao:
      "A calculadora mostra estimativa, e o Dinheiro recuperado só soma o retorno que dá para ligar a uma mensagem enviada. O que não dá para provar não entra no número.",
  },
  {
    titulo: "Não guarda a lista do diagnóstico",
    explicacao:
      "A lista colada para ver quem sumiu é lida e descartada. Só fica gravada a base que você importa depois de criar a conta.",
  },
];
