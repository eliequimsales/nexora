import { responder } from '../apps/recepcionista/lib/atendente/motor.ts';

const FATOS_MESTRE = {
  empresa: "Nexora",
  nome: "Nexora",
  jeito: "FORMAL",
  marcaDireto: false,
  expediente: true,
  servicos: [],
  profissionais: [],
  horarios: [],
  diasFechados: [],
  endereco: "",
  pagamento: "",
  descricao: "Plataforma de inteligência artificial para atendimento no WhatsApp",
  perguntas: [],
  linkAgenda: null,
  comercial: true,
};

const deps = {
  livres: async () => [],
  marcar: async () => ({ ok: false, motivo: "Nao se aplica" }),
  ia: async () => ({ resposta: "IA fallback" }),
};

function criarEntrada(texto, historico = []) {
  return {
    texto,
    historico: historico.length ? historico : [{ role: "CUSTOMER", content: texto }],
    estado: null,
    primeiraDoDia: false,
    clienteNome: "Visitante",
    telefone: "5511999999999",
    fatos: FATOS_MESTRE,
    agora: new Date(),
    contexto: "EXPEDIENTE",
    palavrasDoDono: [],
  };
}

async function main() {
  const casos = [
    { nome: "1. Anúncio Instagram", msg: "Oi, vi o anúncio no Instagram" },
    { nome: "2. Ramo direto (veterinária)", msg: "Boa tarde, sou veterinária e quero saber como funciona" },
    { nome: "3. Indicação imobiliária", msg: "Olá, me indicaram a Nexora para minha imobiliária" },
    { nome: "4. Pergunta sobre áudio", msg: "Ele entende áudio que os clientes mandam?" },
    { nome: "5. Já sou cliente / suporte", msg: "Já sou cliente e preciso de suporte com meu painel" },
    { nome: "6. Nota fiscal", msg: "Vocês emitem nota fiscal para CNPJ?" },
    { nome: "7. Google Agenda / Integração", msg: "Tem integração com a Agenda do Google?" },
    { nome: "8. Segurança / LGPD", msg: "É seguro colocar os dados dos meus clientes?" },
    { nome: "9. Cancelamento", msg: "Como funciona para cancelar se eu não gostar?" },
    { nome: "10. Mensagem informal / curiosa", msg: "Kkkk que massa, isso é de verdade?" },
  ];

  console.log("======================================================================");
  console.log("🔍 TESTE MINUCIOSO DE SITUAÇÕES REAIS DO DIA A DIA");
  console.log("======================================================================\n");

  for (const c of casos) {
    const res = await responder(criarEntrada(c.msg), deps);
    console.log(`📌 CASO: ${c.nome}`);
    console.log(`   LEAD: "${c.msg}"`);
    console.log(`   NEXORA:`);
    for (const m of res.mensagens) {
      console.log(`   > ${m.replace(/\n/g, '\n   > ')}`);
    }
    console.log(`   FONTES: ${res.fontes?.join(', ') || 'nenhuma'}`);
    console.log("----------------------------------------------------------------------\n");
  }
}

main().catch(console.error);
