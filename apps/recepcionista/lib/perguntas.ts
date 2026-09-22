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
 *
 * A home mostra só quatro (PERGUNTAS_DA_HOME), as dúvidas que ainda seguram
 * quem já leu a página inteira. São os MESMOS objetos da lista completa: mudar
 * a resposta aqui muda nos dois lugares.
 */

export type Pergunta = { pergunta: string; resposta: string };
export type NaoE = { titulo: string; explicacao: string };

const CARTAO: Pergunta = {
  pergunta: "Preciso de cartão de crédito para começar?",
  resposta: `Não. O diagnóstico, a primeira Onda e a primeira semana do Atendente não pedem cartão. Para continuar depois, dá para pagar ${emReais(PLANOS.pix_30_dias.valorCents)} por ${PLANOS.pix_30_dias.dias} dias no Pix, sem renovação automática, ou ${emReais(PRECO_ANUAL_CENTS)} por 12 meses à vista. No cartão, a assinatura é de ${emReais(PRECO_MENSAL_CENTS)} por mês.`,
};

// A conexão do Atendente é por QR Code, que não é a oficial. Prometer que o
// número nunca será restringido seria vender o que não temos como cumprir.
const RISCO: Pergunta = {
  pergunta: "Meu WhatsApp corre risco de ser banido?",
  resposta: `Na reativação, quem manda é você, do seu próprio WhatsApp: ${TAMANHO_DA_ONDA} mensagens por semana, para quem já foi seu cliente — o ritmo de uma pessoa, não o de uma ferramenta de disparo. O Atendente Virtual usa uma conexão por QR Code que não é a oficial do WhatsApp, e números podem ser restringidos. Como ele só responde quem escreveu primeiro, no máximo ${MAX_RESPOSTAS_POR_DIA} respostas por conversa por dia, e nunca manda mensagem sozinho, o risco diminui — mas não zera.`,
};

// O importador lê texto: planilha, lista colada, caderno digitado. Foto de
// caderno só vira lista com alguém digitando, então a página não promete isso.
const SEM_PLANILHA: Pergunta = {
  pergunta: "E se eu não tiver planilha nem computador?",
  resposta:
    "Funciona pelo celular. Você digita a lista do caderno do jeito que der: um cliente por linha, nome e telefone, com a data da última visita e o valor se você lembrar. A Nexora organiza e diz em português o que não conseguiu ler.",
};

const BESTEIRA: Pergunta = {
  pergunta: "O Atendente Virtual responde besteira para os meus clientes?",
  resposta:
    "Preço, horário e serviço saem só do seu cadastro e da sua agenda, e os números são conferidos antes de a mensagem sair. O que ele não sabe, ele não inventa: diz que vai confirmar, anota a pergunta para você e avisa quando a equipe volta.",
};

/** As quatro dúvidas que a home responde, na ordem em que elas aparecem na cabeça de quem vai começar. */
export const PERGUNTAS_DA_HOME: Pergunta[] = [CARTAO, RISCO, SEM_PLANILHA, BESTEIRA];

export const PERGUNTAS_FREQUENTES: Pergunta[] = [
  {
    pergunta: "A Nexora manda mensagem para os meus clientes sozinha?",
    resposta:
      "Para quem sumiu, não: na reativação, ela escreve a mensagem, e você lê e manda do seu próprio WhatsApp. É de propósito — número que manda muita mensagem não pedida pode ser limitado ou bloqueado pelo WhatsApp, e o número do seu negócio é a sua agenda. O Atendente Virtual, se você ligar, só responde quem escreveu primeiro: nunca começa conversa e nunca insiste.",
  },
  RISCO,
  {
    pergunta: "O Atendente Virtual finge ser uma pessoa?",
    resposta:
      "Não. Na primeira resposta do dia, ele se apresenta como atendente virtual do seu negócio, com o nome que você escolher. Preço, horário e endereço ele só diz o que está no seu cadastro, e horário livre ele tira da sua agenda de verdade.",
  },
  BESTEIRA,
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
    pergunta: "O que acontece depois da semana grátis do Atendente?",
    resposta: `A primeira semana é por nossa conta, sem cartão: ${SEMANA_GRATIS_DIAS} dias ou ${SEMANA_GRATIS_CONVERSAS} conversas, o que vier primeiro, a partir de quando você ligar. Depois, ele para de responder até você escolher um plano — e você vê o que ele fez na semana antes de decidir. No plano de ${emReais(PRECO_MENSAL_CENTS)} por mês, ele atende até ${TETO_CONVERSAS_MES} conversas por mês.`,
  },
  CARTAO,
  {
    pergunta: "E se ninguém voltar?",
    resposta: `Aí o dinheiro volta para você. Com a Garantia Dinheiro Recuperado, se em ${GARANTIA_DIAS} dias você mandar as mensagens de ${ONDAS_MINIMAS} ondas, marcar quem voltou e o dinheiro que voltou não chegar a ${emReais(PRECO_MENSAL_CENTS)}, devolvemos tudo o que você pagou. Vale uma vez por negócio, para lista com pelo menos ${MIN_SUMIDOS} clientes sumidos e ${emReais(MIN_RECUPERAVEL_CENTS)} para recuperar.`,
  },
  SEM_PLANILHA,
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

/**
 * OS TRÊS NÃOS QUE SEPARAM A NEXORA DO RESTO.
 *
 * São os três medos de quem já foi queimado: o disparo que derruba o número, o
 * robô de menu que afasta cliente, e a ferramenta que exige um mês de
 * configuração. A honestidade da estimativa não está aqui: ela está na
 * calculadora, que diz, nela mesma, que não é receita garantida.
 */
export const O_QUE_A_NEXORA_NAO_E: NaoE[] = [
  {
    titulo: "Não é disparo em massa",
    explicacao: `São ${TAMANHO_DA_ONDA} mensagens por semana, escolhidas pelo ritmo de cada cliente, e cada uma sai do seu WhatsApp depois que você lê. O ritmo de uma pessoa, não o de um robô.`,
  },
  {
    titulo: "Não é chatbot burro de menu",
    explicacao:
      "Nada de “digite 1 para horários”. O Atendente Virtual entende o que o cliente escreveu e responde com os dados do seu negócio — e só responde quem escreveu primeiro, nunca puxa conversa.",
  },
  {
    titulo: "Não é CRM para você configurar",
    explicacao:
      "Nada de cadastrar cliente por cliente nem de treinamento demorado. Você manda a lista do jeito que ela está, e o Atendente aprende com a agenda e o cadastro que você já tem.",
  },
];
