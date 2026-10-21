import type { ConfiguracaoNexa } from "@/lib/atendente/configuracao-schema";
import type { Fatos } from "@/lib/atendente/fatos";

/** Dados fictícios para testes locais, sem qualquer integração. */
export function configuracaoExemplo(): ConfiguracaoNexa {
  return {
    negocio: { nome: "Oficina Exemplo", segmento: "Oficina", modalidade: "PRESENCIAL", objetivo: "AGENDAMENTOS",
      regiao: { valor: "Centro", situacao: "CONFIRMADO", origem: "MANUAL" },
      descricao: { valor: "Revisão de bicicletas com hora marcada.", situacao: "CONFIRMADO", origem: "MANUAL" } },
    informacoes: {
      endereco: { valor: "Rua Exemplo, 10", situacao: "CONFIRMADO", origem: "MANUAL" },
      pagamento: { valor: "Não aceitamos Pix; aceitamos cartão", situacao: "CONFIRMADO", origem: "MANUAL" },
      horarios: Array.from({ length: 7 }, (_, day) => ({ day, open: "09:00", close: "18:00", closed: day === 0 })),
      horariosSituacao: "CONFIRMADO", diasFechados: [],
      servicos: [{ id: "servico1", nome: "Revisão", descricao: "Revisão de bicicleta", precoModo: "FIXO", precoCents: 9900,
        duracaoMin: 45, situacao: "CONFIRMADO", origem: "MANUAL" }],
    },
    atendimento: { nome: "Nexa", jeito: "DIRETO", quando: "APOIO_EXPEDIENTE", agendamento: "DIRETO", handoffKeywords: ["gerente"] },
    conhecimento: { itens: [{ id: "novo:estacionamento", pergunta: "Tem estacionamento?", resposta: "Não há estacionamento próprio.", situacao: "CONFIRMADO", origem: "MANUAL" }] },
  };
}

export const fatosExemplo: Fatos = {
  empresa: "Nome anterior", nome: "Antiga", jeito: "ACOLHEDOR", marcaDireto: true, expediente: true,
  servicos: [], profissionais: ["Ana"], horarios: [], diasFechados: [], endereco: "Endereço anterior", pagamento: "Pix",
  descricao: "Descrição antiga", pricingInfo: "Preços antigos", productsServices: "Produtos antigos", serviceRules: "Regras antigas",
  perguntas: [{ question: "Tem estacionamento?", answer: "Sim, gratuito." }], linkAgenda: "https://exemplo.test/agendar/oficina",
};
