"use client";

import { useRouter } from "next/navigation";
import { useReducer, useState } from "react";
import { conviteDeVolta, primeiroNome } from "@/lib/recuperacao/convite";
import { DECLARACAO_BASE } from "@/lib/legal/identidade";
import { AcaoConvite } from "@/components/acao-convite";
import { TresNomes } from "@/components/diagnostico/tres-nomes";
import { EventoAoMontar, registrar } from "@/components/funil";
import { FRASE_SOCORRO, linkDeSocorro } from "@/lib/contato";

/**
 * O ÚNICO dono do estado desta página.
 *
 * A lista colada é dado pessoal de terceiros — dos clientes de quem está
 * usando. Ela existe em exatamente um lugar na memória para que "apagar minha
 * lista" seja uma linha de código e não uma caçada por vários useState
 * espalhados. Nada vai para URL (fica no histórico e nos logs do proxy), nada
 * para cookie (viaja em toda requisição) e nada para localStorage (sobrevive à
 * sessão). A promessa da página é "nada fica" — o código precisa honrar isso.
 */

const SEGMENTOS: { valor: string; rotulo: string }[] = [
  { valor: "barbearia", rotulo: "Barbearia" },
  { valor: "salao-de-beleza", rotulo: "Salão de beleza" },
  { valor: "estetica", rotulo: "Estética" },
  { valor: "pet-shop", rotulo: "Pet shop" },
  { valor: "academia", rotulo: "Academia / personal" },
  { valor: "odontologia", rotulo: "Odontologia" },
  { valor: "fisioterapia", rotulo: "Fisioterapia" },
];

const EXEMPLO_PLACEHOLDER = `João Silva, (11) 98888-7777, 12/03/2026, R$ 50,00
Maria Souza; 11 97777-6666; 28/02/2026; 120,00
01/02/2026 14:22 - Carla Mendes: oi, tem horário sábado?`;

type NomeDoTop = {
  nome: string;
  telefone: string;
  diasSumido: number;
  ticketCents: number;
  visitas: number;
  confianca: "alta" | "baixa";
  porque: string;
};

type Diagnostico = {
  totalClientes: number;
  sumidos: number;
  percentualSumido: number;
  recuperavelCents: { min: number; central: number; max: number };
  metodo: string;
  confianca: "alta" | "baixa";
  motivoConfianca: string;
  nomes: NomeDoTop[];
  corteHonesto: boolean;
  recomendacao: string;
  faltando: { data: boolean; valor: boolean };
};

type Resposta = {
  diagnostico: Diagnostico;
  importacao: {
    lidos: number;
    origem: "tabular" | "whatsapp";
    aviso: string | null;
    ignoradas: number;
    exemplosIgnorados: { linha: number; conteudo: string; motivo: string }[];
  };
};

type LinhaIgnorada = { linha: number; conteudo: string; motivo: string };

type Estado = {
  texto: string;
  segmento: string;
  meuNome: string;
  ticketReais: string;
  fase: "vazio" | "processando" | "pronto" | "erro";
  dados: Resposta | null;
  erro: { mensagem: string; linhas: LinhaIgnorada[] } | null;
};

type Acao =
  | { tipo: "campo"; campo: "texto" | "segmento" | "meuNome" | "ticketReais"; valor: string }
  | { tipo: "processando" }
  | { tipo: "pronto"; dados: Resposta }
  | { tipo: "erro"; mensagem: string; linhas?: LinhaIgnorada[] }
  | { tipo: "voltar" }
  | { tipo: "apagar" };

const INICIAL: Estado = {
  texto: "",
  segmento: "",
  meuNome: "",
  ticketReais: "",
  fase: "vazio",
  dados: null,
  erro: null,
};

function reducer(estado: Estado, acao: Acao): Estado {
  switch (acao.tipo) {
    case "campo":
      return { ...estado, [acao.campo]: acao.valor };
    case "processando":
      return { ...estado, fase: "processando", erro: null };
    case "pronto":
      return { ...estado, fase: "pronto", dados: acao.dados, erro: null };
    case "erro":
      return {
        ...estado,
        fase: "erro",
        erro: { mensagem: acao.mensagem, linhas: acao.linhas ?? [] },
      };
    // Volta para a caixa PRESERVANDO o texto: a causa mais comum de recusa é
    // colagem incompleta, e obrigar a colar de novo perde o lead legítimo.
    case "voltar":
      return { ...estado, fase: "vazio", erro: null };
    case "apagar":
      return INICIAL;
    default:
      return estado;
  }
}

