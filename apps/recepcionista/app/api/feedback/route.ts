import { NextResponse } from "next/server";
import { getSessionCompanyId } from "@/lib/auth";
import { prisma } from "@/lib/db";
import { enviarFeedback } from "@/lib/feedback/servico";
import type { CategoriaFeedback } from "@/lib/feedback/tipos";
import { clientIp, rateLimit, TOO_MANY_ATTEMPTS } from "@/lib/rate-limit";

export const dynamic = "force-dynamic";

const CATEGORIAS_VALIDAS: CategoriaFeedback[] = [
  "sugestao",
  "problema",
  "duvida",
  "elogio",
  "outro",
];

export async function POST(req: Request) {
  try {
    const ip = clientIp(req);
    const permitido = rateLimit(`feedback:${ip}`, { limit: 10, windowMs: 60_000 });
    if (!permitido) {
      return NextResponse.json(
        { erro: TOO_MANY_ATTEMPTS },
        { status: 429 },
      );
    }

    const corpo = await req.json().catch(() => ({}));
    const mensagem = typeof corpo.mensagem === "string" ? corpo.mensagem.trim() : "";
    if (mensagem.length < 3) {
      return NextResponse.json(
        { erro: "Por favor, escreva uma mensagem com pelo menos 3 caracteres." },
        { status: 400 },
      );
    }
    if (mensagem.length > 4000) {
      return NextResponse.json(
        { erro: "A mensagem é muito longa (máximo de 4.000 caracteres)." },
        { status: 400 },
      );
    }

    const ratingNum = Number(corpo.rating);
    const rating = Number.isInteger(ratingNum) && ratingNum >= 1 && ratingNum <= 5 ? ratingNum : 5;

    const categoria: CategoriaFeedback = CATEGORIAS_VALIDAS.includes(corpo.categoria)
      ? corpo.categoria
      : "sugestao";

    // Informações da sessão autenticada, caso o usuário esteja logado
    const companyId = await getSessionCompanyId();
    let companyName: string | undefined;
    let emailSessao: string | undefined;
    let phoneSessao: string | undefined;

    if (companyId) {
      const company = await prisma.company.findUnique({
        where: { id: companyId },
        select: { name: true, email: true, phone: true },
      });
      if (company) {
        companyName = company.name;
        emailSessao = company.email;
        phoneSessao = company.phone;
      }
    }

    const email = typeof corpo.email === "string" && corpo.email.includes("@")
      ? corpo.email.trim()
      : (emailSessao || "cliente-sem-email@nexora.app");

    const whatsapp = typeof corpo.whatsapp === "string" && corpo.whatsapp.trim().length > 0
      ? corpo.whatsapp.trim()
      : phoneSessao;

    const pagina = typeof corpo.pagina === "string" ? corpo.pagina.slice(0, 200) : undefined;
    const nomeCliente = typeof corpo.nomeCliente === "string" ? corpo.nomeCliente.slice(0, 100) : undefined;

    const resultado = await enviarFeedback({
      rating,
      categoria,
      mensagem,
      email,
      whatsapp,
      nomeCliente,
      companyId: companyId ?? undefined,
      companyName,
      pagina,
    });

    return NextResponse.json({
      ok: true,
      mensagem: "Feedback recebido com sucesso!",
      enviado: resultado.enviado,
    });
  } catch (erro) {
    console.error("[api/feedback] Erro ao processar feedback:", erro);
    return NextResponse.json(
      { erro: "Não foi possível enviar o feedback no momento. Tente novamente mais tarde." },
      { status: 500 },
    );
  }
}
