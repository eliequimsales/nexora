import { NextResponse } from "next/server";
import { getSessionCompanyId } from "@/lib/auth";
import { prisma } from "@/lib/db";
import { logError } from "@/lib/errors";
import { LIMITES, limitar } from "@/lib/limites";
import { TOO_MANY_ATTEMPTS } from "@/lib/rate-limit";
import { jsonCompletion } from "@/lib/ai/provider";
import { criarServico } from "@/lib/agenda/painel";
import { emReais } from "@/lib/billing/preco";

export const dynamic = "force-dynamic";
export const maxDuration = 30;

/**
 * CONFIGURAR / ENSINAR CONVERSANDO ("COMO DESCER DE TOBOGÃ, ONDAS DO MAR")
 *
 * O empresário não precisa preencher formulários: ele apenas conversa com o atendente
 * no WhatsApp ou no simulador, e o atendente extrai e cadastra serviços, preços,
 * horários, endereço, formas de pagamento e regras automaticamente no banco de dados.
 */

const PROMPT_ONBOARDING = `Você é o assistente executivo e motor de configuração inteligente do Nexora Atendente.
O dono do negócio está falando com você de forma livre, rápida ou coloquial em português para te ensinar sobre a empresa dele.

Sua missão:
1. Extrair todas as informações de negócio presentes na mensagem:
   - "servicos": array de serviços ou produtos. Cada um com "nome" (string clara), "precoCents" (número inteiro em centavos, ex: 45 reais = 4500, R$ 740 = 74000; se não souber o preço exato, coloque 0) e "duracaoMin" (duração estimada em minutos, padrão 30).
   - "horarios": horários de atendimento se mencionados (ex: de segunda a sexta das 9h às 18h). Retorne array de dias (0 a 6, onde 0 é domingo e 1 é segunda) com "open" e "close" em formato "HH:MM".
   - "endereco": endereço físico ou localização, se mencionado (string).
   - "pagamento": formas de pagamento aceitas, se mencionadas (string).
   - "duvidas": dúvidas frequentes ou regras específicas explicadas pelo dono (array de objetos com "pergunta" canônica e "resposta" clara).
   - "descricao": resumo ou diferenciais da empresa, se mencionados.

2. Gerar "resposta":
   - Uma mensagem conversacional de WhatsApp, calorosa, ultra-profissional e objetiva (1 a 3 parágrafos curtos).
   - Confirme com entusiasmo o que você acabou de aprender e cadastrar (cite os serviços e valores com emojis).
   - Se faltar algo essencial (como horário ou formas de pagamento), sugira delicadamente o próximo passo, ou convide o empresário a testar perguntando como se fosse um cliente ("Pode fazer um teste comigo me perguntando o preço!").

Responda SOMENTE com um JSON válido:
{
  "servicos": [{"nome": "Corte", "precoCents": 4500, "duracaoMin": 30}],
  "horarios": [{"day": 1, "open": "09:00", "close": "18:00", "closed": false}],
  "endereco": "",
  "pagamento": "",
  "duvidas": [{"pergunta": "Qual o preço do plano?", "resposta": "Nosso plano sai por R$ 740,00."}],
  "descricao": "",
  "resposta": "Perfeito! Já registrei aqui: ✂️ Corte por R$ 45,00. Pode testar me perguntando o preço ou me diz: quais são seus horários?"
}`;

