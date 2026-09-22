import { FORNECEDOR, tipoDoDocumento, VERSAO_DOCUMENTOS } from "./identidade";
import {
  emReais,
  PRECO_ANUAL_CENTS,
  PRECO_IMPLANTACAO_CENTS,
  PRECO_MENSAL_CENTS,
} from "@/lib/billing/preco";
import { MINUTOS_DA_CHAMADA, PRAZO_DA_IMPLANTACAO_DIAS } from "@/lib/billing/implantacao";
import { TOLERANCIA_DIAS } from "@/lib/billing/acesso";
import {
  ENVIOS_POR_ONDA,
  GARANTIA_DIAS,
  ONDAS_MINIMAS,
  PRAZO_PEDIDO_DIAS,
} from "@/lib/billing/garantia";
import { PLANOS } from "@/lib/billing/planos";
import { DIAS_DA_PRIMEIRA_ONDA } from "@/lib/billing/primeira-onda";
import {
  MAX_RESPOSTAS_POR_DIA,
  MINUTOS_SEM_RESPOSTA,
  SEMANA_GRATIS_CONVERSAS,
  SEMANA_GRATIS_DIAS,
  TETO_CONVERSAS_MES,
} from "@/lib/atendente/constantes";
import { MIN_RECUPERAVEL_CENTS, MIN_SUMIDOS } from "@/lib/recuperacao/estimativa";
import { TAMANHO_DA_ONDA } from "@/lib/recuperacao/onda";

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
 * Números vêm das constantes do produto (preço, planos, garantia, tolerância). Se
 * o preço ou a regra da garantia mudar e o texto não, o contrato passa a mentir
 * sozinho — e a garantia negada com uma regra diferente da escrita é a reclamação
 * que chega ao Procon.
 */

export type Secao = { titulo: string; paragrafos: string[]; itens?: string[] };

const PRECO = emReais(PRECO_MENSAL_CENTS);
const DIAS_DO_PASSE = PLANOS.pix_30_dias.dias;

/** "CNPJ 00.000.000/0000-00" ou "CPF 000.000.000-00", pelo documento preenchido. */
function documentoDoFornecedor(): string {
  const tipo = tipoDoDocumento(FORNECEDOR.documento);
  return tipo ? `${tipo} ${FORNECEDOR.documento}` : `documento ${FORNECEDOR.documento}`;
}

