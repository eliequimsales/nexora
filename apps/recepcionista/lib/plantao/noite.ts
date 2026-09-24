import type { BusinessHour } from "@/lib/validation";
import { lojaFechada } from "@/lib/atendente/portao";

/**
 * GATILHO DA NOITE (Fase 0 do Plantão)
 *
 * Mede as mensagens que chegam no WhatsApp conectado enquanto a loja está fechada.
 * É, ao mesmo tempo, o termômetro de demanda para o Nexora Completo e a prova
 * para o dono de que clientes mandam mensagem fora do horário comercial e ficam
 * sem resposta.
 *
 * "Enquanto vocês estavam fechados: X mensagens chegaram fora do horário nesta
 * semana. Y ainda não tiveram resposta — a mais antiga, de [Nome], [data/hora]."
 */

export interface MensagemClienteNoite {
  id: string;
  clienteNome: string | null;
  clienteTelefone: string;
  recebidaEm: Date;
  respondida: boolean;
}

export interface GatilhoDaNoite {
  totalForaDoHorario: number;
  semResposta: number;
  maisAntiga: {
    nome: string;
    telefone: string;
    quandoTexto: string;
    recebidaEm: string;
  } | null;
  semana: number;
  whatsappConectado: boolean;
  ehExemplo: boolean;
}

/**
 * Formata o momento no padrão do documento aprovado: "sábado às 21h12" ou "terça às 08h30".
 */
export function formatarMomentoDaNoite(d: Date): string {
  const diaSemana = d.toLocaleDateString("pt-BR", { weekday: "long", timeZone: "America/Sao_Paulo" });
  const diaSimples = diaSemana.replace("-feira", "");
  const horas = d.toLocaleTimeString("pt-BR", { hour: "2-digit", minute: "2-digit", timeZone: "America/Sao_Paulo" });
  const horaTexto = horas.replace(":", "h");
  return `${diaSimples} às ${horaTexto}`;
}

/**
 * Calcula o resumo de mensagens da noite com base nas mensagens da semana e horários da empresa.
 */
export function calcularGatilhoDaNoite(p: {
  mensagens: MensagemClienteNoite[];
  horarios: BusinessHour[];
  diasFechados: string[];
  whatsappConectado: boolean;
  semana?: number;
  agora?: Date;
}): GatilhoDaNoite {
  const agora = p.agora ?? new Date();
  const semana = p.semana ?? 3;

  if (!p.whatsappConectado) {
    // Sem WhatsApp conectado: conscientização da esteira sem dados fictícios
    return {
      totalForaDoHorario: 0,
      semResposta: 0,
      maisAntiga: null,
      semana,
      whatsappConectado: false,
      ehExemplo: true,
    };
  }

  // Com WhatsApp conectado: avalia mensagens que chegaram com loja fechada
  const fora = p.mensagens.filter((m) =>
    lojaFechada({ horarios: p.horarios, diasFechados: p.diasFechados, agora: m.recebidaEm }),
  );

  const totalForaDoHorario = fora.length;
  const naoRespondidas = fora.filter((m) => !m.respondida);
  const semResposta = naoRespondidas.length;

  // A mais antiga que ficou sem resposta
  const ordenada = [...naoRespondidas].sort(
    (a, b) => a.recebidaEm.getTime() - b.recebidaEm.getTime(),
  );
  const maisAntigaMsg = ordenada[0] ?? null;

  const maisAntiga = maisAntigaMsg
    ? {
        nome: maisAntigaMsg.clienteNome?.trim() || "Cliente",
        telefone: maisAntigaMsg.clienteTelefone,
        quandoTexto: formatarMomentoDaNoite(maisAntigaMsg.recebidaEm),
        recebidaEm: maisAntigaMsg.recebidaEm.toISOString(),
      }
    : null;

  return {
    totalForaDoHorario,
    semResposta,
    maisAntiga,
    semana,
    whatsappConectado: true,
    ehExemplo: false,
  };
}