export async function POST(request: Request) {
  const companyId = await getSessionCompanyId();
  if (!companyId) return NextResponse.json({ error: "Não autenticado" }, { status: 401 });

  if (!limitar("atendente-ensinar-conversando", companyId, LIMITES.ia)) {
    return NextResponse.json({ error: TOO_MANY_ATTEMPTS }, { status: 429 });
  }

  try {
    const body = await request.json().catch(() => null);
    const texto = String(body?.texto || "").trim();
    if (!texto || texto.length < 2) {
      return NextResponse.json({ error: "Mensagem vazia" }, { status: 400 });
    }

    let extraido: {
      servicos?: Array<{ nome: string; precoCents: number; duracaoMin?: number }>;
      horarios?: Array<{ day: number; open: string; close: string; closed: boolean }>;
      endereco?: string;
      pagamento?: string;
      duvidas?: Array<{ pergunta: string; resposta: string }>;
      descricao?: string;
      resposta?: string;
    } = {};

    try {
      const completion = await jsonCompletion(
        PROMPT_ONBOARDING,
        `Mensagem do dono da empresa:\n"${texto}"`,
        700,
      );
      extraido = JSON.parse(completion);
    } catch (parseErr) {
      console.warn("[ensinar-conversando] Fallback heurístico ativado:", parseErr);
      // Fallback heurístico simples caso o provedor de IA demore ou oscile
      const precoMatch = texto.match(/(?:r\$\s*|\b)(\d{1,4})(?:[,\.](\d{2}))?\s*(?:reais)?/i);
      const valorCents = precoMatch ? Math.round(parseFloat(precoMatch[1] + (precoMatch[2] ? `.${precoMatch[2]}` : "")) * 100) : 0;
      extraido = {
        duvidas: [{ pergunta: texto.slice(0, 100), resposta: texto }],
        ...(valorCents > 0 ? { servicos: [{ nome: "Serviço", precoCents: valorCents, duracaoMin: 30 }] } : {}),
        resposta: `Entendido! Já guardei essa informação com segurança no seu atendente. Pode fazer um teste agora me perguntando! 💛`,
      };
    }

    const cadastrados = {
      servicos: [] as string[],
      horarios: false,
      endereco: false,
      pagamento: false,
      duvidas: [] as string[],
    };

    // 1. Cadastra ou atualiza serviços
    if (Array.isArray(extraido.servicos) && extraido.servicos.length > 0) {
      const servicosAtuais = await prisma.service.findMany({
        where: { companyId, active: true },
        select: { id: true, name: true, priceCents: true },
      });

      for (const s of extraido.servicos) {
        if (!s.nome || typeof s.nome !== "string") continue;
        const nomeLimpo = s.nome.trim();
        const preco = typeof s.precoCents === "number" && s.precoCents >= 0 ? s.precoCents : 0;
        const duracao = typeof s.duracaoMin === "number" && s.duracaoMin > 0 ? s.duracaoMin : 30;

        const existente = servicosAtuais.find(
          (atual) => atual.name.toLowerCase() === nomeLimpo.toLowerCase(),
        );

        if (existente) {
          await prisma.service.update({
            where: { id: existente.id },
            data: { priceCents: preco, durationMin: duracao },
          });
        } else {
          await criarServico(companyId, { name: nomeLimpo, priceCents: preco, durationMin: duracao });
        }
        cadastrados.servicos.push(`${nomeLimpo} (${emReais(preco)})`);
      }

      // Se havia apenas um serviço fictício padrão sem preço ("Atendimento"), desativa-o
      const servicoPadraoVazio = servicosAtuais.find(
        (s) => (s.name === "Atendimento" || s.name === "Serviço") && s.priceCents === 0,
      );
      if (servicoPadraoVazio && cadastrados.servicos.length > 0) {
        await prisma.service.update({
          where: { id: servicoPadraoVazio.id },
          data: { active: false },
        });
      }
    }

    // 2. Atualiza endereço
    if (extraido.endereco && typeof extraido.endereco === "string" && extraido.endereco.trim().length >= 4) {
      await prisma.companyProfile.update({
        where: { companyId },
        data: { address: extraido.endereco.trim().slice(0, 250) },
      });
      cadastrados.endereco = true;
    }

    // 3. Atualiza formas de pagamento
    if (extraido.pagamento && typeof extraido.pagamento === "string" && extraido.pagamento.trim().length >= 2) {
      await prisma.companyProfile.update({
        where: { companyId },
        data: { paymentMethods: extraido.pagamento.trim().slice(0, 200) },
      });
      cadastrados.pagamento = true;
    }

    // 4. Atualiza horários
    if (Array.isArray(extraido.horarios) && extraido.horarios.length > 0) {
      await prisma.companyProfile.update({
        where: { companyId },
        data: { businessHours: extraido.horarios },
      });
      cadastrados.horarios = true;
    }

    // 5. Cadastra dúvidas / FAQs como conhecimento aprovado imediato
    if (Array.isArray(extraido.duvidas) && extraido.duvidas.length > 0) {
      for (const d of extraido.duvidas) {
        if (!d.pergunta || !d.resposta) continue;
        await prisma.knowledgeItem.create({
          data: {
            companyId,
            question: d.pergunta.trim().slice(0, 300),
            answer: d.resposta.trim().slice(0, 1500),
            source: "TRAINING",
            status: "APPROVED",
            approvedAt: new Date(),
          },
        });
        cadastrados.duvidas.push(d.pergunta.trim());
      }
    }

    // 6. Atualiza descrição / regras se informadas
    if (extraido.descricao && typeof extraido.descricao === "string" && extraido.descricao.trim().length >= 4) {
      const perfilAtual = await prisma.companyProfile.findUnique({
        where: { companyId },
        select: { description: true },
      });
      const novaDescricao = perfilAtual?.description
        ? `${perfilAtual.description}\n${extraido.descricao.trim()}`.slice(0, 1500)
        : extraido.descricao.trim().slice(0, 1500);

      await prisma.companyProfile.update({
        where: { companyId },
        data: { description: novaDescricao },
      });
    }

    const respostaFinal =
      extraido.resposta?.trim() ||
      "Perfeito! Já aprendi e configurei tudo no seu atendente. Pode fazer um teste comigo!";

    return NextResponse.json({
      ok: true,
      resposta: respostaFinal,
      cadastrados,
    });
  } catch (error) {
    await logError("atendente-ensinar-conversando", error, companyId);
    return NextResponse.json({ error: "Erro ao processar as informações" }, { status: 500 });
  }
}
