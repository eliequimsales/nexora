import { FORNECEDOR, VERSAO_DOCUMENTOS } from "./identidade";
import type { Secao } from "./termos";

/**
 * POLÍTICA DE PRIVACIDADE.
 *
 * Escrita contra a versão anterior, que afirmava quatro coisas falsas:
 * que compartilhávamos com "Nexora e nada além" (são pelo menos cinco
 * terceiros), que os servidores ficavam "no Brasil" (a hospedagem é nos EUA),
 * que a IA "só vê seu nome" (no Atendente ela recebe a conversa inteira) e que
 * dados eram removidos automaticamente após 2 anos (não existe rotina nenhuma).
 *
 * A regra aqui é dura e simples: se o código não faz, o documento não promete.
 * Onde a prática é ruim, o documento DIZ que é ruim em vez de maquiar — quem lê
 * pode decidir com a informação certa, e é isso que o art. 9º pede.
 *
 * A distinção que organiza o texto todo: existem DOIS titulares diferentes.
 * O assinante (dono do negócio), de quem somos controladores; e os clientes
 * dele, de quem somos apenas OPERADORES — quem controla é o dono.
 */

export const PRIVACIDADE: { atualizadoEm: string; secoes: Secao[] } = {
  atualizadoEm: VERSAO_DOCUMENTOS,
  secoes: [
    {
      titulo: "1. Duas pessoas diferentes, dois papéis diferentes",
      paragrafos: [
        "Esta política trata de dois grupos que não se confundem.",
        "VOCÊ, dono do negócio que assina a Nexora. Sobre os seus dados de cadastro e cobrança, nós somos o controlador: decidimos como usá-los e respondemos por eles.",
        "SEUS CLIENTES, cujos nomes e telefones você sobe para o sistema. Sobre eles, quem controla é VOCÊ — foi você quem os atendeu e coletou os dados. A Nexora é apenas operadora: trata esses dados seguindo a sua instrução, e nada além dela. Isso está detalhado no Contrato de Operador, que faz parte dos Termos de Uso.",
      ],
    },
    {
      titulo: "2. O que coletamos de você",
      paragrafos: ["Só o necessário para o serviço existir e para a cobrança acontecer."],
      itens: [
        "Cadastro: nome do negócio, seu nome, e-mail e senha (guardada como hash bcrypt, nunca em texto legível). Se você entrar com o Google, recebemos do Google seu nome e e-mail.",
        "Cobrança: os dados de pagamento são digitados direto na Stripe e não passam pelos nossos servidores. Guardamos apenas identificadores da assinatura, situação do pagamento e, se você informar, telefone, endereço e documento fiscal para a nota.",
        "Uso: registros técnicos de erro, que guardam o tipo do erro e a linha do código — não o conteúdo que você digitou.",
      ],
    },
    {
      titulo: "3. O que acontece com a lista de clientes que você sobe",
      paragrafos: [
        "No Diagnóstico gratuito, a lista NÃO é gravada. Ela é lida na memória do servidor, o resultado volta para a sua tela e é descartada junto com a resposta. Não vai para banco de dados, não vira arquivo e não aparece em registro de erro — inclusive quando dá erro, o sistema registra apenas o tipo da falha, sem o conteúdo colado.",
        "Depois que você cria a conta e importa a base, aí sim os dados ficam guardados: nome, telefone, datas de atendimento e valores. Ficam isolados na sua conta — nenhuma outra empresa do sistema consegue ver, porque toda consulta ao banco é filtrada pela sua conta.",
        "Nada do que você sobe é usado para treinar modelo de inteligência artificial, vendido, alugado ou compartilhado com outros assinantes.",
      ],
    },
    {
      titulo: "4. Com base em quê tratamos esses dados",
      paragrafos: [
        "Dos seus dados de cadastro e cobrança: execução do contrato (LGPD art. 7º, V) e cumprimento de obrigação legal e fiscal (art. 7º, II).",
        "Dos dados dos seus clientes: a base legal é definida por VOCÊ, que é o controlador. Na prática, para convidar de volta um cliente que já foi atendido, costuma-se apoiar no legítimo interesse (art. 7º, IX) ou no consentimento que o cliente deu ao ser atendido. Cabe a você garantir que existe base legal — é o que você declara ao importar a base.",
      ],
    },
    {
      titulo: "5. Quem mais recebe dados, e em que país",
      paragrafos: [
        "Esta lista é o inverso do que a versão anterior deste documento dizia. Ela dizia que não compartilhávamos com ninguém além da Nexora. Isso não era verdade, e aqui está a lista completa:",
      ],
      itens: [
        "Railway (Estados Unidos) — hospeda a aplicação e o banco de dados. Recebe, portanto, tudo que fica guardado: seu cadastro e a base de clientes que você importar.",
        "Stripe (Estados Unidos e Irlanda) — processa a assinatura. Recebe seu nome, e-mail e os dados de pagamento que você digitar lá.",
        "Resend (Estados Unidos) — envia os e-mails que a Nexora manda para você. Recebe seu e-mail e o conteúdo da mensagem. Não recebe dados dos seus clientes.",
        "Google (Estados Unidos) — apenas se você optar por entrar com a conta Google. Nesse caso o Google confirma sua identidade para nós.",
      ],
    },
    {
      titulo: "6. Se você ativar o atendimento automático no WhatsApp",
      paragrafos: [
        "Este recurso é opcional, vem desligado, e enquanto você não o ativar nada abaixo acontece. Se você ativar, a lista da seção anterior aumenta, e é importante que você saiba exatamente como:",
      ],
      itens: [
        "As mensagens que seus clientes enviam passam a chegar ao sistema e ficam gravadas, para o histórico do atendimento.",
        "Para gerar a resposta automática, o conteúdo da conversa é enviado a um provedor de inteligência artificial fora do Brasil (hoje pode ser Groq, OpenAI ou Anthropic, conforme a configuração). Isso significa que a mensagem do seu cliente sai do país.",
        "A conexão com o WhatsApp é feita por integração não oficial, lendo QR code. Isso não é um canal homologado pela Meta e implica o risco de bloqueio descrito nos Termos de Uso.",
        "Se essa transferência internacional não for aceitável para o seu caso, não ative o recurso. A recuperação de clientes — que é o serviço principal — funciona inteira sem ele, e sem enviar nada dos seus clientes para fora.",
      ],
    },
    {
      titulo: "7. Transferência internacional",
      paragrafos: [
        "Como você viu, praticamente toda a infraestrutura fica fora do Brasil. A LGPD permite isso (arts. 33 a 36), desde que você seja informado — é exatamente o que esta seção faz.",
        "Estamos trabalhando para formalizar cláusulas contratuais com cada um desses fornecedores no padrão que a ANPD definiu na Resolução 19/2024. Enquanto isso não estiver concluído, preferimos dizer com todas as letras a fingir que já está.",
      ],
    },
    {
      titulo: "8. Por quanto tempo guardamos",
      paragrafos: [
        "Enquanto sua conta existir. Se você cancelar, seus dados e a base dos seus clientes continuam guardados até que a exclusão seja pedida — não apagamos nada sozinhos, justamente para não destruir a base de quem só quis pausar.",
        "Estamos dizendo isso porque a versão anterior deste documento prometia exclusão automática depois de 2 anos, e essa rotina nunca existiu no sistema. Preferimos corrigir a promessa a mantê-la no papel.",
        "Registros necessários para obrigação legal ou fiscal, como comprovantes de pagamento, são guardados pelo prazo que a lei exigir.",
        "Uma coisa sobrevive à exclusão, e é melhor dizer isso com clareza: quando alguém que tinha pedido PARAR é apagado, guardamos um código embaralhado do telefone dessa pessoa — não o número. Sem isso, ela voltaria na próxima vez que o negócio importasse a mesma planilha e seria contatada de novo, o que transformaria o direito exercido em incômodo repetido. Esse código não permite ligar, mandar mensagem nem descobrir de quem é; serve só para reconhecer e barrar (LGPD art. 16, III).",
      ],
    },
    {
      titulo: "9. Seus direitos, e como exercer",
      paragrafos: [
        `A LGPD (art. 18) garante que você saiba o que temos, corrija, exclua, revogue consentimento e saiba com quem compartilhamos. Para exercer qualquer um deles, escreva para ${FORNECEDOR.email}. Respondemos em até 15 dias.`,
        "Dois desses direitos não dependem de nos escrever: em Minha base, você baixa a sua lista inteira em planilha quando quiser, e apaga um cliente que pediu para ser apagado sem precisar da nossa autorização. Direito que depende de alguém do outro lado lembrar de executar não é direito garantido.",
        `Encarregado pelo tratamento de dados (art. 41): ${FORNECEDOR.encarregado}.`,
        "Você também pode reclamar diretamente à Autoridade Nacional de Proteção de Dados (ANPD), em gov.br/anpd.",
        "Se você é cliente de um negócio que usa a Nexora e quer parar de receber mensagens ou apagar seus dados, o caminho mais rápido é falar com o próprio negócio, que é quem controla esses dados — ele consegue apagar você sozinho, na hora. Responder PARAR à mensagem também registra o pedido. Se preferir, escreva para nós que encaminhamos.",
      ],
    },
    {
      titulo: "10. Como protegemos — e o que ainda falta",
      paragrafos: [
        "O que existe hoje, de verdade:",
      ],
      itens: [
        "Senhas guardadas como hash bcrypt, nunca em texto legível.",
        "Sessão em cookie httpOnly, que o JavaScript da página não consegue ler, com expiração automática.",
        "Isolamento entre contas: toda consulta ao banco filtra pela sua empresa.",
        "Limite de tentativas nas rotas sensíveis, para dificultar ataque de força bruta.",
        "Link de recuperação de senha de uso único, guardado como hash e válido por 1 hora.",
        "Dados de cartão nunca passam pelos nossos servidores — vão direto para a Stripe.",
      ],
    },
    {
      titulo: "11. O que ainda não temos",
      paragrafos: [
        "Esta seção existe porque a versão anterior prometia autenticação em dois fatores, e ela não existe. Preferimos listar o que falta a deixar você achar que tem.",
        "Não temos: autenticação em dois fatores, certificação de segurança auditada por terceiro, e rotina automática de expurgo de dados antigos.",
        "Se acontecer um incidente de segurança que possa causar risco relevante a você ou aos seus clientes, avisaremos você e a ANPD, na forma do art. 48 da LGPD.",
      ],
    },
    {
      titulo: "12. Cookies, e o que mais fica no seu navegador",
      paragrafos: [
        "Dois cookies, os dois estritamente necessários e nenhum deles de publicidade. O rd_session mantém você conectado depois do login. O rd_oauth vive dez minutos e existe só enquanto você entra com o Google: ele é o que impede alguém de te levar para dentro de uma conta que não é sua.",
        "Guardamos também um número sorteado na memória da aba (sessionStorage), que some quando você fecha a aba. Ele serve para uma coisa só: saber em que ponto as pessoas desistem do diagnóstico — se travam ao colar a lista, se desistem antes de ver o número. Não identifica você, não atravessa visitas e não sai daqui.",
        "Não usamos cookie de publicidade, não temos pixel de rede social e não fazemos rastreamento de comportamento entre sites. Como a medição é só nossa, é do que acontece nesta página e não identifica ninguém, ela não depende de consentimento — mas preferimos dizer que ela existe a deixar você descobrir sozinho.",
        "Antes esta seção dizia que havia um cookie só e que não existia nada a recusar. Deixou de ser verdade quando acrescentamos a proteção do login com Google e a medição do funil, e corrigimos assim que percebemos.",
      ],
    },
    {
      titulo: "13. Dados sensíveis, e por que a Nexora não quer os seus",
      paragrafos: [
        "A tela de diagnóstico oferece Odontologia, Fisioterapia e Estética entre os tipos de negócio. Precisamos ser diretos sobre o que isso significa: numa clínica, saber que uma pessoa identificada fez determinado procedimento é dado de saúde — dado sensível pela LGPD (art. 11), que exige consentimento específico e destacado do próprio titular e não pode se apoiar em legítimo interesse.",
        "Por isso a Nexora foi construída para não precisar dessa informação. A importação lê nome, telefone, data da visita e valor — e ignora a coluna de procedimento, mesmo quando ela está na planilha. As mensagens de recuperação nunca citam qual serviço a pessoa fez: falam do tempo que passou e convidam a voltar, e nada além disso.",
        "O que ainda pode conter dado sensível são campos que você mesmo preenche: o nome dos serviços que você cadastra e o campo de observações do cliente. Se você atua na área de saúde, esses dois campos são de sua responsabilidade como controlador, incluindo o consentimento específico do art. 11. Nossa recomendação é simples: não escreva no cadastro nada que você não escreveria num bilhete deixado no balcão.",
      ],
    },
    {
      titulo: "14. Crianças e adolescentes",
      paragrafos: [
        "A Nexora não é destinada a menores de 18 anos como assinantes.",
        "Alguns negócios atendem crianças, e a lista importada pode conter dados de menores. A LGPD (art. 14) exige, nesse caso, consentimento específico de um dos pais ou responsável, e a responsabilidade por obtê-lo é do negócio que coletou o dado — não da Nexora. Recomendamos fortemente não incluir menores na base de recuperação.",
      ],
    },
    {
      titulo: "15. Mudanças",
      paragrafos: [
        `Versão ${VERSAO_DOCUMENTOS}. Mudanças relevantes são avisadas por e-mail com 30 dias de antecedência, e cada versão fica registrada junto com a data em que você a aceitou.`,
      ],
    },
  ],
};
