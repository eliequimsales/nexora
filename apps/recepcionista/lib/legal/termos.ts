import { FORNECEDOR, VERSAO_DOCUMENTOS } from "./identidade";
import { emReais, PRECO_MENSAL_CENTS } from "@/lib/billing/preco";
import { TOLERANCIA_DIAS, TRIAL_DIAS } from "@/lib/billing/acesso";

/**
 * TERMOS DE USO.
 *
 * Escritos para serem LIDOS, não para intimidar. O leitor é dono de barbearia,
 * não advogado: frases curtas, sem latim, e cada obrigação dita na voz ativa.
 *
 * REGRA QUE GOVERNA CADA LINHA: só afirmar o que o código faz hoje. Os dois
 * documentos que existiam antes prometiam MFA, exclusão automática em 2 anos,
 * exportação em CSV em 5 dias úteis e "servidores no Brasil" — nada disso
 * existia. Documento que promete a mais não protege ninguém: ele vira prova
 * contra quem escreveu.
 *
 * Números vêm das constantes do produto (preço, trial, tolerância). Se o preço
 * mudar e o texto não, o contrato passa a mentir sozinho.
 */

export type Secao = { titulo: string; paragrafos: string[]; itens?: string[] };

const PRECO = emReais(PRECO_MENSAL_CENTS);

