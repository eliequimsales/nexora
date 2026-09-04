import { FORNECEDOR, VERSAO_DOCUMENTOS } from "./identidade";
import type { Secao } from "./termos";

/**
 * CONTRATO DE OPERADOR (LGPD art. 39).
 *
 * A relação mais importante do produto, e a que não existia em lugar nenhum.
 * Antes disto, o único artefato que tratava dela era um checkbox na tela de
 * importação — cujo valor, aliás, nem era gravado.
 *
 * Por que isso importa mais aqui do que em SaaS comum: o assinante sobe dados
 * de TERCEIROS. Os clientes da barbearia nunca ouviram falar da Nexora e nunca
 * concordaram com nada. Sem contrato de operador, se um deles reclamar na ANPD,
 * não existe documento dizendo quem decidiu o quê — e a ausência prejudica os
 * dois lados, porque a Nexora passa a parecer controladora do que não controla.
 *
 * Este texto faz parte dos Termos de Uso e é aceito no mesmo ato.
 */

export const OPERADOR: { atualizadoEm: string; secoes: Secao[] } = {
  atualizadoEm: VERSAO_DOCUMENTOS,
  secoes: [
    {
      titulo: "1. Quem é quem",
      paragrafos: [
        "Você, assinante, é o CONTROLADOR dos dados dos seus clientes: foi você quem os coletou no seu atendimento e é você quem decide para que eles servem.",
        `${FORNECEDOR.nome}, prestando o serviço Nexora, é o OPERADOR: trata esses dados exclusivamente para executar o que você contratou, seguindo a sua instrução.`,
        "Há um caso em que a Nexora não chega nem a ser operadora: quando você escreve de cabeça três clientes que sumiram, em vez de subir a lista. Esse dado é processado no seu próprio aparelho e não chega ao nosso servidor — não há tratamento nosso para contratar, porque não há dado nosso para tratar.",
        "Esta divisão não é formalidade: é o que o art. 39 da LGPD exige que esteja escrito. Ela define quem responde perante a ANPD e perante o titular, e vale mesmo que nenhum de nós goste do resultado em um caso concreto.",
      ],
    },
    {
      titulo: "2. O que a Nexora pode fazer com os dados dos seus clientes",
      paragrafos: ["Apenas o seguinte, e nada além:"],
      itens: [
        "Guardar nome, telefone, datas de atendimento e valores que você importar.",
        "Calcular o intervalo típico de retorno de cada cliente e apontar quem quebrou esse padrão.",
        "Gerar o texto de mensagem que você vai ler, editar se quiser e enviar do seu próprio aparelho.",
        "Registrar o resultado que você marcar (voltou, respondeu, pediu para parar) para organizar a fila seguinte.",
        "Devolver esses dados a você quando pedir, e apagá-los quando pedir.",
        "Guardar registro de cada importação: a data, quantos clientes entraram e o texto exato da declaração que você aceitou naquele dia (art. 37). Se um titular questionar como os dados dele entraram, a resposta existe e tem data.",
        "Ignorar a coluna de procedimento na importação e nunca citar o serviço prestado nas mensagens. Se você é da área de saúde, ligar uma pessoa identificada a um procedimento é dado sensível (art. 11) e exige consentimento específico dela — obrigação sua, como controlador. A Nexora foi construída para não precisar dessa informação, e o que você escrever no nome dos serviços e no campo de observações é responsabilidade sua.",
      ],
    },
    {
      titulo: "3. O que a Nexora não faz, em nenhuma hipótese",
      paragrafos: [],
      itens: [
        "Não vende, aluga nem cede a base para ninguém.",
        "Não usa os dados dos seus clientes para treinar modelo de inteligência artificial.",
        "Não usa a base de um assinante para beneficiar outro, nem cruza bases entre contas.",
        "Não envia mensagem por conta própria aos seus clientes no serviço de recuperação: quem envia é você.",
        "Não contrata subprocessador novo sem atualizar a lista da Política de Privacidade e avisar você com 30 dias de antecedência.",
      ],
    },
    {
      titulo: "4. Subprocessadores autorizados",
      paragrafos: [
        "Você autoriza, ao aceitar este contrato, que os dados fiquem hospedados na infraestrutura listada na seção 5 da Política de Privacidade — hoje, essencialmente, a hospedagem e o banco de dados.",
        "Se você ativar o atendimento automático de WhatsApp, autoriza também os provedores descritos na seção 6 da mesma política, incluindo o envio do conteúdo das conversas para provedor de inteligência artificial fora do Brasil. Esse recurso vem desligado justamente porque a autorização é sua, e específica.",
      ],
    },
    {
      titulo: "5. O que você garante ao importar uma base",
      paragrafos: [
        "Ao subir a lista, você declara — e o sistema registra a data e a versão deste texto no momento da sua declaração:",
      ],
      itens: [
        "Que os dados são de clientes seus, obtidos no seu próprio atendimento.",
        "Que existe base legal para tratá-los, e que você consegue demonstrá-la se for questionado.",
        "Que a lista não foi comprada, alugada, raspada de internet nem obtida de terceiro.",
        "Que você informou ou informará seus clientes sobre esse tratamento, como a lei exige do controlador.",
      ],
    },
    {
      titulo: "6. Quando um cliente seu exercer um direito",
      paragrafos: [
        "O pedido do titular é dirigido a você, controlador. A Nexora te dá a ferramenta: em Minha base você apaga um cliente que pediu para ser apagado e baixa a base inteira em planilha, sem depender de nos avisar e sem prazo de espera. Para o que a tela não resolver, escreva e nós executamos dentro de 15 dias.",
        "Se o pedido chegar primeiro à Nexora, encaminhamos a você e não decidimos sozinhos — porque a decisão não é nossa.",
        "Quando alguém responde PARAR a uma mensagem, o sistema registra o pedido e passa a excluir essa pessoa das próximas ondas. Isso é registro de vontade, não exclusão de dados: para apagar de fato, o pedido precisa ser feito.",
        "Quando você apaga alguém que tinha pedido PARAR, guardamos um código embaralhado do telefone — nunca o número. É o que impede essa pessoa de voltar quando você reimportar a mesma planilha e ser contatada outra vez. Sem ele, apagar desfaria o PARAR, e o titular receberia mensagem de novo justamente por ter exercido dois direitos.",
        "O que você apaga sai de verdade: cadastro, visitas e agendamentos futuros. O que aquela pessoa já gastou continua no seu Livro-Caixa sem o nome dela — aquele número é o seu faturamento, registro seu, e apagá-lo reescreveria a sua contabilidade.",
      ],
    },
    {
      titulo: "7. Segurança e incidentes",
      paragrafos: [
        "As medidas técnicas que existem hoje estão listadas na seção 10 da Política de Privacidade, e o que ainda falta está na seção 11 — sem maquiagem, para você poder avaliar o risco de verdade.",
        "Se houver incidente de segurança que possa causar risco relevante aos titulares, comunicamos você em até 2 dias úteis do conhecimento do fato, com o que se sabe até ali, para que você possa cumprir o seu dever de comunicar a ANPD e os titulares.",
      ],
    },
    {
      titulo: "8. Fim do contrato",
      paragrafos: [
        "Encerrada a assinatura, você continua podendo exportar ou pedir a exclusão da base a qualquer momento. A exportação não é bloqueada por falta de pagamento: reter dado que é seu como forma de cobrança é exatamente o que o art. 18 impede.",
        "Não apagamos nada automaticamente ao cancelamento, justamente para não destruir a base de quem só quis pausar. A eliminação acontece quando você pede.",
      ],
    },
    {
      titulo: "9. Versão",
      paragrafos: [
        `Versão ${VERSAO_DOCUMENTOS}. O aceite fica registrado com data e versão, para que sempre se saiba exatamente qual texto foi aceito.`,
      ],
    },
  ],
};