const reais = (cents: number) =>
  (cents / 100).toLocaleString("pt-BR", { style: "currency", currency: "BRL" });

const contarLinhas = (t: string) => t.split(/\r?\n/).filter((l) => l.trim()).length;

/**
 * O ticket que o dono digitou, em centavos.
 *
 * Devolve undefined quando ele não informou — e nesse caso a tela não mostra
 * dinheiro nenhum, de propósito. Inventar valor a partir de três nomes seria
 * número com cara de dado, e a Constituição proíbe.
 *
 * A faixa é a mesma que o zod da rota aceita (R$ 5 a R$ 5.000), para as duas
 * portas não divergirem.
 */
function ticketEmCents(bruto: string): number | undefined {
  const limpo = (bruto ?? "").replace(/[^0-9,.]/g, "").replace(",", ".");
  const n = Number.parseFloat(limpo);
  if (!Number.isFinite(n) || n <= 0) return undefined;
  const cents = Math.round(n * 100);
  return cents >= 500 && cents <= 500_000 ? cents : undefined;
}

const socorro = linkDeSocorro("ler a lista");

export function PainelDiagnostico() {
  const [e, dispatch] = useReducer(reducer, INICIAL);
  const [abrirConta, setAbrirConta] = useState(false);
  // "memoria" e o padrao: e a unica porta que abre no celular, que e de onde
  // vem o trafego de anuncio.
  const [porta, setPorta] = useState<"memoria" | "lista">("memoria");

  const analisar = async (ticketCents?: number) => {
    dispatch({ tipo: "processando" });
    // Piso de tempo: sem ele o resultado pisca e parece que nada foi calculado.
    const inicio = Date.now();
    try {
      const res = await fetch("/api/diagnostico", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          texto: e.texto,
          segmento: e.segmento || undefined,
          meuNome: e.meuNome || undefined,
          ticketPadraoCents: ticketCents,
        }),
      });
      const json = await res.json();
      const espera = Math.max(0, 900 - (Date.now() - inicio));
      await new Promise((r) => setTimeout(r, espera));

      if (!res.ok) {
        dispatch({
          tipo: "erro",
          mensagem:
            res.status === 429
              ? "Calma que eu não fujo. Você já rodou várias listas nos últimos minutos e eu limito isso para não derrubar o servidor. Tenta de novo daqui a pouco — sua lista continua aqui, não precisa colar de novo."
              : (json.error ?? "Não consegui ler essa lista agora."),
          linhas: json.exemplosIgnorados ?? json.ignoradas ?? [],
        });
        return;
      }
      dispatch({ tipo: "pronto", dados: json });
    } catch {
      dispatch({
        tipo: "erro",
        mensagem: "Falha de conexão. Sua lista continua aqui — tenta de novo?",
      });
    }
  };

  const lerArquivo = async (arquivo: File | undefined) => {
    if (!arquivo) return;
    dispatch({ tipo: "campo", campo: "texto", valor: await arquivo.text() });
  };

  // -------------------------------------------------------------------------
  if (e.fase === "processando") {
    return <Processando linhas={contarLinhas(e.texto)} />;
  }

  if (e.fase === "erro") {
    return (
      <ErroLeitura
        mensagem={e.erro?.mensagem ?? ""}
        linhas={e.erro?.linhas ?? []}
        onVoltar={() => dispatch({ tipo: "voltar" })}
      />
    );
  }

  if (e.fase === "pronto" && e.dados) {
    return (
      <>
        <Resultado
          dados={e.dados}
          meuNome={e.meuNome}
          ticketReais={e.ticketReais}
          onTicket={(v) => dispatch({ tipo: "campo", campo: "ticketReais", valor: v })}
          onRefazerComTicket={(cents) => analisar(cents)}
          onVoltar={() => dispatch({ tipo: "voltar" })}
          onApagar={() => dispatch({ tipo: "apagar" })}
          onCriarConta={() => setAbrirConta(true)}
        />
        {abrirConta && (
          <PortaEntrada
            texto={e.texto}
            meuNome={e.meuNome}
            sumidos={e.dados.diagnostico.sumidos}
            onFechar={() => setAbrirConta(false)}
          />
        )}
      </>
    );
  }

  // -------------------------------------------------------------------------
  // DUAS PORTAS, e a de memória vem primeiro.
  //
  // A porta da lista exige um computador: colar do Excel e escolher arquivo são
  // gestos de mesa, e o tráfego de anúncio chega pelo celular. Quem já tem a
  // lista na mão continua tendo o caminho — mas ele deixa de ser o único, e
  // deixa de ser o primeiro.
  if (porta === "memoria") {
    return (
      <TresNomes
        segmento={e.segmento}
        negocio={e.meuNome}
        ticketCents={ticketEmCents(e.ticketReais)}
        aoQuererLista={() => setPorta("lista")}
      />
    );
  }

  return (
    <div className="rounded-2xl border border-night-line bg-night-soft/60 p-6 sm:p-7">
      <button
        onClick={() => setPorta("memoria")}
        className="mb-5 text-sm text-mist/45 underline underline-offset-4 hover:text-mist/70"
      >
        ← Não tenho a lista aqui agora
      </button>

      <label htmlFor="lista" className="font-display text-lg font-semibold">
        Cola sua lista de clientes aqui
      </label>

      {/* A frase de privacidade vem ANTES da caixa. Depois dela, só seria lida
          por quem já colou — ou seja, por quem não precisava dela. */}
      <p className="mt-3 border-l-[3px] border-amber pl-4 text-sm leading-relaxed text-mist/65">
        Sua lista não fica com a gente. Ela é lida na memória do servidor, o resultado
        aparece aqui na tela e ela é jogada fora junto com a resposta — não vai para banco
        de dados, não vira arquivo, não cai no e-mail de ninguém. Se você fechar essa aba
        agora, não sobrou nada em lugar nenhum.
      </p>

      <textarea
        id="lista"
        value={e.texto}
        onChange={(ev) => dispatch({ tipo: "campo", campo: "texto", valor: ev.target.value })}
        rows={8}
        placeholder={EXEMPLO_PLACEHOLDER}
        className="mt-4 w-full rounded-xl border border-night-line bg-night p-4 font-mono text-[13px] leading-relaxed text-mist outline-none placeholder:text-mist/25 focus:border-amber"
      />

      <div className="mt-3 flex flex-wrap items-center gap-x-4 gap-y-2 text-sm">
        <label className="cursor-pointer text-amber underline underline-offset-4">
          ou escolher um arquivo
          <input
            type="file"
            accept=".csv,.txt,.tsv,text/plain"
            className="hidden"
            onChange={(ev) => lerArquivo(ev.target.files?.[0])}
          />
        </label>
        <span className="text-xs text-mist/40">
          {e.texto ? `${contarLinhas(e.texto)} linhas coladas` : "CSV, TXT ou conversa do WhatsApp"}
        </span>
      </div>

      <details className="mt-4 text-sm">
        <summary className="cursor-pointer text-mist/60 hover:text-mist">
          Não sei mexer em planilha
        </summary>
        <div className="mt-3 grid gap-3 text-mist/60">
          <p>
            <strong className="text-mist">Tenho no Excel:</strong> seleciona as células,
            Ctrl+C, e cola aqui. Só isso — não precisa salvar arquivo nem exportar.
          </p>
          <p>
            <strong className="text-mist">Tenho no caderno:</strong> digita como der, um
            cliente por linha, nome e telefone. Data e valor se você lembrar.
          </p>
          <p>
            <strong className="text-mist">Só tenho o WhatsApp:</strong> abre a conversa,
            Mais → Exportar conversa → Sem mídia, e cola o texto aqui.
          </p>
        </div>
      </details>

      <div className="mt-5 grid gap-3 sm:grid-cols-2">
        <div>
          <label htmlFor="seg" className="text-xs uppercase tracking-wide text-mist/45">
            Seu ramo
          </label>
          <select
            id="seg"
            value={e.segmento}
            onChange={(ev) =>
              dispatch({ tipo: "campo", campo: "segmento", valor: ev.target.value })
            }
            className="mt-1 w-full rounded-xl border border-night-line bg-night p-3 text-sm text-mist outline-none focus:border-amber"
          >
            <option value="">Prefiro não dizer</option>
            {SEGMENTOS.map((s) => (
              <option key={s.valor} value={s.valor}>
                {s.rotulo}
              </option>
            ))}
          </select>
        </div>
        <div>
          <label htmlFor="meu" className="text-xs uppercase tracking-wide text-mist/45">
            Seu nome no WhatsApp
          </label>
          <input
            id="meu"
            value={e.meuNome}
            onChange={(ev) =>
              dispatch({ tipo: "campo", campo: "meuNome", valor: ev.target.value })
            }
            placeholder="só se colou uma conversa"
            className="mt-1 w-full rounded-xl border border-night-line bg-night p-3 text-sm text-mist outline-none placeholder:text-mist/25 focus:border-amber"
          />
        </div>
      </div>

      <button
        onClick={() => analisar()}
        disabled={e.texto.trim().length < 10}
        className="mt-6 w-full rounded-xl bg-amber px-6 py-4 font-display text-base font-bold text-night transition hover:brightness-105 disabled:opacity-30"
      >
        Ver quem sumiu
      </button>
      <p className="mt-3 text-center font-mono text-xs text-mist/40">
        De graça. Não precisa criar conta pra ver o resultado.
      </p>
    </div>
  );
}

