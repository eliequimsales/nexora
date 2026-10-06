import { prisma } from "@/lib/db";
import { criarServico, listarServicos } from "@/lib/agenda/painel";
import { jsonCompletion } from "@/lib/ai/provider";
import { fatosDaEmpresa } from "@/lib/atendente/fatos";
import type { BusinessHour } from "@/lib/validation";

/**
 * ENTREVISTA DA ONDA DO MAR — CONFIGURAÇÃO CONVERSACIONAL DO ATENDENTE.
 *
 * Em vez de preencher formulários maçantes, o dono da empresa conversa
 * diretamente com a atendente virtual no simulador do WhatsApp.
 *
 * A atendente entrevista o dono em 3 ondas fluidas:
 * 1. Serviços e Preços ("Quais serviços você mais vende e quanto custa?")
 * 2. Endereço e Horários ("Onde fica o espaço físico e quais dias/horários?")
 * 3. Pagamentos e Regras ("Aceita Pix/cartão? Tem tolerância de atraso?")
 *
 * Conforme o dono responde, os dados são extraídos, validados e persistidos
 * imediatamente no banco (Service, CompanyProfile, KnowledgeItem), refletindo
 * em tempo real nos cartões do painel com tiques verdes.
 */

export interface ServicoExtraido {
  name: string;
  priceCents: number;
  durationMin?: number;
}

export interface HorarioExtraido {
  diasSemana: number[]; // 0=domingo, 1=segunda, ..., 6=sábado
  abre: string; // "HH:MM"
  fecha: string; // "HH:MM"
}

export interface DadosExtraidos {
  servicos?: ServicoExtraido[];
  endereco?: string;
  horarios?: HorarioExtraido;
  pagamento?: string;
  regras?: string;
  perguntaResposta?: {
    pergunta: string;
    resposta: string;
  };
  respostaParaDono?: string;
  proximaEtapa?: "SERVICOS" | "ENDERECO_HORARIOS" | "PAGAMENTO_REGRAS" | "CONCLUIDO";
}

/**
 * Parser heurístico determinístico (fallback quando IA não estiver configurada ou falhar).
 */
