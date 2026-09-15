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
      "Não. Ela escreve a mensagem, e você lê e manda do seu próprio WhatsApp. É de propósito: número que manda muita mensagem não pedida pode ser limitado ou bloqueado pelo WhatsApp, e o número do seu negócio é a sua agenda.",
  },
  {
    pergunta: "Preciso de cartão de crédito?",
    resposta: `Não para começar: o diagnóstico é grátis e não pede cartão. Para liberar as mensagens, dá para pagar ${emReais(PLANOS.pix_30_dias.valorCents)} por ${PLANOS.pix_30_dias.dias} dias no Pix, sem renovação automática, ou ${emReais(PRECO_ANUAL_CENTS)} por 12 meses à vista. No cartão, a assinatura é de ${emReais(PRECO_MENSAL_CENTS)} por mês.`,
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
    titulo: "Não fala pelo seu número sem você",
    explicacao:
      "Na recuperação de clientes, a Nexora escreve a mensagem e quem manda é você. Nada sai do seu WhatsApp sem você apertar enviar.",
  },
  {
    titulo: "Não é CRM nem sistema de agenda",
    explicacao:
      "Ela não substitui o que você já usa para marcar horário. Cuida de outra coisa: de quem parou de marcar.",
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