// ---------------------------------------------------------------------------

function Processando({ linhas }: { linhas: number }) {
  // Números verdadeiros, nunca barra de porcentagem: é uma requisição só, e
  // qualquer percentual seria inventado. Mentir na tela de carregamento da
  // página que vende honestidade é incoerência de graça.
  return (
    <div className="rounded-2xl border border-night-line bg-night-soft/60 p-8">
      <div className="space-y-3 font-mono text-sm text-mist/60">
        <p className="animate-pulse">Lendo {linhas} linhas…</p>
        <p className="animate-pulse [animation-delay:400ms]">
          Separando quem é cliente de quem é cabeçalho…
        </p>
        <p className="animate-pulse [animation-delay:800ms]">
          Calculando o ritmo de cada cliente…
        </p>
      </div>
    </div>
  );
}

function ErroLeitura({
  mensagem,
  linhas,
  onVoltar,
}: {
  mensagem: string;
  linhas: LinhaIgnorada[];
  onVoltar: () => void;
}) {
  return (
    <div className="rounded-2xl border border-night-line bg-night-soft/60 p-6 sm:p-7">
      <h2 className="font-display text-xl font-bold">{mensagem}</h2>

      {linhas.length > 0 && (
        <>
          <p className="mt-4 text-sm text-mist/60">
            Olha o que eu tentei ler e não consegui:
          </p>
          <div className="mt-3 overflow-x-auto rounded-xl border border-night-line">
            <table className="w-full font-mono text-xs">
              <tbody>
                {linhas.map((l) => (
                  <tr key={l.linha} className="border-b border-night-line last:border-0">
                    <td className="p-2 text-mist/40">L{l.linha}</td>
                    <td className="max-w-[220px] truncate p-2 text-mist/70">{l.conteudo}</td>
                    <td className="p-2 text-amber">{l.motivo}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </>
      )}

      <button
        onClick={onVoltar}
        className="mt-5 w-full rounded-xl bg-amber px-6 py-3.5 font-display font-bold text-night transition hover:brightness-105"
      >
        Corrigir e tentar de novo
      </button>
      <p className="mt-3 text-sm text-mist/50">
        Sua lista continua aqui na caixa — não precisa colar de novo.
        {socorro && (
          <>
            {" "}
            <a href={socorro} target="_blank" rel="noopener noreferrer" className="text-amber underline underline-offset-4">
              {FRASE_SOCORRO}
            </a>
          </>
        )}
      </p>
    </div>
  );
}

/**
 * A faixa e o selo de confiança são o MESMO componente, e é de propósito:
 * a assinatura exige método e motivo, então é impossível, por construção,
 * mostrar o número sem dizer de onde ele veio. "Número nunca sai sozinho" é
 * fácil de escrever num documento e fácil de quebrar no próximo refactor.
 */
function FaixaRecuperavel({
  min,
  max,
  metodo,
  confianca,
  motivoConfianca,
}: {
  min: number;
  max: number;
  metodo: string;
  confianca: "alta" | "baixa";
  motivoConfianca: string;
}) {
  return (
    <div>
      <p className="font-display text-3xl font-bold leading-tight sm:text-4xl">
        Tem entre {reais(min)} e {reais(max)} parados na sua lista.
      </p>
      <div className="mt-5 rounded-xl bg-night/60 p-4">
        <p className="text-xs uppercase tracking-wide text-mist/40">
          Como eu cheguei nesse número
        </p>
        <p className="mt-2 text-sm leading-relaxed text-mist/70">{metodo}</p>
        <p className="mt-3 flex flex-wrap items-center gap-2 text-sm">
          <span
            className={`rounded-md px-2 py-0.5 font-mono text-xs ${
              confianca === "alta" ? "bg-amber/20 text-amber" : "bg-mist/10 text-mist/60"
            }`}
          >
            confiança {confianca}
          </span>
          <span className="text-mist/55">{motivoConfianca}</span>
        </p>
      </div>
    </div>
  );
}

function Resultado({
  dados,
  meuNome,
  ticketReais,
  onTicket,
  onRefazerComTicket,
  onVoltar,
  onApagar,
  onCriarConta,
}: {
  dados: Resposta;
  meuNome: string;
  ticketReais: string;
  onTicket: (v: string) => void;
  onRefazerComTicket: (cents: number) => void;
  onVoltar: () => void;
  onApagar: () => void;
  onCriarConta: () => void;
}) {
  const d = dados.diagnostico;
  const imp = dados.importacao;

  const cabecalho = (
    <p className="font-mono text-xs uppercase tracking-[0.14em] text-mist/40">
      sua lista · {imp.lidos} clientes lidos
      {imp.ignoradas > 0 && ` · ${imp.ignoradas} linhas não lidas`}
    </p>
  );

  // Falta a DATA: não dá para dizer quem sumiu. Nunca mostrar número aqui.
  if (d.faltando.data) {
    return (
      <div className="rounded-2xl border border-night-line bg-night-soft/60 p-6 sm:p-7">
        {cabecalho}
        <h2 className="mt-4 font-display text-2xl font-bold">
          Consigo ver seus clientes, mas não consigo saber quem sumiu.
        </h2>
        <p className="mt-4 leading-relaxed text-mist/70">{d.recomendacao}</p>
        <button
          onClick={onVoltar}
          className="mt-6 w-full rounded-xl bg-amber px-6 py-3.5 font-display font-bold text-night transition hover:brightness-105"
        >
          Incluir a data e refazer
        </button>
      </div>
    );
  }

  // Falta o VALOR: já sei QUANTOS sumiram; falta quanto vale. Um campo só.
  if (d.faltando.valor) {
    const cents = Math.round(Number(ticketReais.replace(",", ".")) * 100);
    return (
      <div className="rounded-2xl border border-night-line bg-night-soft/60 p-6 sm:p-7">
        {cabecalho}
        <h2 className="mt-4 font-display text-3xl font-bold leading-tight">
          {d.sumidos} clientes seus pararam de voltar.
        </h2>
        <p className="mt-4 leading-relaxed text-mist/70">
          Sua lista não trazia quanto cada atendimento custa, então eu ainda não sei dizer
          quanto isso é em dinheiro — e eu não invento número.
        </p>
        <label htmlFor="ticket" className="mt-6 block text-sm text-mist">
          Quanto você cobra, em média, por atendimento?
        </label>
        <div className="mt-2 flex gap-2">
          <input
            id="ticket"
            inputMode="decimal"
            value={ticketReais}
            onChange={(ev) => onTicket(ev.target.value)}
            placeholder="50,00"
            className="w-36 rounded-xl border border-night-line bg-night p-3 text-mist outline-none focus:border-amber"
          />
          <button
            onClick={() => onRefazerComTicket(cents)}
            disabled={!Number.isFinite(cents) || cents < 500}
            className="flex-1 rounded-xl bg-amber px-5 py-3 font-display font-bold text-night transition hover:brightness-105 disabled:opacity-30"
          >
            Calcular quanto isso vale
          </button>
        </div>
        <ComandaSumidos nomes={d.nomes} negocio={meuNome} />
      </div>
    );
  }

  // Corte Honesto: o único bloco em papel claro da página. A recusa só aumenta
  // a confiança se custar visivelmente caro para quem recusa.
  if (d.corteHonesto) {
    return (
      <div className="rounded-2xl bg-[#FAF8F2] p-6 text-[#0A0A0F] sm:p-7">
        <p className="font-mono text-xs uppercase tracking-[0.14em] text-[#8A6A00]">
          minha recomendação
        </p>
        <h2 className="mt-3 font-display text-3xl font-bold">
          {d.sumidos === 0
            ? "Boa notícia: não achei ninguém sumido na sua lista."
            : "Não compre a Nexora agora."}
        </h2>
        <p className="mt-4 leading-relaxed text-[#3A372C]">{d.recomendacao}</p>
        <p className="mt-4 leading-relaxed text-[#3A372C]">
          Eu podia ter arredondado esse número pra cima. Dava. Só que você ia pagar no mês
          que vem, mandar mensagem pra oito pessoas, não ver ninguém voltar e cancelar
          achando que foi enganado — e você teria razão. Prefiro te perder hoje, de graça.
        </p>

        <p className="mt-6 font-semibold">Antes de aceitar isso, confere três coisas:</p>
        <ul className="mt-3 grid gap-2 text-sm text-[#3A372C]">
          <li>
            Você colou só os últimos meses? Quem sumiu está no ano passado, não no mês
            passado.
          </li>
          <li>A lista tem a data do último atendimento em cada linha?</li>
          <li>Tem o valor de cada atendimento? Sem valor eu não sei quanto vale.</li>
        </ul>

        <button
          onClick={onVoltar}
          className="mt-6 w-full rounded-xl bg-[#0A0A0F] px-6 py-3.5 font-display font-bold text-[#FAF8F2] transition hover:brightness-125"
        >
          Refazer com a lista completa
        </button>
        <p className="mt-3 text-sm text-[#6B6553]">
          Volte quando tiver uns 25 clientes que não aparecem há mais tempo do que o normal
          deles. Leva dois minutos refazer, e continua de graça.
        </p>
      </div>
    );
  }

  const outros = Math.max(0, d.sumidos - d.nomes.length);

  return (
    <div className="rounded-2xl border border-night-line bg-night-soft/60 p-6 sm:p-7">
      {cabecalho}
      <div className="mt-4">
        <FaixaRecuperavel
          min={d.recuperavelCents.min}
          max={d.recuperavelCents.max}
          metodo={d.metodo}
          confianca={d.confianca}
          motivoConfianca={d.motivoConfianca}
        />
      </div>

      {imp.aviso && (
        <p className="mt-4 rounded-xl bg-amber/10 p-3 text-sm leading-relaxed text-amber">
          {imp.aviso}
        </p>
      )}

      <ComandaSumidos nomes={d.nomes} negocio={meuNome} />

      {outros > 0 && (
        <p className="mt-5 rounded-xl border border-night-line p-4 text-sm leading-relaxed text-mist/65">
          Encontrei <strong className="text-mist">{d.sumidos}</strong> clientes sumidos.
          Mostrei {d.nomes.length}. Os outros {outros} estão nessa mesma lista que você
          acabou de colar — eu não guardei ela, então quando você criar a conta ela entra
          inteira de uma vez e você não vai colar de novo.
        </p>
      )}

      <button
        onClick={onCriarConta}
        className="mt-5 w-full rounded-xl bg-amber px-6 py-4 font-display text-base font-bold text-night transition hover:brightness-105"
      >
        Criar minha conta e trazer esses {d.sumidos} de volta
      </button>
      <p className="mt-3 text-sm leading-relaxed text-mist/55">
        R$ 97 por mês, e o primeiro mês é grátis. Não pedimos cartão agora. Cancele quando
        quiser — você fica com o período que já pagou.
      </p>

      <button
        onClick={onApagar}
        className="mt-5 text-sm text-mist/45 underline underline-offset-4 hover:text-mist/70"
      >
        Apagar minha lista desta tela
      </button>
    </div>
  );
}

/**
 * A COMANDA — e o ponto em que a tela deixa de informar e passa a agir.
 *
 * Antes esta lista era leitura: nome, dias sumido, porquê. Bonito e inútil, do
 * jeito que a Regra Zero proíbe. O dono está olhando o nome de uma cliente real
 * com o telefone dela na mão; a ação que ele quer é falar com ela AGORA.
 *
 * O botão abre o WhatsApp com a mensagem escrita. Ele não precisa da conta, não
 * precisa pagar, e não precisa pensar no que dizer — os três atritos que fazem
 * uma boa intenção morrer entre a tela e o celular.
 */
function ComandaSumidos({ nomes, negocio }: { nomes: NomeDoTop[]; negocio: string }) {
  if (nomes.length === 0) return null;
  return (
    <div className="mt-6">
      <p className="text-xs uppercase tracking-wide text-mist/40">
        Comece por estes — são os que voltam mais fácil
      </p>
      <p className="mt-1 text-sm leading-relaxed text-mist/55">
        A mensagem já vai escrita. Mande para um agora, de graça, e veja se volta antes
        de decidir qualquer coisa sobre a gente.
      </p>
      <div className="mt-3 grid gap-3">
        {nomes.map((n) => {
          const convite = conviteDeVolta({
            nome: n.nome,
            telefone: n.telefone,
            negocio,
          });
          return (
            <div key={n.telefone + n.nome} className="rounded-xl border border-night-line p-4">
              <div className="flex flex-wrap items-baseline justify-between gap-2">
                <span className="font-display font-semibold">{n.nome}</span>
                <span className="font-mono text-xs text-mist/45">
                  sem aparecer há {n.diasSumido} dias
                </span>
              </div>
              <p className="mt-2 text-sm leading-relaxed text-mist/60">{n.porque}</p>

              {convite && (
                <>
                  <p className="mt-3 whitespace-pre-wrap rounded-lg bg-night/60 p-3 text-sm leading-relaxed text-mist/75">
                    {convite.texto}
                  </p>
                  <AcaoConvite
                    texto={convite.texto}
                    href={convite.href}
                    nome={primeiroNome(n.nome)}
                  />
                </>
              )}
            </div>
          );
        })}
      </div>
    </div>
  );
}

/**
 * Do choque até a primeira onda, sem sair da página.
 *
 * Se navegasse para /cadastro, o texto colado morreria e o dono teria que colar
 * a lista uma segunda vez — e a maioria não cola. Por isso o cadastro é um
 * modal aqui, e a importação acontece automaticamente logo depois.
 */
function PortaEntrada({
  texto,
  meuNome,
  sumidos,
  onFechar,
}: {
  texto: string;
  meuNome: string;
  sumidos: number;
  onFechar: () => void;
}) {
  const router = useRouter();
  const [form, setForm] = useState({ name: "", phone: "", email: "", password: "" });
  const [confirmo, setConfirmo] = useState(false);
  const [passo, setPasso] = useState<"form" | "criando" | "importando">("form");
  const [erro, setErro] = useState("");

  const enviar = async () => {
    setErro("");
    setPasso("criando");
    try {
      const conta = await fetch("/api/auth/signup", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ ...form, aceite: confirmo }),
      });
      const jc = await conta.json();
      if (!conta.ok) {
        setErro(jc.error ?? "Não consegui criar a conta.");
        setPasso("form");
        return;
      }

      // A lista entra sozinha. `confirmo` vem do checkbox e NUNCA é fixo no
      // código: é a declaração dele de que pode tratar esses dados, e fabricar
      // isso jogaria um passivo de LGPD no colo do titular da empresa.
      setPasso("importando");
      await fetch("/api/clientes/importar", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          texto,
          meuNome: meuNome || undefined,
          simular: false,
          confirmo,
        }),
      });

      // Fecha o funil: chegou -> comecou_entrada -> viu_numero -> clicou_mensagem
      // -> criou_conta. Sem este ultimo, nao da para calcular CAC nenhum.
      registrar("criou_conta");
      router.push("/painel/onda?origem=diagnostico");
    } catch {
      setErro("Falha de conexão. Tenta de novo?");
      setPasso("form");
    }
  };

  const completo =
    form.name.trim() && form.phone.trim() && form.email.trim() && form.password.length >= 8;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-night/90 p-4">
      <div className="max-h-full w-full max-w-md overflow-y-auto rounded-2xl border border-night-line bg-night-soft p-6">
        {passo !== "form" ? (
          <div className="py-8 text-center">
            <p className="font-display text-lg">
              {passo === "criando" ? "Criando sua conta…" : "Trazendo sua lista…"}
            </p>
            <p className="mt-2 text-sm text-mist/55">
              Não feche essa tela. Já já você está vendo as mensagens prontas.
            </p>
          </div>
        ) : (
          <>
            <h2 className="font-display text-xl font-bold">
              Trazer meus {sumidos} clientes de volta
            </h2>

            <ol className="mt-4 grid gap-2 text-sm text-mist/60">
              <li>1. Você escolhe e-mail e senha. Só isso.</li>
              <li>2. Essa mesma lista entra na sua conta — você não vai colar de novo.</li>
              <li>
                3. Cai direto na tela com as primeiras mensagens prontas, uma pra cada
                cliente, com o nome dele escrito. Você lê, muda se quiser, e manda pelo SEU
                WhatsApp.
              </li>
            </ol>

            <div className="mt-5 grid gap-3">
              {[
                { k: "name", r: "Nome do seu negócio", t: "text", p: "Barbearia do Zé" },
                {
                  k: "phone",
                  r: "Seu WhatsApp (é desse número que as mensagens vão sair)",
                  t: "tel",
                  p: "(11) 98888-7777",
                },
                { k: "email", r: "Seu e-mail", t: "email", p: "voce@exemplo.com" },
                { k: "password", r: "Crie uma senha", t: "password", p: "mínimo 8 caracteres" },
              ].map((c) => (
                <div key={c.k}>
                  <label className="text-xs text-mist/50">{c.r}</label>
                  <input
                    type={c.t}
                    placeholder={c.p}
                    value={form[c.k as keyof typeof form]}
                    onChange={(ev) => setForm({ ...form, [c.k]: ev.target.value })}
                    className="mt-1 w-full rounded-xl border border-night-line bg-night p-3 text-sm text-mist outline-none placeholder:text-mist/25 focus:border-amber"
                  />
                </div>
              ))}
            </div>

            <label className="mt-4 flex items-start gap-2 text-sm text-mist/60">
              <input
                type="checkbox"
                checked={confirmo}
                onChange={(ev) => setConfirmo(ev.target.checked)}
                className="mt-1"
              />
              <span>
                {DECLARACAO_BASE} Aceito também os{" "}
                <a href="/termos" target="_blank" rel="noopener noreferrer" className="underline underline-offset-2">
                  Termos de Uso
                </a>
                , a{" "}
                <a href="/privacidade" target="_blank" rel="noopener noreferrer" className="underline underline-offset-2">
                  Política de Privacidade
                </a>{" "}
                e o{" "}
                <a href="/operador" target="_blank" rel="noopener noreferrer" className="underline underline-offset-2">
                  Contrato de Operador
                </a>
                .
              </span>
            </label>

            {erro && <p className="mt-3 text-sm text-red-300">{erro}</p>}

            <button
              onClick={enviar}
              disabled={!completo || !confirmo}
              className="mt-5 w-full rounded-xl bg-amber px-6 py-3.5 font-display font-bold text-night transition hover:brightness-105 disabled:opacity-30"
            >
              Criar conta e trazer minha lista
            </button>
            <button
              onClick={onFechar}
              className="mt-3 w-full text-sm text-mist/45 hover:text-mist/70"
            >
              Agora não
            </button>
          </>
        )}
      </div>
    </div>
  );
}