export function extrairHeuristica(texto: string): DadosExtraidos {
  const limpo = texto.trim();
  const dados: DadosExtraidos = {};

  // 1. Pergunta & Resposta ("quando perguntarem X, responda Y" ou "se perguntarem X, diga Y")
  const regexQA = /(?:quando|se)\s+(?:perguntarem|perguntar|falarem|disserem)\s+(?:sobre\s+)?(.+?)[,:\-]\s*(?:responda|diga|fale|informe)\s+(.+)/i;
  const matchQA = limpo.match(regexQA);
  if (matchQA) {
    dados.perguntaResposta = {
      pergunta: matchQA[1].trim(),
      resposta: matchQA[2].trim(),
    };
  }

  // 2. Serviços e Preços
  // Exemplos: "Corte R$ 45 e Barba R$ 35", "corte por 45 reais", "corte: 50, sobrancelha: 20", "faço corte de cabelo por 45"
  const servicos: ServicoExtraido[] = [];

  // Padrão estruturado "Nome por/é/de/R$ X"
  const regexServicos = /([a-zA-ZÀ-ÿ\s]{3,30}?)(?:\s*(?:por|é|de|custa|sai a)?\s*(?:r\$|reais)?\s*(\d{1,4}(?:[.,]\d{2})?)\s*(?:reais)?)(?:,|\.|\be\b|$)/gi;
  let matchS: RegExpExecArray | null;
  while ((matchS = regexServicos.exec(limpo)) !== null) {
    const nomeRaw = matchS[1].trim().replace(/^(faço|temos|faço|ofereço|oferecemos|trabalho com|meus serviços são)\s+/i, "");
    const valorRaw = matchS[2].replace(",", ".");
    const valor = parseFloat(valorRaw);
    if (nomeRaw.length >= 3 && !isNaN(valor) && valor > 0 && valor < 50000) {
      // Ignora falsos positivos de horário ou dias
      if (!/^(segunda|terça|quarta|quinta|sexta|sábado|domingo|seg|sex|sab|dom|às|as|das|de|hora|horario|tolerancia|minuto)/i.test(nomeRaw)) {
        servicos.push({
          name: nomeRaw.charAt(0).toUpperCase() + nomeRaw.slice(1).toLowerCase(),
          priceCents: Math.round(valor * 100),
          durationMin: 30,
        });
      }
    }
  }

  if (servicos.length > 0) {
    dados.servicos = servicos;
  }

  // 3. Horários de funcionamento
  // Exemplos: "seg a sex das 9h às 18h", "segunda a sabado das 08:00 as 19:00", "todos os dias das 8 às 20"
  const regexHoras = /(?:das|de)?\s*(\d{1,2})(?:h|:00|:(\d{2}))?\s*(?:às|as|ate|até)\s*(\d{1,2})(?:h|:00|:(\d{2}))?/i;
  const matchHoras = limpo.match(regexHoras);

  if (matchHoras) {
    const horaAbre = String(matchHoras[1]).padStart(2, "0");
    const minAbre = matchHoras[2] ? String(matchHoras[2]).padStart(2, "0") : "00";
    const horaFecha = String(matchHoras[3]).padStart(2, "0");
    const minFecha = matchHoras[4] ? String(matchHoras[4]).padStart(2, "0") : "00";

    const abre = `${horaAbre}:${minAbre}`;
    const fecha = `${horaFecha}:${minFecha}`;

    let diasSemana = [1, 2, 3, 4, 5]; // padrão seg a sex
    if (/seg(?:unda)?\s*a\s*s[aá]b(?:ado)?/i.test(limpo)) {
      diasSemana = [1, 2, 3, 4, 5, 6];
    } else if (/todos os dias|domingo a domingo|diariamente/i.test(limpo)) {
      diasSemana = [0, 1, 2, 3, 4, 5, 6];
    } else if (/ter(?:ça)?\s*a\s*s[aá]b(?:ado)?/i.test(limpo)) {
      diasSemana = [2, 3, 4, 5, 6];
    }

    dados.horarios = { diasSemana, abre, fecha };
  }

  // 4. Endereço
  // Exemplos: "Av. Paulista, 1000", "Rua das Flores 123", "fica na rua...", "100% online"
  const regexEndereco = /(?:rua|r\.|av\.|avenida|travessa|alameda|rodovia|estrada|praça)\s+[^,.\n]+(?:,\s*\d+)?(?:[^\n.]*)/i;
  const matchEnd = limpo.match(regexEndereco);
  if (matchEnd) {
    dados.endereco = matchEnd[0].trim();
  } else if (/100%\s*online|atendimento\s*online|a\s*domic[ií]lio/i.test(limpo)) {
    dados.endereco = "Atendimento online / sem endereço fixo";
  }

  // 5. Formas de Pagamento
  const pagamentosDetectados: string[] = [];
  if (/pix/i.test(limpo)) pagamentosDetectados.push("Pix");
  if (/cart[aã]o|cr[eé]dito|d[eé]bito/i.test(limpo)) pagamentosDetectados.push("cartão");
  if (/dinheiro/i.test(limpo)) pagamentosDetectados.push("dinheiro");
  if (/boleto/i.test(limpo)) pagamentosDetectados.push("boleto");
  if (pagamentosDetectados.length > 0) {
    dados.pagamento = pagamentosDetectados.join(", ");
  }

  // 6. Regras da empresa, descontos, políticas e dúvidas diretas
  const ehRegraOuDuvida =
    /desconto|promo[çc][aã]o|toler[aâ]ncia|atraso|cancel|remarc|reagend|estacion|vaga|wifi|caf[eé]|pet|crian[çc]|feriad|domingo|conv[eê]nio|particular|cortesia|brinde|gr[aá]tis|gratuito|meia|hor[aá]rio/i.test(
      limpo,
    );

  if (ehRegraOuDuvida) {
    dados.regras = limpo;
    if (!dados.perguntaResposta) {
      dados.perguntaResposta = {
        pergunta: limpo,
        resposta: `Sim, ${limpo}.`,
      };
    }
  }

  // 7. Se não encaixou em serviço com preço, endereço nem horário, mas o dono digitou uma frase (>= 4 caracteres)
  if (!dados.servicos && !dados.endereco && !dados.horarios && !dados.pagamento && !dados.perguntaResposta && limpo.length >= 4) {
    dados.regras = limpo;
    dados.perguntaResposta = {
      pergunta: limpo,
      resposta: limpo,
    };
  }

  return dados;
}

