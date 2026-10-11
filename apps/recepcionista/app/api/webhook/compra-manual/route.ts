import { type NextRequest, NextResponse } from "next/server";
import { logError } from "@/lib/errors";
import { enviarWhatsApp } from "@/lib/whatsapp/envio";
import { extrairComprador } from "@/lib/billing/compra-manual";

export async function POST(req: NextRequest) {
  try {
    const body = await req.json().catch(() => ({}));
    const comprador = extrairComprador(body);

    if (!comprador.statusPago) {
      return NextResponse.json({ ok: true, motivo: "Pagamento não aprovado ainda" });
    }

    if (!comprador.telefone) {
      return NextResponse.json({ ok: false, motivo: "Telefone não informado no checkout" }, { status: 400 });
    }

    // Mensagem de boas-vindas com o choque de velocidade dos 3 segundos
    const primeiroNome = comprador.nome.split(" ")[0] || "amigo(a)";
    const mensagemSofia =
      `Oi ${primeiroNome}! Seja muito bem-vindo(a) 😊\n` +
      `Vi que seu acesso ao guia "Como Nunca Mais Perder um Cliente pro Concorrente" acabou de ser aprovado!\n\n` +
      `Viu a velocidade dessa resposta? ⚡ Se fossem 23h ou um domingo, seu cliente receberia essa mesma atenção na sua empresa em vez de fechar com o concorrente.\n\n` +
      `Qual é o ramo do seu negócio?`;

    // Dispara a mensagem se houver instância comercial ativa
    const instanciaAtiva =
      process.env.NEXORA_COMMERCIAL_INSTANCE ||
      process.env.EVOLUTION_INSTANCE_NAME ||
      "nexora-mestre";

    let envioStatus = "pendente";
    try {
      await enviarWhatsApp(instanciaAtiva, comprador.telefone, mensagemSofia);
      envioStatus = "enviado";
    } catch (erro) {
      // Se a instância estiver offline ou em teste, não quebra a resposta HTTP do webhook
      envioStatus = "falha_envio";
      await logError("webhook-compra-manual", erro);
    }

    return NextResponse.json({
      ok: true,
      mensagem: "Compra processada com sucesso",
      envio: envioStatus,
      comprador: {
        nome: comprador.nome,
        telefone: comprador.telefone,
        email: comprador.email,
        orderBump: comprador.orderBump,
      },
    });
  } catch (erro) {
    await logError("webhook-compra-manual-geral", erro);
    return NextResponse.json({ ok: false, erro: "Falha ao processar webhook" }, { status: 500 });
  }
}
