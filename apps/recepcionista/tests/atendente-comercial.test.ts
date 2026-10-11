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

describe("Atendente Comercial da Nexora — Funil de Alta Conversão", () => {
  it("identifica corretamente a conta mestre padrão como conta comercial", () => {
    expect(ehContaComercialNexora(ID_CONTA_MESTRE_PADRAO)).toBe(true);
    expect(ehContaComercialNexora("outra-empresa-qualquer")).toBe(false);
  });

  it("responde ao primeiro 'Olá' com prova de velocidade, gancho das 23h e pergunta do ramo", async () => {
    const res = await responder(criarEntrada("Olá", { primeiraDoDia: true }), deps);
    expect(res.mensagens).toHaveLength(1);
    const msg = res.mensagens[0];
    expect(msg).toContain("Viu a velocidade dessa resposta?");
    expect(msg).toContain("23h");
    expect(msg).toContain("qual é o ramo do seu negócio");
    expect(res.usouIa).toBe(false);
  });

  it("responde a 'Oi tudo bem' como saudação inicial com gancho", async () => {
    const res = await responder(criarEntrada("Oi tudo bem?"), deps);
    const msg = res.mensagens[0];
    expect(msg).toContain("Viu a velocidade dessa resposta?");
    expect(msg).toContain("qual é o ramo do seu negócio");
  });

  it("quando o lead responde 'Clínica', aplica gancho de 40% das consultas e link com ramo=clinica", async () => {
    const res = await responder(criarEntrada("Clínica"), deps);
    const msg = res.mensagens[0];
    expect(msg).toContain("40% das consultas fora do horário");
    expect(msg).toContain("7 dias grátis");
    expect(msg).toContain("sem pedir cartão");
    expect(msg).toContain("meunexora.com.br/ativar?ramo=clinica");
  });

  it("quando o lead responde 'Odontologia' ou 'Dentista', envia gancho de odonto", async () => {
    const res = await responder(criarEntrada("Sou dentista, tenho consultório"), deps);
    const msg = res.mensagens[0];
    expect(msg).toContain("pacientes de alto valor");
    expect(msg).toContain("meunexora.com.br/ativar?ramo=odonto");
  });

  it("quando o lead responde 'Barbearia', envia gancho de agendamentos à noite e fim de semana", async () => {
    const res = await responder(criarEntrada("Tenho uma barbearia"), deps);
    const msg = res.mensagens[0];
    expect(msg).toContain("noite e no fim de semana");
    expect(msg).toContain("meunexora.com.br/ativar?ramo=barbearia");
  });

  it("quando o lead responde 'Estética', envia gancho de perda para concorrentes", async () => {
    const res = await responder(criarEntrada("Trabalho com estética"), deps);
    const msg = res.mensagens[0];
    expect(msg).toContain("concorrentes que respondem primeiro");
    expect(msg).toContain("meunexora.com.br/ativar?ramo=estetica");
  });

  it("quando o lead responde 'Advocacia' ou 'Advogado', envia gancho de retorno rápido", async () => {
    const res = await responder(criarEntrada("Escritório de advocacia"), deps);
    const msg = res.mensagens[0];
    expect(msg).toContain("retorno rápido no primeiro contato");
    expect(msg).toContain("meunexora.com.br/ativar?ramo=advocacia");
  });

  it("quando o lead responde 'Consultoria' ou 'Agência', envia gancho correspondente", async () => {
    const res = await responder(criarEntrada("Agência de consultoria"), deps);
    const msg = res.mensagens[0];
    expect(msg).toContain("oportunidades valiosas quando o lead esfria");
    expect(msg).toContain("meunexora.com.br/ativar?ramo=consultoria");
  });

  it("quando o lead menciona outro negócio (ex: pet shop, oficina), usa serviços em geral", async () => {
    const res = await responder(criarEntrada("Tenho uma oficina mecânica"), deps);
    const msg = res.mensagens[0];
    expect(msg).toContain("orçamentos valiosos toda noite");
    expect(msg).toContain("meunexora.com.br/ativar?ramo=servicos");
  });

  it("quando o lead pergunta preço sem nicho definido, inverte o risco e convida para informar o nicho", async () => {
    const res = await responder(criarEntrada("Quanto custa?"), deps);
    const msg = res.mensagens[0];
    expect(msg).toContain("A primeira semana é 100% por nossa conta");
    expect(msg).toContain("sem pedir cartão de crédito");
    expect(msg).toContain("R$ 97/mês");
    expect(msg).toContain("qual é o ramo da sua empresa");
  });

  it("quando o lead pergunta preço tendo nicho anterior no histórico, inclui link do ramo", async () => {
    const entrada = criarEntrada("Quanto custa?", {
      historico: [
        { role: "CUSTOMER", content: "Olá" },
        { role: "AI", content: "Qual o seu ramo?" },
        { role: "CUSTOMER", content: "Clínica médica" },
        { role: "AI", content: "Perdem até 40%..." },
        { role: "CUSTOMER", content: "Mas quanto custa a mensalidade?" },
      ],
    });
    const res = await responder(entrada, deps);
    const msg = res.mensagens[0];
    expect(msg).toContain("R$ 97/mês");
    expect(msg).toContain("sem pedir cartão");
    expect(msg).toContain("meunexora.com.br/ativar?ramo=clinica");
  });

  it("quando o lead une nicho e preço na mesma mensagem, responde suavemente sem atrito", async () => {
    const res = await responder(criarEntrada("Olá, tenho uma clínica odontológica, quanto custa?"), deps);
    const msg = res.mensagens[0];
    expect(msg).toContain("pacientes de alto valor");
    expect(msg).toContain("sem pedir cartão de crédito");
    expect(msg).toContain("R$ 97/mês");
    expect(msg).toContain("meunexora.com.br/ativar?ramo=odonto");
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

  it("apresenta a Nexora quando o lead pergunta o que é ou como funciona de forma geral", async () => {
    const res = await responder(criarEntrada("O que é o Nexora? Como funciona?"), deps);
    const msg = res.mensagens[0];
    expect(msg).toContain("atendente inteligente de WhatsApp que nunca dorme");
    expect(msg).toContain("Qual é o ramo do seu negócio");
  });
});