const SYSTEM_PROMPT_EXTRAIR = `Você é o assistente de onboarding inteligente da Nexora.
Sua missão é extrair dados de configuração da empresa que o dono digitar em linguagem natural e responder de forma calorosa, humana e objetiva.

Retorne SEMPRE um JSON válido com esta estrutura exata:
{
  "servicos": [{"name": string, "priceCents": number, "durationMin": number}], // se houver serviços mencionados
  "endereco": string | null, // se endereço ou menção a atendimento online for dito
  "horarios": { "diasSemana": [0..6], "abre": "HH:MM", "fecha": "HH:MM" } | null, // 0=domingo, 1=segunda, ..., 6=sabado
  "pagamento": string | null, // ex: "Pix, cartão e dinheiro"
  "regras": string | null, // regras de cancelamento, atraso ou diferenciais
  "perguntaResposta": { "pergunta": string, "resposta": string } | null, // quando ensinar como responder a uma dúvida
  "respostaParaDono": string, // sua resposta carinhosa ao dono, confirmando o que cadastrou e perguntando o que falta
  "proximaEtapa": "SERVICOS" | "ENDERECO_HORARIOS" | "PAGAMENTO_REGRAS" | "CONCLUIDO"
}

Diretrizes:
- Extraia preços em centavos (ex: R$ 45 = 4500). Se a duração não for informada, use 30.
- Na resposta, NUNCA use termos técnicos de programação ou banco de dados. Fale como uma secretária executiva pronta para começar a trabalhar.
- Seja breve (2 a 4 frases).`;

/**
 * Executa a extração usando IA (jsonCompletion) com fallback imediato para heurística pura.
 */
export async function extrairDadosDaMensagem(
  mensagem: string,
  historico?: Array<{ de: "dono" | "atendente"; texto: string }>,
): Promise<DadosExtraidos> {
  const heuristica = extrairHeuristica(mensagem);

  try {
    const contexto = (historico ?? [])
      .slice(-4)
      .map((h) => `${h.de === "dono" ? "Dono" : "Atendente"}: ${h.texto}`)
      .join("\n");

    const promptUsuario = `Histórico recente:\n${contexto || "Início da conversa"}\n\nNova mensagem do dono:\n"${mensagem}"`;
    const rawJson = await jsonCompletion(SYSTEM_PROMPT_EXTRAIR, promptUsuario, 512);
    const parsed = JSON.parse(rawJson) as DadosExtraidos;

    // Mescla dados de IA com heurística para garantir que nada foi perdido
    return {
      servicos: parsed.servicos && parsed.servicos.length > 0 ? parsed.servicos : heuristica.servicos,
      endereco: parsed.endereco || heuristica.endereco,
      horarios: parsed.horarios || heuristica.horarios,
      pagamento: parsed.pagamento || heuristica.pagamento,
      regras: parsed.regras || heuristica.regras,
      perguntaResposta: parsed.perguntaResposta || heuristica.perguntaResposta,
      respostaParaDono: parsed.respostaParaDono,
      proximaEtapa: parsed.proximaEtapa,
    };
  } catch {
    return heuristica;
  }
}

/**
 * Converte HorarioExtraido em array de 7 BusinessHour (0 a 6).
 */
export function formatarBusinessHours(horario: HorarioExtraido): BusinessHour[] {
  const diasAtivos = new Set(horario.diasSemana);
  const horas: BusinessHour[] = [];
  for (let dia = 0; dia <= 6; dia++) {
    const ativo = diasAtivos.has(dia);
    horas.push({
      day: dia,
      open: horario.abre,
      close: horario.fecha,
      closed: !ativo,
    });
  }
  return horas;
}

/**
 * Processa a mensagem do dono no WhatsApp de onboarding, persiste os dados extraídos
 * no banco e retorna a resposta com sugestões da próxima onda.
 */
