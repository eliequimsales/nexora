import { NextResponse } from "next/server";
import { z } from "zod";
import { generateReceptionistReply } from "@/lib/ai/provider";
import { clientIp, rateLimit, TOO_MANY_ATTEMPTS } from "@/lib/rate-limit";

export const dynamic = "force-dynamic";
export const maxDuration = 15;

const schema = z.object({
  mensagem: z.string().trim().min(1, "Mensagem vazia").max(500, "Mensagem muito longa"),
  historico: z
    .array(
      z.object({
        de: z.enum(["cliente", "atendente"]),
        texto: z.string().max(1000),
      }),
    )
    .optional(),
});

const PROMPT_DEMO = `Você é o Atendente Virtual Inteligente de demonstração da Nexora no WhatsApp.
Seu objetivo é encantar o pequeno empresário brasileiro que está testando a ferramenta na landing page.

Diretrizes:
- Responda em no máximo 2 ou 3 frases curtas, em português do Brasil coloquial e profissional, tom natural de WhatsApp. No máximo 1 emoji por mensagem.
- Mostre agilidade, clareza e que você resolve na hora sem enrolação.
- Se o usuário perguntar sobre a Nexora, preços ou funcionamento:
  * Explique que a Nexora atende 24h no WhatsApp da empresa dele, tira dúvidas e fecha agendamentos mesmo de madrugada ou domingo.
  * Preços: Plano Atendente R$ 97/mês, e Plano Completo R$ 197/mês (Atendente + Recuperador de Clientes Sumidos).
  * O primeiro teste de 7 dias é grátis e sem cartão de crédito!
- Se o usuário simular uma pergunta de cliente da empresa dele (ex: "Tem horário amanhã?", "Quanto custa o corte/massagem?", "Vocês abrem sábado?"):
  * Responda como o atendente do negócio dele responderia: confirme os horários (ex: "Temos sim! Às 14h e às 16h30, qual fica melhor para você?"), valores e feche o agendamento no tom certo.
- Nunca invente dados técnicos complexos e nunca seja prolixo. Seja rápido, direto e simpático.`;

function respostaFallback(mensagem: string): string {
  const m = mensagem.toLowerCase();

  if (m.includes("preco") || m.includes("preço") || m.includes("quanto custa") || m.includes("valor")) {
    return "Nosso plano Atendente é R$ 97/mês e o Completo é R$ 197/mês. Você pode começar a primeira semana 100% grátis, sem precisar colocar cartão!";
  }

  if (m.includes("madrugada") || m.includes("noite") || m.includes("domingo") || m.includes("fechado")) {
    return "Exatamente! Quando você fecha a loja ou vai dormir, eu continuo acordada respondendo seus clientes no WhatsApp e salvando agendamentos para o dia seguinte.";
  }

  if (m.includes("horario") || m.includes("horário") || m.includes("amanha") || m.includes("amanhã") || m.includes("agendar") || m.includes("marcar")) {
    return "Temos horários livres sim! Amanhã às 14h e às 16h30. Qual desses fica melhor para você confirmar?";
  }

  if (m.includes("como funciona") || m.includes("o que é") || m.includes("oque e") || m.includes("nexora")) {
    return "Eu sou o Atendente Virtual da Nexora: aprendo seus serviços, preços e horários, e respondo no seu próprio WhatsApp comercial 24h por dia para você nunca mais perder clientes!";
  }

  if (m.includes("barbearia") || m.includes("corte") || m.includes("barba")) {
    return "Para barbearia é perfeito! O cliente pede corte ou barba às 23h, eu mostro os horários livres com o barbeiro certo e já deixo marcado na sua agenda.";
  }

  if (m.includes("clinica") || m.includes("clínica") || m.includes("estetica") || m.includes("estética") || m.includes("salao") || m.includes("salão")) {
    return "Para clínicas e salões é ideal! Eu tiro dúvidas sobre procedimentos, valores e horários disponíveis, sem deixar a cliente esperando resposta.";
  }

  return "Olá! Sou o Atendente Virtual da Nexora. Posso tirar suas dúvidas sobre serviços, checar horários livres na agenda ou te mostrar como funciono 24h no seu WhatsApp!";
}

export async function POST(request: Request) {
  const ip = clientIp(request);
  if (!rateLimit(`demo-chat:${ip}`, { limit: 30, windowMs: 10 * 60_000 })) {
    return NextResponse.json({ error: TOO_MANY_ATTEMPTS }, { status: 429 });
  }

  try {
    const body = await request.json().catch(() => null);
    const parsed = schema.safeParse(body);
    if (!parsed.success) {
      return NextResponse.json(
        { error: parsed.error.issues[0]?.message ?? "Mensagem inválida" },
        { status: 400 },
      );
    }

    const { mensagem, historico } = parsed.data;

    // Se temos provedor de IA configurado, tentamos resposta dinâmica
    if (process.env.GROQ_API_KEY || process.env.ANTHROPIC_API_KEY || process.env.OPENAI_API_KEY) {
      try {
        const historicoFormatado = (historico ?? []).map((h) => ({
          role: h.de === "cliente" ? ("CUSTOMER" as const) : ("AI" as const),
          content: h.texto,
        }));
        historicoFormatado.push({ role: "CUSTOMER", content: mensagem });

        const reply = await generateReceptionistReply({
          systemPrompt: PROMPT_DEMO,
          history: historicoFormatado,
        });
        if (reply.resposta && reply.resposta.trim().length > 0) {
          return NextResponse.json({ resposta: reply.resposta.trim() });
        }
      } catch {
        // Se a chamada de IA falhar ou der timeout, cai no fallback suave
      }
    }

    // Fallback inteligente garantido
    const resposta = respostaFallback(mensagem);
    return NextResponse.json({ resposta });
  } catch {
    return NextResponse.json(
      { resposta: "Olá! Como posso ajudar você a testar o Atendente Virtual da Nexora hoje?" },
      { status: 200 },
    );
  }
}
