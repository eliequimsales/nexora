import { formatBusinessHoursCompact } from "@/lib/ai/quick-reply";
import { horarioDaEmpresa, lerDiasFechados } from "@/lib/agenda/horario";
import { ehEquipeDeExemplo } from "@/lib/agenda/livres";
import { listarProfissionais, listarServicos } from "@/lib/agenda/painel";
import { emReais } from "@/lib/billing/preco";
import { prisma } from "@/lib/db";
import { getApprovedKnowledge } from "@/lib/training";
import type { BusinessHour, Faq } from "@/lib/validation";
import { lerJeito, type Jeito } from "./jeitos";

/**
 * OS FATOS DA EMPRESA — A ÚNICA FONTE DO ATENDENTE VIRTUAL.
 *
 * Serviços, preços e duração vêm da agenda; horário, endereço e pagamento, do
 * cadastro; perguntas, das Perguntas frequentes e do Treinamento aprovado.
 * Nada disto é pedido ao dono de novo: o passo 2 da tela só mostra o que já
 * existe e aponta onde ajustar.
 *
 * Duas exclusões de propósito:
 *   - A equipe de exemplo da agenda ("Profissional Carlos") não vira nome para o
 *     cliente.
 *   - `serviceRules` guarda a lista de profissionais em JSON desde a agenda
 *     inteligente; aqui ele nunca entra como "regra da empresa".
 */

export type ServicoDoAtendente = { id: string; nome: string; precoCents: number; duracaoMin: number };

export type Fatos = {
  empresa: string;
  nome: string;
  jeito: Jeito;
  marcaDireto: boolean;
  expediente: boolean;
  servicos: ServicoDoAtendente[];
  profissionais: string[];
  horarios: BusinessHour[];
  diasFechados: string[];
  endereco: string;
  pagamento: string;
  perguntas: Faq[];
  linkAgenda: string | null;
};

/** O que o simulador testa antes de o dono salvar. */
export type Sobrescrita = Partial<Pick<Fatos, "nome" | "jeito" | "marcaDireto">>;

function lerPerguntas(valor: unknown): Faq[] {
  if (!Array.isArray(valor)) return [];
  return valor.filter(
    (f): f is Faq =>
      !!f && typeof f.question === "string" && typeof f.answer === "string" && f.question.trim() !== "" && f.answer.trim() !== "",
  );
}

export async function fatosDaEmpresa(companyId: string, sobrescrever: Sobrescrita = {}): Promise<Fatos> {
  const [empresa, servicos, equipe, treinamento] = await Promise.all([
    prisma.company.findUnique({
      where: { id: companyId },
      select: {
        name: true,
        slug: true,
        profile: {
          select: {
            atendenteNome: true,
            atendenteJeito: true,
            atendenteMarca: true,
            atendenteExpediente: true,
            businessHours: true,
            diasFechados: true,
            address: true,
            paymentMethods: true,
            faqs: true,
          },
        },
      },
    }),
    listarServicos(companyId),
    listarProfissionais(companyId),
    getApprovedKnowledge(companyId),
  ]);

  const perfil = empresa?.profile;
  const appUrl = (process.env.APP_URL ?? "").replace(/\/+$/, "");

  return {
    empresa: empresa?.name ?? "",
    nome: sobrescrever.nome ?? perfil?.atendenteNome ?? "",
    jeito: sobrescrever.jeito ?? lerJeito(perfil?.atendenteJeito),
    marcaDireto: sobrescrever.marcaDireto ?? perfil?.atendenteMarca ?? true,
    expediente: perfil?.atendenteExpediente ?? true,
    servicos: servicos.map((s) => ({ id: s.id, nome: s.name, precoCents: s.priceCents, duracaoMin: s.durationMin })),
    profissionais: ehEquipeDeExemplo(equipe) ? [] : equipe.map((e) => e.nome),
    horarios: horarioDaEmpresa(perfil?.businessHours),
    diasFechados: lerDiasFechados(perfil?.diasFechados),
    endereco: (perfil?.address ?? "").trim(),
    pagamento: (perfil?.paymentMethods ?? "").trim(),
    perguntas: [...lerPerguntas(perfil?.faqs), ...treinamento],
    linkAgenda: appUrl && empresa?.slug ? `${appUrl}/agendar/${empresa.slug}` : null,
  };
}

/** As palavras que o dono cadastrou para ser chamado ("gerente", "orçamento"). */
export function lerPalavrasDoDono(valor: unknown): string[] {
  return Array.isArray(valor) ? valor.filter((p): p is string => typeof p === "string" && p.trim() !== "") : [];
}

/** "R$ 45,00", com espaço comum: a mensagem vai para o WhatsApp do cliente. */
export function precoFalado(cents: number): string {
  return emReais(cents).replace(/ /g, " ");
}

export function duracaoFalada(minutos: number): string {
  return `${minutos} min`;
}

/**
 * O texto dos fatos: é o que a IA recebe e o que o verificador confere. O que
 * falta é escrito como falta — nunca preenchido com um palpite.
 */
export function textoDosFatos(f: Fatos): string {
  const servicos = f.servicos.length
    ? f.servicos
        .map(
          (s) =>
            `${s.nome} — ${s.precoCents > 0 ? precoFalado(s.precoCents) : "valor não cadastrado"}, ${duracaoFalada(s.duracaoMin)}`,
        )
        .join("; ")
    : "nenhum cadastrado";

  const linhas = [
    `Empresa: ${f.empresa}.`,
    `Serviços: ${servicos}.`,
    ...(f.profissionais.length ? [`Profissionais: ${f.profissionais.join(", ")}.`] : []),
    `Horário de funcionamento: ${formatBusinessHoursCompact(f.horarios) || "não cadastrado"}.`,
    ...(f.diasFechados.length
      ? [`Fechado também nos dias: ${f.diasFechados.map((d) => `${d.slice(8, 10)}/${d.slice(5, 7)}`).join(", ")}.`]
      : []),
    `Endereço: ${f.endereco || "não cadastrado"}.`,
    `Formas de pagamento: ${f.pagamento || "não cadastradas"}.`,
  ];

  if (f.perguntas.length) {
    linhas.push("Perguntas frequentes:");
    for (const p of f.perguntas) linhas.push(`P: ${p.question}`, `R: ${p.answer}`);
  }
  if (f.linkAgenda) linhas.push(`Link para marcar pela internet: ${f.linkAgenda}`);

  return linhas.join("\n");
}