export async function processarEntrevistaDono({
  companyId,
  mensagem,
  historico,
}: {
  companyId: string;
  mensagem: string;
  historico?: Array<{ de: "dono" | "atendente"; texto: string }>;
}): Promise<{
  resposta: string;
  salvou: {
    servicos: number;
    endereco: boolean;
    horarios: boolean;
    pagamento: boolean;
    regras: boolean;
    pergunta: boolean;
  };
  completo: boolean;
  sugestoes: string[];
}> {
  const dados = await extrairDadosDaMensagem(mensagem, historico);

  const salvou = {
    servicos: 0,
    endereco: false,
    horarios: false,
    pagamento: false,
    regras: false,
    pergunta: false,
  };

  const confirmacoes: string[] = [];

  // 1. Salvar Serviços
  if (dados.servicos && dados.servicos.length > 0) {
    const servicosExistentes = await listarServicos(companyId);
    for (const novo of dados.servicos) {
      const jaExiste = servicosExistentes.find(
        (s) => s.name.trim().toLowerCase() === novo.name.trim().toLowerCase(),
      );
      if (!jaExiste) {
        await criarServico(companyId, {
          name: novo.name,
          priceCents: novo.priceCents,
          durationMin: novo.durationMin ?? 30,
        });
        salvou.servicos++;
      }
    }
    if (salvou.servicos > 0) {
      confirmacoes.push(`Cadastrei ${salvou.servicos} serviço${salvou.servicos > 1 ? "s" : ""} na sua tabela! ✨`);
    }
  }

  // 2. Salvar Endereço
  if (dados.endereco) {
    await prisma.companyProfile.upsert({
      where: { companyId },
      create: { companyId, address: dados.endereco },
      update: { address: dados.endereco },
    });
    salvou.endereco = true;
    confirmacoes.push("Anotei o seu endereço certinho. 📍");
  }

  // 3. Salvar Horários
  if (dados.horarios) {
    const bHours = formatarBusinessHours(dados.horarios);
    await prisma.companyProfile.upsert({
      where: { companyId },
      create: { companyId, businessHours: bHours },
      update: { businessHours: bHours },
    });
    salvou.horarios = true;
    confirmacoes.push("Horários de atendimento salvos na agenda. 📅");
  }

  // 4. Salvar Pagamento
  if (dados.pagamento) {
    await prisma.companyProfile.upsert({
      where: { companyId },
      create: { companyId, paymentMethods: dados.pagamento },
      update: { paymentMethods: dados.pagamento },
    });
    salvou.pagamento = true;
    confirmacoes.push("Formas de pagamento registradas. 💳");
  }

  // 5. Salvar Regras / Descrição
  if (dados.regras) {
    const perfilAtual = await prisma.companyProfile.findUnique({
      where: { companyId },
      select: { description: true },
    });
    const descAtual = perfilAtual?.description ? `${perfilAtual.description}\n${dados.regras}` : dados.regras;
    await prisma.companyProfile.upsert({
      where: { companyId },
      create: { companyId, description: descAtual },
      update: { description: descAtual },
    });
    salvou.regras = true;
    confirmacoes.push(`Salvei a regra: "${dados.regras}".`);
  }

  // 6. Salvar Pergunta & Resposta Treinada
  if (dados.perguntaResposta) {
    await prisma.knowledgeItem.create({
      data: {
        companyId,
        question: dados.perguntaResposta.pergunta,
        answer: dados.perguntaResposta.resposta,
        source: "TRAINING",
        status: "APPROVED",
        approvedAt: new Date(),
      },
    });

    const pLimpa = dados.perguntaResposta.pergunta.replace(/\?+$/, "").trim();
    if (/desconto|promo/i.test(pLimpa) && !pLimpa.includes("?")) {
      const pInterrogativa = `Tem desconto ${pLimpa.replace(/tem\s+desconto/i, "").trim()}?`;
      try {
        await prisma.knowledgeItem.create({
          data: {
            companyId,
            question: pInterrogativa,
            answer: dados.perguntaResposta.resposta,
            source: "TRAINING",
            status: "APPROVED",
            approvedAt: new Date(),
          },
        });
      } catch {
        // silencioso
      }
    }

    salvou.pergunta = true;
    confirmacoes.push(`Quando perguntarem sobre "${dados.perguntaResposta.pergunta}", já sei exatamente o que responder! 🧠`);
  }

  // Verifica o estado atualizado dos fatos para saber qual é o próximo passo
  const fatos = await fatosDaEmpresa(companyId);
  const temServicos = fatos.servicos.length > 0;
  const temHorario = fatos.horarios.some((h) => !h.closed);
  const temEndereco = Boolean(fatos.endereco && fatos.endereco.trim().length > 3);
  const temPagamento = Boolean(fatos.pagamento && fatos.pagamento.trim().length > 2);

  const completo = temServicos && temHorario && temEndereco && temPagamento;

  let respostaFinal = dados.respostaParaDono?.trim();
  let sugestoes: string[] = [];

  if (!respostaFinal) {
    if (confirmacoes.length > 0) {
      respostaFinal = `${confirmacoes.join(" ")} Se quiser me ensinar mais alguma regra ou já testar no simulador, é só falar!`;
      sugestoes = ["Testar como Cliente", "Adicionar mais um serviço", "Outra regra"];
    } else if (!temServicos) {
      respostaFinal = "Quais são os principais serviços que vocês oferecem e quanto custa cada um?";
      sugestoes = ["Corte R$ 45 e Barba R$ 35", "Consulta R$ 150", "Manicure R$ 35"];
    } else if (!temHorario || !temEndereco) {
      respostaFinal = "Onde fica o seu espaço ou qual endereço informo aos clientes? Quais dias e horários vocês atendem?";
      sugestoes = [
        "Seg a Sex 9h às 18h na Av. Paulista, 1000",
        "Seg a Sáb 8h às 19h",
        "Atendimento 100% online",
      ];
    } else if (!temPagamento) {
      respostaFinal = "Quais formas de pagamento você aceita (Pix, cartão, dinheiro)? Tem alguma tolerância de atraso?";
      sugestoes = ["Aceito Pix, cartão e dinheiro", "Pix e Cartão (tolerância de 15 min)"];
    } else {
      respostaFinal = "Entendido! Salvei essa informação. Pode me mandar qualquer outro serviço, horário ou regra que já aprendo na hora!";
      sugestoes = ["Testar como Cliente", "Adicionar mais um serviço", "Outra regra"];
    }
  } else {
    if (!temServicos) {
      sugestoes = ["Corte R$ 45 e Barba R$ 35", "Consulta R$ 150", "Manicure R$ 35"];
    } else if (!temHorario || !temEndereco) {
      sugestoes = ["Seg a Sex 9h às 18h", "Seg a Sáb 8h às 19h", "Atendimento online"];
    } else if (!temPagamento) {
      sugestoes = ["Pix, cartão e dinheiro", "Tolerância 15 min"];
    } else {
      sugestoes = ["Testar como Cliente", "Adicionar mais um serviço"];
    }
  }

  return {
    resposta: respostaFinal,
    salvou,
    completo,
    sugestoes,
  };
}

