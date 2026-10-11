import { describe, expect, it } from "vitest";
import { responder, type DependenciasDoMotor, type EntradaDoMotor } from "@/lib/atendente/motor";
import { ID_CONTA_MESTRE_PADRAO, ehContaComercialNexora } from "@/lib/atendente/comercial-config";
import type { Fatos } from "@/lib/atendente/fatos";

const FATOS_MESTRE: Fatos = {
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

const deps: DependenciasDoMotor = {
  livres: async () => [],
  marcar: async () => ({ ok: false, motivo: "Nao se aplica" }),
  ia: async () => ({ resposta: "IA fallback" }),
};

function criarEntrada(texto: string, extras: Partial<EntradaDoMotor> = {}): EntradaDoMotor {
  return {
    texto,
    historico: [{ role: "CUSTOMER", content: texto }],
    estado: null,
    primeiraDoDia: false,
    clienteNome: "Visitante",
    telefone: "5511999999999",
    fatos: FATOS_MESTRE,
    agora: new Date("2026-10-10T23:00:00Z"),
    contexto: "EXPEDIENTE",
    palavrasDoDono: [],
    ...extras,
  };
}

describe("Atendente Comercial da Nexora — Cobertura Total de Ramos e Nichos", () => {
  it("identifica corretamente a conta mestre padrão como conta comercial", () => {
    expect(ehContaComercialNexora(ID_CONTA_MESTRE_PADRAO)).toBe(true);
    expect(ehContaComercialNexora("outra-empresa-qualquer")).toBe(false);
  });

  it("responde ao primeiro 'Olá' com prova de velocidade, gancho das 23h e pergunta do ramo", async () => {
    const res = await responder(criarEntrada("Olá", { primeiraDoDia: true }), deps);
    const msg = res.mensagens[0];
    expect(msg).toContain("Viu a velocidade dessa resposta?");
    expect(msg).toContain("23h");
    expect(msg).toContain("qual é o ramo do seu negócio");
    expect(res.usouIa).toBe(false);
  });

  // --- SETORES MAPEADOS DO CATÁLOGO ---

  it("responde a Clínica Médica / Consultório", async () => {
    const res = await responder(criarEntrada("Clínica médica"), deps);
    const msg = res.mensagens[0];
    expect(msg).toContain("40% das consultas fora do horário");
    expect(msg).toContain("meunexora.com.br/ativar/clinica");
  });

  it("responde a Odontologia / Dentista", async () => {
    const res = await responder(criarEntrada("Consultório odontológico"), deps);
    const msg = res.mensagens[0];
    expect(msg).toContain("pacientes de alto valor fora do horário comercial");
    expect(msg).toContain("meunexora.com.br/ativar/odonto");
  });

  it("responde a Barbearia", async () => {
    const res = await responder(criarEntrada("Barbearia"), deps);
    const msg = res.mensagens[0];
    expect(msg).toContain("tentam agendar à noite e no fim de semana");
    expect(msg).toContain("meunexora.com.br/ativar/barbearia");
  });

  it("responde a Salão de Beleza / Cabeleireiro / Manicure / Lash", async () => {
    const res = await responder(criarEntrada("Salão de beleza e manicure"), deps);
    const msg = res.mensagens[0];
    expect(msg).toContain("Salões de beleza e profissionais de estética perdem dezenas de agendamentos");
    expect(msg).toContain("meunexora.com.br/ativar/salao");
  });

  it("responde a Estética / Spa", async () => {
    const res = await responder(criarEntrada("Clínica de estética"), deps);
    const msg = res.mensagens[0];
    expect(msg).toContain("Espaços de estética e beleza perdem agendamentos");
    expect(msg).toContain("meunexora.com.br/ativar/estetica");
  });

  it("responde a Pet Shop e Veterinária", async () => {
    const res = await responder(criarEntrada("Pet shop e banho e tosa"), deps);
    const msg = res.mensagens[0];
    expect(msg).toContain("Pet shops e clínicas veterinárias perdem agendamentos");
    expect(msg).toContain("meunexora.com.br/ativar/pet");
  });

  it("responde a Oficina Mecânica / Centro Automotivo", async () => {
    const res = await responder(criarEntrada("Oficina mecânica"), deps);
    const msg = res.mensagens[0];
    expect(msg).toContain("Oficinas e centros automotivos perdem orçamentos");
    expect(msg).toContain("meunexora.com.br/ativar/automotivo");
  });

  it("responde a Fitness / Academia / Personal Trainer", async () => {
    const res = await responder(criarEntrada("Sou personal trainer"), deps);
    const msg = res.mensagens[0];
    expect(msg).toContain("Academias, estúdios e personais perdem alunos novos");
    expect(msg).toContain("meunexora.com.br/ativar/fitness");
  });

  it("responde a Advocacia", async () => {
    const res = await responder(criarEntrada("Escritório de advocacia"), deps);
    const msg = res.mensagens[0];
    expect(msg).toContain("Escritórios de advocacia perdem clientes");
    expect(msg).toContain("meunexora.com.br/ativar/advocacia");
  });

  it("responde a Imobiliária e Corretores", async () => {
    const res = await responder(criarEntrada("Imobiliária"), deps);
    const msg = res.mensagens[0];
    expect(msg).toContain("Imobiliárias e corretores perdem leads quentes");
    expect(msg).toContain("meunexora.com.br/ativar/imobiliaria");
  });

  it("responde a Contabilidade", async () => {
    const res = await responder(criarEntrada("Escritório de contabilidade"), deps);
    const msg = res.mensagens[0];
    expect(msg).toContain("Escritórios de contabilidade perdem clientes empresariais");
    expect(msg).toContain("meunexora.com.br/ativar/contabilidade");
  });

  it("responde a Estúdio de Tatuagem / Piercing", async () => {
    const res = await responder(criarEntrada("Estúdio de tattoo e piercing"), deps);
    const msg = res.mensagens[0];
    expect(msg).toContain("Estúdios de tatuagem e piercing perdem clientes");
    expect(msg).toContain("meunexora.com.br/ativar/tattoo");
  });

  it("responde a Fotografia / Eventos", async () => {
    const res = await responder(criarEntrada("Estúdio de fotografia"), deps);
    const msg = res.mensagens[0];
    expect(msg).toContain("Profissionais de eventos e fotografia perdem contratos");
    expect(msg).toContain("meunexora.com.br/ativar/eventos");
  });

  it("responde a Manutenção / Marcenaria / Vidraçaria / Ar Condicionado", async () => {
    const res = await responder(criarEntrada("Trabalho com ar condicionado e refrigeração"), deps);
    const msg = res.mensagens[0];
    expect(msg).toContain("Profissionais de manutenção e reformas perdem chamados");
    expect(msg).toContain("meunexora.com.br/ativar/manutencao");
  });

  it("responde a Educação / Cursos", async () => {
    const res = await responder(criarEntrada("Escola de cursos e idiomas"), deps);
    const msg = res.mensagens[0];
    expect(msg).toContain("Escolas e cursos perdem matrículas valiosas");
    expect(msg).toContain("meunexora.com.br/ativar/educacao");
  });

  it("responde a Gastronomia / Restaurante / Confeitaria", async () => {
    const res = await responder(criarEntrada("Restaurante e pizzaria"), deps);
    const msg = res.mensagens[0];
    expect(msg).toContain("Restaurantes e confeitarias perdem reservas");
    expect(msg).toContain("meunexora.com.br/ativar/gastronomia");
  });

  it("responde a Consultoria / Agência", async () => {
    const res = await responder(criarEntrada("Agência de consultoria e marketing"), deps);
    const msg = res.mensagens[0];
    expect(msg).toContain("Empresas e consultorias perdem oportunidades");
    expect(msg).toContain("meunexora.com.br/ativar/consultoria");
  });

  // --- EXTRAÇÃO UNIVERSAL DINÂMICA PARA QUALQUER RAMO NÃO CATALOGADO ---

  it("reconhece dinamicamente ramo específico informado com 'tenho uma floricultura'", async () => {
    const res = await responder(criarEntrada("Tenho uma floricultura"), deps);
    const msg = res.mensagens[0];
    expect(msg).toContain("floricultura");
    expect(msg).toContain("perdem orçamentos e clientes valiosos toda noite e fim de semana");
    expect(msg).toContain("meunexora.com.br/ativar/floricultura");
  });

  it("reconhece dinamicamente ramo informado com 'trabalho com energia solar'", async () => {
    const res = await responder(criarEntrada("Trabalho com energia solar"), deps);
    const msg = res.mensagens[0];
    expect(msg).toContain("manutencao"); // Energia solar foi mapeado para manutenção
  });

  it("reconhece dinamicamente ramo informado com 'sou relojoeiro'", async () => {
    const res = await responder(criarEntrada("Sou relojoeiro"), deps);
    const msg = res.mensagens[0];
    expect(msg).toContain("relojoeiro");
    expect(msg).toContain("meunexora.com.br/ativar/relojoeiro");
  });

  it("reconhece resposta direta à pergunta do atendente (ex: 'Ótica')", async () => {
    const entrada = criarEntrada("Ótica", {
      historico: [
        { role: "CUSTOMER", content: "Olá" },
        {
          role: "AI",
          content: "Olá! Viu a velocidade dessa resposta? Me conta: qual é o ramo do seu negócio?",
        },
        { role: "CUSTOMER", content: "Ótica" },
      ],
    });
    const res = await responder(entrada, deps);
    const msg = res.mensagens[0];
    expect(msg).toContain("otica");
    expect(msg).toContain("meunexora.com.br/ativar/otica");
  });

  it("reconhece resposta direta à pergunta do atendente (ex: 'Bicicletaria')", async () => {
    const entrada = criarEntrada("Bicicletaria", {
      historico: [
        { role: "CUSTOMER", content: "Olá" },
        {
          role: "AI",
          content: "Olá! Viu a velocidade dessa resposta? Me conta: qual é o ramo do seu negócio?",
        },
        { role: "CUSTOMER", content: "Bicicletaria" },
      ],
    });
    const res = await responder(entrada, deps);
    const msg = res.mensagens[0];
    expect(msg).toContain("bicicletaria");
    expect(msg).toContain("meunexora.com.br/ativar/bicicletaria");
  });

  // --- PERGUNTAS DE PREÇO E DÚVIDAS OPERACIONAIS ---

  it("quando o lead pergunta preço sem nicho definido, inverte o risco e convida para informar o nicho", async () => {
    const res = await responder(criarEntrada("Quanto custa?"), deps);
    const msg = res.mensagens[0];
    expect(msg).toContain("A primeira semana é 100% por nossa conta");
    expect(msg).toContain("sem pedir cartão de crédito");
    expect(msg).toContain("R$ 97/mês");
    expect(msg).toContain("qual é o ramo da sua empresa");
  });

  it("quando o lead pergunta preço tendo nicho anterior no histórico, preserva o nicho no link", async () => {
    const entrada = criarEntrada("Quanto custa?", {
      historico: [
        { role: "CUSTOMER", content: "Olá" },
        { role: "AI", content: "Qual o seu ramo?" },
        { role: "CUSTOMER", content: "Pet shop" },
        { role: "AI", content: "Pet shops perdem..." },
        { role: "CUSTOMER", content: "Quanto custa o plano?" },
      ],
    });
    const res = await responder(entrada, deps);
    const msg = res.mensagens[0];
    expect(msg).toContain("R$ 97/mês");
    expect(msg).toContain("sem pedir cartão");
    expect(msg).toContain("meunexora.com.br/ativar/pet");
  });

  it("esclarece dúvida de computador ligado / nuvem sem atrito", async () => {
    const res = await responder(criarEntrada("Precisa deixar o computador ligado?"), deps);
    const msg = res.mensagens[0];
    expect(msg).toContain("Não precisa deixar o computador ligado");
    expect(msg).toContain("100% em nuvem");
    expect(msg).toContain("meunexora.com.br/ativar");
  });

  it("esclarece dúvida sobre alucinações da IA", async () => {
    const res = await responder(criarEntrada("E se a inteligência errar ou inventar resposta?"), deps);
    const msg = res.mensagens[0];
    expect(msg).toContain("blindada contra invenções");
    expect(msg).toContain("só responde estritamente o que você ensina");
  });

  it("esclarece dúvida sobre chip novo ou WhatsApp Business", async () => {
    const res = await responder(criarEntrada("Preciso de chip novo ou WhatsApp Business?"), deps);
    const msg = res.mensagens[0];
    expect(msg).toContain("Não precisa de chip novo nem de número extra");
    expect(msg).toContain("WhatsApp atual mesmo em 30 segundos pelo QR Code");
  });

  it("esclarece dúvida sobre como funciona o teste de 7 dias grátis", async () => {
    const res = await responder(criarEntrada("Como funciona o teste grátis? Pede cartão?"), deps);
    const msg = res.mensagens[0];
    expect(msg).toContain("7 dias completos");
    expect(msg).toContain("sem pedir cartão de crédito");
  });

  it("esclarece dúvida sobre como conectar o WhatsApp", async () => {
    const res = await responder(criarEntrada("Como faz para conectar no WhatsApp?"), deps);
    const msg = res.mensagens[0];
    expect(msg).toContain("menos de 1 minuto");
    expect(msg).toContain("QR Code");
    expect(msg).toContain("meunexora.com.br/ativar");
  });

  it("transfere para atendimento humano com acolhimento quando solicitado", async () => {
    const res = await responder(criarEntrada("Quero falar com uma pessoa real"), deps);
    expect(res.equipe).toBe(true);
    const msg = res.mensagens[0];
    expect(msg).toContain("especialista vai te atender por aqui em instantes");
    expect(msg).toContain("meunexora.com.br/ativar");
  });
});