export const TERMOS: { atualizadoEm: string; secoes: Secao[] } = {
  atualizadoEm: VERSAO_DOCUMENTOS,
  secoes: [
    {
      titulo: "1. Quem presta o serviço",
      paragrafos: [
        `A Nexora é um serviço prestado por ${FORNECEDOR.nome}, ${documentoDoFornecedor()}, com endereço em ${FORNECEDOR.endereco}. O contato para qualquer assunto, inclusive reclamação e cancelamento, é ${FORNECEDOR.email}.`,
        "Nexora é o nome do serviço. Quem responde juridicamente por ele é quem está identificado acima.",
      ],
    },
    {
      titulo: "2. O que a Nexora faz — e o que ela não faz",
      paragrafos: [
        "Você envia a lista de clientes que já tem. A Nexora calcula, para cada cliente, de quanto em quanto tempo ele costumava voltar, aponta quem quebrou esse ritmo e escreve uma mensagem pronta para cada um.",
        "A mensagem é escrita por regra de programação, com o nome e os dados daquele cliente. Não há inteligência artificial envolvida nessa parte, e nada do que você sobe é usado para treinar modelo de ninguém.",
      ],
      itens: [
        "Na recuperação de clientes, a Nexora NÃO envia mensagem no seu lugar. Você lê, edita se quiser e manda do seu próprio WhatsApp.",
        "A Nexora NÃO garante que algum cliente vá voltar. Ninguém pode garantir isso.",
        "A Nexora NÃO é ferramenta de disparo em massa, e usá-la como se fosse viola estes Termos.",
      ],
    },
    {
      titulo: "2.1. O Atendente Virtual",
      paragrafos: [
        `O Atendente Virtual é um recurso opcional: vem desligado e só funciona depois que você testa uma conversa no simulador e o liga. Ligado, ele responde no seu WhatsApp as mensagens de quem escreveu primeiro — na hora, quando a loja está fechada pelo horário do seu cadastro, e, se você deixar essa opção ligada, no expediente depois de ${MINUTOS_SEM_RESPOSTA} minutos sem resposta. Ele nunca começa conversa, nunca manda lembrete e manda no máximo ${MAX_RESPOSTAS_POR_DIA} respostas por conversa por dia. Se você responder pelo celular, ele sai daquela conversa.`,
        "Ele se apresenta como atendente virtual do seu negócio, com o nome que você escolher, e nunca diz ser uma pessoa.",
        "Horário livre, preço, duração, endereço e formas de pagamento vêm da sua agenda e do seu cadastro, por regra de programação, e a marcação segue a mesma regra do seu link de agendamento. Só nas respostas livres — a dúvida que não tem resposta pronta — um provedor de inteligência artificial escreve a frase, com os fatos do seu cadastro, e um verificador confere cada número antes de a resposta sair. O que ele não sabe, ele diz que não tem confirmado e anota para você.",
        "Mensagem que parece emergência de saúde ou segurança recebe na hora a orientação de ligar para o 192 (ou o 188), e você é avisado no seu WhatsApp e por e-mail. O Atendente não é serviço de emergência.",
        "Você desliga o Atendente quando quiser, pela tela dele. As condições sobre os dados das conversas estão na Política de Privacidade.",
      ],
    },
    {
      titulo: "3. Preço, planos, garantia e cobrança",
      paragrafos: [
        "Sem plano, a Nexora é grátis e sem prazo: você importa a sua lista, vê o diagnóstico de quem sumiu e pode exportar tudo quando quiser, sem cartão.",
        `Toda conta nova ganha a primeira Onda por nossa conta, sem cartão: você gera a Onda da semana e manda até ${TAMANHO_DA_ONDA} mensagens dela em até ${DIAS_DA_PRIMEIRA_ONDA} dias, contados de quando ela é gerada. Depois disso, as próximas Ondas pedem um plano — nada é cobrado sozinho e nada é apagado. Contas criadas com versões anteriores destes Termos mantêm o período gratuito que aceitaram.`,
        `São três planos, todos com a Nexora completa e impostos inclusos, sem taxa de adesão, sem taxa de instalação obrigatória e sem cobrança por cliente cadastrado: ${PRECO} por mês no cartão, com renovação automática; ${emReais(PLANOS.pix_30_dias.valorCents)} por ${DIAS_DO_PASSE} dias, pagos uma vez no Pix ou no cartão; e ${emReais(PRECO_ANUAL_CENTS)} por 12 meses, pagos uma vez no Pix ou no cartão.`,
        `Nos planos de ${DIAS_DO_PASSE} dias e anual não há cobrança automática: quando o período termina, o envio de novas ondas para até você pagar de novo, e nada é apagado. Pagando antes do fim, os dias novos começam depois dos que você já tinha.`,
        `O Atendente Virtual está incluído em todos os planos, até ${TETO_CONVERSAS_MES} conversas por mês — uma conversa é uma pessoa atendida num dia. Passando disso, ele responde a quem escrever, uma vez por dia, só com um aviso de que você responde, sem cobrança extra. Sem plano, a primeira semana do Atendente é por nossa conta, sem cartão: ${SEMANA_GRATIS_DIAS} dias ou ${SEMANA_GRATIS_CONVERSAS} conversas, o que vier primeiro, contados da primeira vez que você o liga, uma vez por negócio. Depois dela, ele para de responder até você escolher um plano; nada é cobrado sozinho.`,
        `Implantação, opcional. No pagamento de um plano você pode acrescentar a implantação, por ${emReais(PRECO_IMPLANTACAO_CENTS)} uma vez: uma chamada de até ${MINUTOS_DA_CHAMADA} minutos, marcada pelo WhatsApp depois do pagamento, em que conferimos a sua lista com você, completamos o que faltar para a Nexora ler certo, ligamos o seu WhatsApp e mandamos juntos as primeiras mensagens da Onda da semana. As vagas são limitadas por semana e, quando acabam, a implantação sai da tela de pagamento até a semana seguinte. Se a chamada não acontecer em até ${PRAZO_DA_IMPLANTACAO_DIAS} dias da compra por falta de horário da Nexora, devolvemos o valor da implantação. O arrependimento da seção 4 vale também para ela.`,
        "Para contratar é preciso confirmar o e-mail antes. Mandamos um link no cadastro e você pode pedir outro pelo painel. A exigência não é burocracia: a lei nos obriga a mandar o comprovante da contratação para o seu e-mail, e não dá para cumprir isso sem ter certeza de que o endereço é seu. Quem entra com o Google já vem confirmado.",
        `No plano mensal, a cobrança é recorrente e processada pela Stripe. Se um pagamento falhar, você continua com acesso normal por ${TOLERANCIA_DIAS} dias enquanto resolve; depois desse prazo o envio de novas ondas para de funcionar, mas seus dados continuam acessíveis para leitura e exportação.`,
        "Aumentos de preço só valem para você depois de avisados por e-mail com pelo menos 30 dias de antecedência. Se não concordar, é só cancelar antes de a nova cobrança acontecer.",
        `Garantia Dinheiro Recuperado. Se, nos primeiros ${GARANTIA_DIAS} dias do primeiro período pago, você mandar as mensagens de pelo menos ${ONDAS_MINIMAS} ondas — uma onda conta quando pelo menos ${ENVIOS_POR_ONDA} mensagens dela saem na mesma semana —, marcar em cada contato se a pessoa voltou, e o Dinheiro recuperado atribuído à Nexora (o valor que aparece em Minha conta) não chegar a ${PRECO}, devolvemos tudo o que você pagou desde essa contratação: as mensalidades, os ${DIAS_DO_PASSE} dias ou o anual.`,
        `O pedido é feito pelo botão em Minha conta, do ${GARANTIA_DIAS}º ao ${GARANTIA_DIAS + PRAZO_PEDIDO_DIAS}º dia, e o painel confere as condições com os dados da sua conta. A garantia vale uma vez por negócio e só quando, na contratação, a sua lista tinha pelo menos ${MIN_SUMIDOS} clientes sumidos e ${emReais(MIN_RECUPERAVEL_CENTS)} para recuperar; quando não é o caso, a tela de planos avisa antes do pagamento. Com a devolução, o plano é encerrado na hora. A garantia não substitui o direito de arrependimento da seção 4 (art. 49 do Código de Defesa do Consumidor), que vale independentemente dela.`,
      ],
    },
    {
      titulo: "4. Cancelamento e arrependimento",
      paragrafos: [
        `Você cancela quando quiser, pelo próprio painel, sem falar com ninguém e sem multa. Ao cancelar, você continua com acesso até o fim do período que já pagou. Nos planos de ${DIAS_DO_PASSE} dias e anual não há o que cancelar: eles não renovam sozinhos.`,
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
        "Na recuperação de clientes, você é quem aperta o botão de enviar no seu WhatsApp, e portanto é quem responde pelo conteúdo enviado.",
        "Com o Atendente Virtual ligado, as respostas saem do seu número com os fatos que você cadastrou: manter preços, horários, serviços e respostas certos é responsabilidade sua.",
      ],
    },
    {
      titulo: "6. Risco de bloqueio do seu número de WhatsApp",
      paragrafos: [
        "O WhatsApp é da Meta e tem regras próprias. Números que enviam muitas mensagens não solicitadas podem ser limitados ou banidos, e o número da sua empresa costuma ser a sua agenda inteira.",
        "A Nexora foi desenhada para reduzir esse risco: ela sugere um número pequeno de mensagens por semana, escolhidas pelo ritmo de cada cliente, e quem tem horário marcado não entra na lista. Mas a decisão de enviar é sua, o número é seu, e a relação com a Meta é sua.",
        "Para o Atendente Virtual responder, o seu WhatsApp é ligado à Nexora por QR Code ou código de pareamento. Essa conexão não é a oficial do WhatsApp, e números ligados assim podem ser restringidos. O Atendente só responde quem escreveu primeiro e nunca manda mensagem sozinho, o que reduz o risco, mas não o zera. A decisão de ligar é sua.",
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
        "Respondemos por falhas do serviço, na forma da lei. O que não assumimos é o resultado comercial: se você mandar as mensagens e nenhum cliente voltar, isso não gera devolução além das hipóteses já descritas neste documento, como a Garantia Dinheiro Recuperado da seção 3.",
        "Também não respondemos por: conteúdo que você escreveu ou alterou antes de enviar, consequências de uso da sua conta por terceiros a quem você deu a senha, e ações de plataformas de terceiros como Meta/WhatsApp.",
        "Nada aqui afasta direitos que o Código de Defesa do Consumidor garante a você quando ele for aplicável.",
      ],
    },
    {
      titulo: "9. Encerramento da sua conta por nós",
      paragrafos: [
        "Podemos encerrar sua conta se você usar a Nexora para disparo em massa, para mensagens ilegais, ou se subir base de clientes que não é sua. Nesses casos avisamos por e-mail, explicamos o motivo e devolvemos o valor proporcional do período pago.",
        "Antes do encerramento, você tem 15 dias para exportar seus dados, exceto quando a lei exigir ação imediata. A exportação fica em Minha base e é um botão: não depende de você pedir nem de nós respondermos.",
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
