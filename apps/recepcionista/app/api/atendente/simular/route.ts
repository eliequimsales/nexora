import { NextResponse } from "next/server";
import { horariosLivres } from "@/lib/agenda/livres";
import { marcarNaAgenda } from "@/lib/agenda/marcacao";
import { configuracaoDaIaFaltando, generateReceptionistReply } from "@/lib/ai/provider";
import { quandoFalado } from "@/lib/atendente/datas";
import { pedidoDeSimulacao } from "@/lib/atendente/entrada";
import { fatosDaEmpresa, lerPalavrasDoDono, type Sobrescrita } from "@/lib/atendente/fatos";
import { responder } from "@/lib/atendente/motor";
import { lerEstado } from "@/lib/atendente/oferta";
import { lojaFechada } from "@/lib/atendente/portao";
import { getSessionCompanyId } from "@/lib/auth";
import { prisma } from "@/lib/db";
import { logError } from "@/lib/errors";
import { LIMITES, limitar } from "@/lib/limites";
import { TOO_MANY_ATTEMPTS } from "@/lib/rate-limit";

export const dynamic = "force-dynamic";
export const maxDuration = 30;

/**
 * O SIMULADOR: O MESMO MOTOR DO WHATSAPP, COM OS DADOS DO DONO.
 *
 * A agenda é a de verdade (horários livres de verdade), a IA é a de verdade, e
 * o nome, o jeito e a escolha de marcar podem ser testados antes de salvar.
 * Duas coisas não acontecem aqui, por desenho: nada é enviado para ninguém, e
 * nada é marcado — "marcar" só confere se o horário continua livre.
 *
 * O primeiro teste é o que libera o botão "Ligar no meu WhatsApp".
 */

const aviso = globalThis as unknown as { __respostasLivresAvisadas?: boolean };

export async function POST(request: Request) {
  const companyId = await getSessionCompanyId();
  if (!companyId) return NextResponse.json({ error: "Não autenticado" }, { status: 401 });

  // Cada teste pode chamar a IA, e cada chamada custa: o mesmo teto dela.
  if (!limitar("atendente-simular", companyId, LIMITES.ia)) {
    return NextResponse.json({ error: TOO_MANY_ATTEMPTS }, { status: 429 });
  }

  const parsed = pedidoDeSimulacao.safeParse(await request.json().catch(() => null));
  if (!parsed.success) {
    return NextResponse.json({ error: parsed.error.issues[0]?.message ?? "Teste inválido" }, { status: 400 });
  }
  const p = parsed.data;

  try {
    const agora = new Date();
    const sobrescrita: Sobrescrita = {
      ...(p.nome !== undefined ? { nome: p.nome } : {}),
      ...(p.jeito ? { jeito: p.jeito } : {}),
      ...(p.marcaDireto !== undefined ? { marcaDireto: p.marcaDireto } : {}),
    };
    const [fatos, perfil] = await Promise.all([
      fatosDaEmpresa(companyId, sobrescrita),
      prisma.companyProfile.findUnique({ where: { companyId }, select: { handoffKeywords: true } }),
    ]);

    // Sem a configuração, as respostas livres ficam de fora e o resto funciona.
    // O nome da variável vai para o log do servidor, uma vez; a tela recebe só o
    // aviso, sem palavra técnica.
    const faltando = configuracaoDaIaFaltando();
    if (faltando && !aviso.__respostasLivresAvisadas) {
      aviso.__respostasLivresAvisadas = true;
      console.warn(`[atendente] respostas livres desligadas: falta ${faltando} no ambiente`);
    }

    const pendentes: string[] = [];
    for (let i = p.mensagens.length - 1; i >= 0 && p.mensagens[i].de === "cliente"; i--) {
      pendentes.unshift(p.mensagens[i].texto);
    }
    const contexto = lojaFechada({ horarios: fatos.horarios, diasFechados: fatos.diasFechados, agora }) ? "FECHADO" : "EXPEDIENTE";

    const saida = await responder(
      {
        texto: pendentes.join("\n"),
        historico: p.mensagens.map((m) => ({ role: m.de === "cliente" ? "CUSTOMER" : "AI", content: m.texto })),
        estado: lerEstado(p.estado, agora),
        primeiraDoDia: !p.mensagens.some((m) => m.de === "atendente"),
        clienteNome: null,
        telefone: "simulacao",
        fatos,
        agora,
        contexto,
        palavrasDoDono: lerPalavrasDoDono(perfil?.handoffKeywords),
      },
      {
        livres: (q) =>
          horariosLivres({ companyId, duracaoMin: q.servico.duracaoMin, dias: q.dias, agora, profissional: q.profissional }),
        marcar: (q) =>
          marcarNaAgenda({
            companyId,
            servico: q.servico,
            inicio: q.inicio,
            profissional: q.profissional,
            cliente: q.cliente,
            origem: "ATENDENTE",
            simulacao: true,
            agora,
          }),
        ia: async ({ systemPrompt, historico }) => {
          if (faltando) throw new Error("Respostas livres sem configuração");
          return generateReceptionistReply({ systemPrompt, history: historico });
        },
      },
    );

    await prisma.companyProfile.update({ where: { companyId }, data: { atendenteTestadoEm: agora } });

    return NextResponse.json({
      mensagens: saida.mensagens,
      estado: saida.estado,
      fontes: saida.fontes,
      marcou: saida.marcou
        ? { quando: quandoFalado(saida.marcou.inicio), servico: saida.marcou.servico, profissional: saida.marcou.profissional }
        : null,
      anotou: saida.anotar?.motivo ?? null,
      contexto,
      respostasLivres: !faltando,
    });
  } catch (erro) {
    await logError("atendente-simular", erro, companyId);
    return NextResponse.json({ error: "O teste não rodou agora. Tente de novo em instantes." }, { status: 500 });
  }
}
