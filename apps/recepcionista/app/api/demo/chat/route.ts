import { NextResponse } from "next/server";
import { z } from "zod";
import { generateReceptionistReply } from "@/lib/ai/provider";
import { clientIp, rateLimit, TOO_MANY_ATTEMPTS } from "@/lib/rate-limit";

export const dynamic = "force-dynamic";
export const maxDuration = 15;

const schema = z.object({
  mensagem: z.string().trim().min(1, "Mensagem vazia").max(500, "Mensagem muito longa"),
  nicho: z.enum(["barbearia", "clinica", "salao", "geral"]).optional(),
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

Diretrizes gerais:
- Responda em no máximo 2 ou 3 frases curtas, em português do Brasil coloquial e profissional, tom natural de WhatsApp. No máximo 1 ou 2 emojis.
- Mostre agilidade, simpatia e capacidade real de resolver.
- Se o usuário perguntar sobre a Nexora, preços ou funcionamento:
  * Explique que a Nexora atende 24h no WhatsApp da empresa dele, tira dúvidas e fecha agendamentos mesmo de madrugada ou domingo.
  * Preços: Plano Atendente R$ 97/mês, e Plano Completo R$ 197/mês (Atendente + Recuperador de Clientes Sumidos).
  * O primeiro teste de 7 dias é grátis e sem cartão de crédito!
- Se o usuário simular uma pergunta de cliente da empresa dele:
  * Se for Barbearia: fale de Corte Degradê (R$ 45), Barba (R$ 35), horários livres (amanhã às 14h ou às 16h30 com o Léo).
  * Se for Clínica/Estética: fale de Limpeza de Pele Profunda (R$ 140), Massagem (R$ 90), horários livres com Dra. Camila.
  * Se for Salão: fale de Escova Modelada (R$ 60), Manicure (R$ 55), Mechas.
  * Se o cliente confirmar um horário (ex: "quero às 14h", "confirmo", "pode ser", "1"):
    Gere uma confirmação clara:
    "✅ Agendamento Confirmado!
    📅 Amanhã, às 14:00
    🔔 Lembrete anti-falta programado 2h antes!"
- Nunca invente jargões técnicos e nunca seja prolixo. Seja rápido, direto e humano.`;

function respostaFallback(mensagem: string, nicho: string = "geral"): string {
  const m = mensagem.toLowerCase();

  // 1. Perguntas sobre preços e planos da Nexora
  if (m.includes("preco") || m.includes("preço") || m.includes("quanto custa") || m.includes("valor")) {
    if (m.includes("corte") || m.includes("barba") || nicho === "barbearia") {
      return "Nosso Corte Degradê sai por R$ 45,00 e a Barba na toalha quente por R$ 35,00 (ou o combo completo por R$ 70,00). Deseja agendar um horário para amanhã?";
    }
    if (m.includes("limpeza") || m.includes("botox") || m.includes("massagem") || nicho === "clinica") {
      return "Nossa Limpeza de Pele Profunda é R$ 140,00 e a Drenagem Linfática R$ 90,00. Avaliações estéticas são gratuitas! Gostaria de agendar seu horário?";
    }
    if (m.includes("escova") || m.includes("mechas") || nicho === "salao") {
      return "Nossa Escova Modelada é R$ 60,00 e Manicure & Pedicure R$ 55,00. Mechas sob avaliação personalizada! Quer marcar para esta semana?";
    }
    return "Nosso plano Atendente é R$ 97/mês e o Completo é R$ 197/mês. Você pode começar a primeira semana 100% grátis, sem precisar colocar cartão!";
  }

  // 2. Confirmação de agendamento quando o cliente escolhe horário
  if (
    m.includes("14h") ||
    m.includes("14:00") ||
    m.includes("16h") ||
    m.includes("16:30") ||
    m.includes("18h") ||
    m.includes("10h") ||
    m.includes("confirmo") ||
    m.includes("pode ser") ||
    m.includes("quero") ||
    m.includes("marcar esse") ||
    m === "1" ||
    m === "2" ||
    m === "3"
  ) {
    if (nicho === "barbearia") {
      return "✅ Agendamento Confirmado!\n📅 Amanhã às 14:00 com Léo\n✂️ Serviço: Corte Degradê (R$ 45,00)\n🔔 Lembrete anti-falta programado 2h antes no seu WhatsApp!";
    }
    if (nicho === "clinica") {
      return "✅ Consulta Confirmada!\n📅 Amanhã às 15:00 com Dra. Camila\n💆‍♀️ Procedimento: Avaliação Estética & Limpeza\n🔔 Lembrete automático enviado 2h antes!";
    }
    return "✅ Agendamento Confirmado!\n📅 Amanhã às 14:00\n🔔 Lembrete automático anti-falta ativado no WhatsApp. Te esperamos!";
  }

  // 3. Perguntas sobre atendimento noturno / 24h
  if (m.includes("madrugada") || m.includes("noite") || m.includes("domingo") || m.includes("fechado") || m.includes("24h")) {
    return "Exatamente! Quando você fecha a empresa ou vai descansar, o Atendente Virtual continua acordado respondendo no WhatsApp e salvando agendamentos para o dia seguinte.";
  }

  // 4. Perguntas sobre horários livres
  if (m.includes("horario") || m.includes("horário") || m.includes("amanha") || m.includes("amanhã") || m.includes("agendar") || m.includes("marcar") || m.includes("vaga")) {
    if (nicho === "barbearia") {
      return "Temos horários livres sim! Amanhã temos às 14:00 e às 16:30 com o Léo. Qual desses dois fica melhor para você?";
    }
    if (nicho === "clinica") {
      return "Temos horários livres amanhã às 10:30 e às 15:00 com a Dra. Camila. Qual horário você prefere?";
    }
    return "Temos horários livres sim! Amanhã às 14h e às 16h30. Qual desses fica melhor para você confirmar?";
  }

  // 5. Como funciona / O que é a Nexora
  if (m.includes("como funciona") || m.includes("o que é") || m.includes("oque e") || m.includes("nexora")) {
    return "Eu sou o Atendente Virtual da Nexora: aprendo seus serviços, preços e horários, e respondo no seu próprio WhatsApp comercial 24h por dia para você nunca mais perder clientes!";
  }

  // 6. Lembrete anti-falta
  if (m.includes("anti-falta") || m.includes("antifalta") || m.includes("lembrete") || m.includes("falta")) {
    return "O lembrete anti-falta envia uma mensagem carinhosa 2h antes do horário para o cliente confirmar a presença. Se ele desmarcar, o horário é liberado na hora para outro!";
  }

  // 7. Nichos específicos
  if (m.includes("barbearia") || m.includes("corte") || m.includes("barba") || nicho === "barbearia") {
    return "Para barbearia é perfeito! O cliente pede corte ou barba às 23h, eu mostro os horários livres com o barbeiro certo e já deixo marcado na sua agenda.";
  }

  if (m.includes("clinica") || m.includes("clínica") || m.includes("estetica") || m.includes("estética") || nicho === "clinica") {
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

    const { mensagem, nicho = "geral", historico } = parsed.data;

    // Se temos provedor de IA configurado, tentamos resposta dinâmica
    if (process.env.GROQ_API_KEY || process.env.ANTHROPIC_API_KEY || process.env.OPENAI_API_KEY) {
      try {
        const historicoFormatado = (historico ?? []).map((h) => ({
          role: h.de === "cliente" ? ("CUSTOMER" as const) : ("AI" as const),
          content: h.texto,
        }));
        historicoFormatado.push({ role: "CUSTOMER", content: mensagem });

        const promptComNicho = `${PROMPT_DEMO}\nContexto atual do nicho: ${nicho}.`;

        const reply = await generateReceptionistReply({
          systemPrompt: promptComNicho,
          history: historicoFormatado,
        });
        if (reply.resposta && reply.resposta.trim().length > 0) {
          return NextResponse.json({ resposta: reply.resposta.trim() });
        }
      } catch {
        // Se a chamada de IA falhar ou der timeout, cai no fallback suave
      }
    }

    // Fallback inteligente e humanizado
    const resposta = respostaFallback(mensagem, nicho);
    return NextResponse.json({ resposta });
  } catch {
    return NextResponse.json(
      { resposta: "Olá! Posso te ajudar a agendar um horário ou tirar dúvidas sobre nossos serviços. Como posso ajudar?" },
      { status: 200 },
    );
  }
}