export const TERMOS: { atualizadoEm: string; secoes: Secao[] } = {
  atualizadoEm: VERSAO_DOCUMENTOS,
  secoes: [
    {
      titulo: "1. Quem presta o serviço",
      paragrafos: [
        `A Nexora é um serviço prestado por ${FORNECEDOR.nome}, inscrito no CPF ${FORNECEDOR.documento}, com endereço em ${FORNECEDOR.endereco}. O contato para qualquer assunto, inclusive reclamação e cancelamento, é ${FORNECEDOR.email}.`,
        "Nexora é o nome do serviço. Quem responde juridicamente por ele é a pessoa identificada acima.",
      ],
    },
    {
      titulo: "2. O que a Nexora faz — e o que ela não faz",
      paragrafos: [
        "Você envia a lista de clientes que já tem. A Nexora calcula, para cada cliente, de quanto em quanto tempo ele costumava voltar, aponta quem quebrou esse ritmo e escreve uma mensagem pronta para cada um.",
        "A mensagem é escrita por regra de programação, com o nome e os dados daquele cliente. Não há inteligência artificial envolvida nessa parte, e nada do que você sobe é usado para treinar modelo de ninguém.",
      ],
      itens: [
        "A Nexora NÃO envia mensagem no seu lugar. Você lê, edita se quiser e manda do seu próprio WhatsApp.",
        "A Nexora NÃO garante que algum cliente vá voltar. Ninguém pode garantir isso.",
        "A Nexora NÃO é ferramenta de disparo em massa, e usá-la como se fosse viola estes Termos.",
        "Existe um recurso opcional de atendimento automático que conecta seu WhatsApp. Ele só funciona se você o ativar, e enquanto não ativar, nada do seu WhatsApp é acessado. As condições específicas dele estão na Política de Privacidade.",
      ],
    },
    {
      titulo: "3. Preço, teste grátis e cobrança",
      paragrafos: [
        `O serviço custa ${PRECO} por mês, com impostos inclusos. Esse é o valor total: não há taxa de adesão, taxa de instalação nem cobrança por cliente cadastrado.`,
        `Os primeiros ${TRIAL_DIAS} dias são gratuitos e não pedimos cartão para começar. Terminado o período gratuito, se você não tiver cadastrado forma de pagamento, a conta simplesmente pausa — nada é cobrado e nada é apagado.`,
        `A cobrança é mensal e recorrente, processada pela Stripe. Se um pagamento falhar, você continua com acesso normal por ${TOLERANCIA_DIAS} dias enquanto resolve; depois desse prazo o envio de novas ondas para de funcionar, mas seus dados continuam acessíveis para leitura e exportação.`,
        "Aumentos de preço só valem para você depois de avisados por e-mail com pelo menos 30 dias de antecedência. Se não concordar, é só cancelar antes de a nova cobrança acontecer.",
      ],
    },
    {
      titulo: "4. Cancelamento e arrependimento",
      paragrafos: [
        "Você cancela quando quiser, pelo próprio painel, sem falar com ninguém e sem multa. Ao cancelar, você continua com acesso até o fim do período que já pagou.",
        "Arrependimento (art. 49 do Código de Defesa do Consumidor): como a contratação é feita pela internet, você tem 7 dias corridos, contados da contratação, para desistir e receber de volta o que tiver pago no período. Basta pedir por e-mail para o endereço da seção 1.",
        "Cancelar não apaga seus dados automaticamente. Se quiser que sejam apagados, peça — a Política de Privacidade explica como e em quanto tempo isso acontece.",
      ],
    },
    {
      titulo: "5. Suas responsabilidades sobre a lista de clientes",
      paragrafos: [
        "Esta é a parte mais importante do documento, e a que mais gente ignora.",
        "Os clientes que você sobe para a Nexora são SEUS clientes. Perante a Lei Geral de Proteção de Dados, você é o CONTROLADOR desses dados: foi você quem os coletou, é você quem decide para que servem, e é você quem responde por eles. A Nexora é OPERADORA — trata os dados seguindo a sua instrução, e nada além dela.",
      ],
      itens: [
        "Você declara que obteve esses dados de forma legítima, no seu próprio atendimento, e que tem base legal para tratá-los.",
        "Você não sobe lista comprada, alugada, raspada de site, nem lista de clientes de outra pessoa.",
        "Você respeita quem pede para parar de receber mensagens, e marca isso no sistema quando o pedido chegar por fora dele.",
        "Você não usa a Nexora para propaganda em massa, corrente, golpe, cobrança abusiva ou qualquer mensagem que você não mandaria olhando a pessoa na cara.",
        "Você é quem aperta o botão de enviar no seu WhatsApp, e portanto é quem responde pelo conteúdo enviado.",
      ],
    },
    {
      titulo: "6. Risco de bloqueio do seu número de WhatsApp",
      paragrafos: [
        "O WhatsApp é da Meta e tem regras próprias. Números que enviam muitas mensagens não solicitadas podem ser limitados ou banidos, e o número da sua empresa costuma ser a sua agenda inteira.",
        "A Nexora foi desenhada para reduzir esse risco: ela sugere um número pequeno de mensagens por semana, escolhidas pelo ritmo de cada cliente, e quem tem horário marcado não entra na lista. Mas a decisão de enviar é sua, o número é seu, e a relação com a Meta é sua.",
        "Não temos como garantir que a Meta não vá agir contra o seu número, e não respondemos por bloqueio, limitação ou banimento aplicado por ela.",
      ],
    },
    {
      titulo: "7. Disponibilidade e limites honestos",
      paragrafos: [
        "A Nexora é um serviço em construção, mantido por uma equipe pequena. Não prometemos disponibilidade ininterrupta, não temos plantão 24 horas e pode haver manutenção sem aviso.",
        "Fazemos o que está ao nosso alcance para o serviço funcionar e para seus dados não se perderem, mas você não deve usar a Nexora como único lugar onde a sua base de clientes existe. Mantenha a sua planilha.",
        "Se o serviço ficar indisponível por período relevante dentro de um mês pago, avise pelo e-mail da seção 1 e devolvemos a parte proporcional.",
      ],
    },
    {
      titulo: "8. Até onde vai a nossa responsabilidade",
      paragrafos: [
        "Respondemos por falhas do serviço, na forma da lei. O que não assumimos é o resultado comercial: se você mandar as mensagens e nenhum cliente voltar, isso não gera devolução além das hipóteses já descritas neste documento.",
        "Também não respondemos por: conteúdo que você escreveu ou alterou antes de enviar, consequências de uso da sua conta por terceiros a quem você deu a senha, e ações de plataformas de terceiros como Meta/WhatsApp.",
        "Nada aqui afasta direitos que o Código de Defesa do Consumidor garante a você quando ele for aplicável.",
      ],
    },
    {
      titulo: "9. Encerramento da sua conta por nós",
      paragrafos: [
        "Podemos encerrar sua conta se você usar a Nexora para disparo em massa, para mensagens ilegais, ou se subir base de clientes que não é sua. Nesses casos avisamos por e-mail, explicamos o motivo e devolvemos o valor proporcional do período pago.",
        "Antes do encerramento, você tem 15 dias para exportar seus dados, exceto quando a lei exigir ação imediata.",
      ],
    },
    {
      titulo: "10. Mudanças nestes Termos",
      paragrafos: [
        `Esta é a versão ${VERSAO_DOCUMENTOS}. Se mudarmos algo relevante, avisamos por e-mail com 30 dias de antecedência e a versão fica registrada. Continuar usando depois do aviso significa aceitar a nova versão; se não concordar, cancele antes de ela entrar em vigor.`,
      ],
    },
    {
      titulo: "11. Lei e foro",
      paragrafos: [
        "Aplica-se a lei brasileira. Ficam eleitos, para resolver qualquer disputa, os tribunais do seu domicílio — é o que o Código de Defesa do Consumidor determina quando você for consumidor, e é o que adotamos de qualquer forma, para não obrigar ninguém a litigar longe de casa.",
        "Antes de qualquer processo, escreva para o e-mail da seção 1. A maioria das coisas se resolve em uma conversa.",
      ],
    },
  ],
};