/**
 * Mensagem inicial do atendente ao abrir a aba "Ensinar Atendente".
 */
export async function obterMensagemInicialEntrevista(companyId: string): Promise<{
  mensagem: string;
  sugestoes: string[];
  status: {
    temServicos: boolean;
    temHorario: boolean;
    temEndereco: boolean;
    temPagamento: boolean;
    completo: boolean;
  };
}> {
  const fatos = await fatosDaEmpresa(companyId);
  const temServicos = fatos.servicos.length > 0;
  const temHorario = fatos.horarios.some((h) => !h.closed);
  const temEndereco = Boolean(fatos.endereco && fatos.endereco.trim().length > 3);
  const temPagamento = Boolean(fatos.pagamento && fatos.pagamento.trim().length > 2);
  const completo = temServicos && temHorario && temEndereco && temPagamento;

  const nomeEmpresa = fatos.empresa.trim() || "sua empresa";
  const nomeAtendente = fatos.nome.trim() || "sua atendente virtual";

  if (!temServicos) {
    return {
      mensagem: `Oi! 👋 Eu sou a ${nomeAtendente} da ${nomeEmpresa}.\n\nPara eu já poder tirar dúvidas e agendar clientes para você no WhatsApp, me conta rapidinho: quais são os seus principais serviços e valores?`,
      sugestoes: ["Corte R$ 45 e Barba R$ 35", "Consulta R$ 150", "Manicure R$ 35"],
      status: { temServicos, temHorario, temEndereco, temPagamento, completo },
    };
  }

  if (!temHorario || !temEndereco) {
    return {
      mensagem: `Oi! 👋 Já temos os seus serviços cadastrados! Onde fica o seu espaço físico e quais dias e horários você costuma atender?`,
      sugestoes: [
        "Seg a Sex 9h às 18h na Av. Paulista, 1000",
        "Seg a Sáb 8h às 19h",
        "Atendimento 100% online",
      ],
      status: { temServicos, temHorario, temEndereco, temPagamento, completo },
    };
  }

  if (!temPagamento) {
    return {
      mensagem: `Oi! 👋 Quais formas de pagamento você aceita (Pix, cartão, dinheiro)? Tem alguma tolerância de atraso ou regra da casa?`,
      sugestoes: ["Pix, cartão e dinheiro", "Tolerância de 15 minutos"],
      status: { temServicos, temHorario, temEndereco, temPagamento, completo },
    };
  }

  return {
    mensagem: `Oi! 👋 Já decorei todos os dados essenciais da ${nomeEmpresa} (serviços, horários e endereço).\n\nSe quiser me ensinar alguma resposta nova, adicionar um serviço ou mudar horários, é só me mandar aqui como uma mensagem normal!`,
    sugestoes: ["Adicionar mais um serviço", "Mudar horário de atendimento", "Quando perguntarem X, responda Y"],
    status: { temServicos, temHorario, temEndereco, temPagamento, completo },
  };
}
