import { PrismaClient } from '@nexora/recepcionista-prisma';

const prisma = new PrismaClient();

const MASTER_COMPANY_ID = 'cmr6swe6z001ym7xu4lcxpxs7';

const RESPOSTAS_DE_CONVERSAO = [
  {
    question: 'Quanto custa?',
    answer: 'O Atendente custa R$ 97 por mês e inclui até 200 conversas mensais (sem contrato e sem fidelidade). Cada pessoa atendida em um dia conta como uma conversa. Você pode experimentar 7 dias grátis sem cadastrar cartão: 👉 https://www.meunexora.com.br/ativar',
  },
  {
    question: 'Como funciona o teste grátis?',
    answer: 'O teste começa quando você liga o Atendente e dura 7 dias (ou até 50 conversas atendidas). Não pede cartão nem cobra nada ao terminar. Você testa na prática e só decide se continua depois: 👉 https://www.meunexora.com.br/ativar',
  },
  {
    question: 'Precisa de outro chip ou número?',
    answer: 'A conexão usa o número que você já tem, sem exigir chip novo nem aparelho extra. Você conecta em 1 minuto pelo celular ou computador, como no WhatsApp Web.',
  },
  {
    question: 'Funciona com WhatsApp Business?',
    answer: 'Sim, funciona perfeitamente com WhatsApp normal e WhatsApp Business! A conexão mantém sua rotina e seu histórico de conversas intactos.',
  },
  {
    question: 'E se meu cliente mandar áudio?',
    answer: 'Hoje o atendimento automático lê e responde mensagens de texto; para áudios, você ou sua equipe podem ouvir e responder normalmente pelo celular.',
  },
  {
    question: 'Posso continuar atendendo junto?',
    answer: 'Sim! Você ou sua equipe podem responder pelo celular a qualquer momento. Quando você envia uma mensagem, a Nexora pausa o robô naquela conversa para priorizar seu atendimento humano.',
  },
  {
    question: 'Vou precisar configurar muita coisa?',
    answer: 'Não! Ao escolher seu ramo, a Nexora já monta seus serviços, horários e dúvidas comuns pré-configurados. Você só precisa conferir e ligar o WhatsApp: 👉 https://www.meunexora.com.br/ativar',
  },
  {
    question: 'Ela agenda automaticamente?',
    answer: 'Sim! Com a agenda Nexora configurada para marcação direta, ela oferece os horários livres e confirma a reserva no WhatsApp na hora.',
  },
  {
    question: 'Atende de madrugada e no fim de semana?',
    answer: 'Sim! Ela atende 24 horas por dia, inclusive de madrugada, domingos e feriados, garantindo que nenhum cliente fique no vácuo fora do expediente.',
  },
  {
    question: 'Como cancela?',
    answer: 'Você cancela pelo próprio painel em 1 clique, sem burocracia e sem precisar falar com ninguém. No teste não há cobrança; na assinatura, seu acesso continua até o fim do mês pago.',
  },
];

async function main() {
  console.log('Atualizando base de conhecimento de vendas da Nexora...');

  for (const item of RESPOSTAS_DE_CONVERSAO) {
    const existing = await prisma.knowledgeItem.findFirst({
      where: {
        companyId: MASTER_COMPANY_ID,
        question: { equals: item.question, mode: 'insensitive' },
      },
    });

    if (existing) {
      await prisma.knowledgeItem.update({
        where: { id: existing.id },
        data: { answer: item.answer, status: 'APPROVED', approvedAt: new Date() },
      });
      console.log(`[ATUALIZADO] ${item.question}`);
    } else {
      await prisma.knowledgeItem.create({
        data: {
          companyId: MASTER_COMPANY_ID,
          question: item.question,
          answer: item.answer,
          source: 'TRAINING',
          status: 'APPROVED',
          approvedAt: new Date(),
        },
      });
      console.log(`[CRIADO] ${item.question}`);
    }
  }

  console.log('Todas as 10 respostas oficiais de conversão foram sincronizadas com sucesso!');
}

main()
  .catch(console.error)
  .finally(() => prisma.$disconnect());
