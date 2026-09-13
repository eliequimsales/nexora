"use client";

import Link from "next/link";
import { useState } from "react";
import { DECLARACAO_BASE } from "@/lib/legal/identidade";

/**
 * TRAZER OS CLIENTES — a tela.
 *
 * A adoção de todo concorrente morre aqui: pede-se "um CSV com as colunas
 * certas", o dono não sabe exportar, e o produto acaba antes de começar. Então
 * a promessa desta tela é literal — manda do jeito que estiver. E a palavra
 * "CSV" não aparece: quem precisa dela não precisa desta tela.
 *
 * Duas passadas de propósito. Primeiro a Nexora mostra o que ENTRARIA, com o
 * que ela não conseguiu ler dito em português. Só depois o dono salva. Ver
 * antes é a diferença entre um erro corrigível e uma lista contaminada, e é
 * também o que prova que a gente não esconde falha.
 */

type SemTelefone = { nome: string; motivo: string };

type Resultado = {
  criar: number;
  atualizar: number;
  ignoradosPorOptOut: number;
  visitasNovas: number;
  visitasDuplicadas: number;
  semTelefone: SemTelefone[];
  baseTotalDepois: number;
  simulado: boolean;
  origem: "tabular" | "whatsapp";
  aviso: string | null;
  linhasIgnoradas: number;
  suprimidos: number;
  exemplosIgnorados: { linha: number; conteudo: string; motivo: string }[];
};

/** A recusa que o servidor manda quando a assinatura não cobre a ação. */
type Recusa = { motivo: string; acao: { texto: string; href: string } };

const EXEMPLO = `Nome, Telefone, Última visita, Valor
João Silva, (11) 98888-7777, 12/03/2026, R$ 50,00
Maria Souza, 11 97777-6666, 28/02/2026, R$ 120,00`;

type LinhaCliente = {
  id: string;
  nome: string;
  telefone: string;
  data: string;
  valor: string;
};

export default function PaginaImportar() {
  const [modo, setModo] = useState<"campos" | "colar">("campos");
  const [linhas, setLinhas] = useState<LinhaCliente[]>([
    { id: "1", nome: "", telefone: "", data: "", valor: "" },
    { id: "2", nome: "", telefone: "", data: "", valor: "" },
  ]);
  const [texto, setTexto] = useState("");
  const [meuNome, setMeuNome] = useState("");
  const [confirmo, setConfirmo] = useState(false);
  const [carregando, setCarregando] = useState(false);
  const [erro, setErro] = useState("");
  const [recusa, setRecusa] = useState<Recusa | null>(null);
  const [previa, setPrevia] = useState<Resultado | null>(null);
  const [salvo, setSalvo] = useState<Resultado | null>(null);

  const adicionarLinha = () => {
    setLinhas((prev) => [
      ...prev,
      { id: String(Date.now() + Math.random()), nome: "", telefone: "", data: "", valor: "" },
    ]);
    setPrevia(null);
  };

  const removerLinha = (id: string) => {
    setLinhas((prev) => {
      const filtradas = prev.filter((l) => l.id !== id);
      return filtradas.length > 0
        ? filtradas
        : [{ id: String(Date.now()), nome: "", telefone: "", data: "", valor: "" }];
    });
    setPrevia(null);
  };

  const atualizarLinha = (id: string, campo: keyof Omit<LinhaCliente, "id">, valor: string) => {
    setLinhas((prev) => prev.map((l) => (l.id === id ? { ...l, [campo]: valor } : l)));
    setPrevia(null);
  };

  const preencherExemplo = () => {
    setLinhas([
      { id: "1", nome: "João Silva", telefone: "(11) 98888-7777", data: "12/03/2026", valor: "R$ 50,00" },
      { id: "2", nome: "Maria Souza", telefone: "11 97777-6666", data: "28/02/2026", valor: "R$ 120,00" },
    ]);
    setTexto(EXEMPLO);
    setPrevia(null);
  };

  function gerarTextoDeLinhas(lista: LinhaCliente[]): string {
    const preenchidas = lista.filter(
      (l) => l.nome.trim() || l.telefone.trim() || l.data.trim() || l.valor.trim()
    );
    if (preenchidas.length === 0) return "";
    const header = "Nome, Telefone, Última visita, Valor";
    const rows = preenchidas.map((l) => {
      const nome = l.nome.trim();
      const tel = l.telefone.trim();
      const data = l.data.trim();
      const val = l.valor.trim();
      return [nome, tel, data, val].filter(Boolean).join(", ");
    });
    return [header, ...rows].join("\n");
  }

  // Se o dono salvar o exemplo, João Silva e Maria Souza viram clientes de
  // verdade, entram na lista de segunda e recebem mensagem. Lista suja não tem
  // desfazer — por isso a comparação existe e trava o botão de salvar.
  const aindaEhOExemplo =
    (modo === "colar" && texto.trim() === EXEMPLO.trim()) ||
    (modo === "campos" &&
      linhas.length === 2 &&
      linhas[0]?.nome.trim() === "João Silva" &&
      linhas[1]?.nome.trim() === "Maria Souza");

  const enviar = async (simular: boolean) => {
    setCarregando(true);
    setErro("");
    setRecusa(null);

    const payloadTexto = modo === "campos" ? gerarTextoDeLinhas(linhas) : texto;

    if (payloadTexto.trim().length < 5) {
      setErro("Preencha pelo menos o nome e o telefone de um cliente para continuar.");
      setCarregando(false);
      return;
    }

    try {
      const res = await fetch("/api/clientes/importar", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ texto: payloadTexto, meuNome: meuNome || undefined, simular, confirmo }),
      });
      const json = await res.json();
      if (!res.ok) {
        // A recusa por assinatura vem com o caminho para resolver. Ler só o
        // texto e jogar o botão fora transforma a negativa em beco sem saída.
        if (json.acao?.href) setRecusa({ motivo: json.error ?? "", acao: json.acao });
        else setErro(json.error ?? "Não consegui ler essa lista.");
        return;
      }
      if (simular) setPrevia(json);
      else setSalvo(json);
    } catch {
      setErro("Não consegui falar com a internet agora. Tenta de novo?");
    } finally {
      setCarregando(false);
    }
  };

  const lerArquivo = async (arquivo: File | undefined) => {
    if (!arquivo) return;
    setPrevia(null);
    setTexto(await arquivo.text());
  };

  // -------------------------------------------------------------------------
  // Salvo: a tela termina apontando para a ação que gera dinheiro, não num
  // "importação concluída" que deixa o dono sem próximo passo.
  // -------------------------------------------------------------------------
  if (salvo) {
    return (
      <main className="max-w-2xl space-y-5">
        <h1 className="font-display text-2xl text-panel-ink">Lista atualizada</h1>
        <div className="rounded-2xl border border-panel-line bg-panel-card p-6">
          <p className="text-panel-ink">
            Entraram <strong>{salvo.criar}</strong> clientes novos e{" "}
            <strong>{salvo.visitasNovas}</strong> visitas. Sua lista agora tem{" "}
            <strong>{salvo.baseTotalDepois}</strong> clientes.
          </p>
          {salvo.visitasDuplicadas > 0 && (
            <p className="mt-2 text-sm text-panel-sub">
              {salvo.visitasDuplicadas} visitas já estavam anotadas e foram ignoradas — mandar a
              mesma planilha duas vezes não duplica nada.
            </p>
          )}
          <Link
            href="/painel/onda"
            className="mt-5 inline-flex rounded-xl bg-amber px-5 py-3 text-sm font-semibold text-night transition hover:brightness-110"
          >
            Ver quem sumiu
          </Link>
        </div>
      </main>
    );
  }

  const temPeloMenosUmCliente =
    modo === "campos"
      ? linhas.some((l) => l.nome.trim() && l.telefone.trim())
      : texto.trim().length >= 10;

  return (
    <main className="max-w-3xl space-y-6">
      <header>
        <h1 className="font-display text-2xl text-panel-ink">Trazer meus clientes</h1>
        <p className="mt-1 text-sm text-panel-sub">
          Adicione os dados dos seus clientes pelos campos abaixo ou, se preferir, cole sua planilha.
        </p>
      </header>

      {/* O medo aqui é de formato. Mata-se o medo antes do campo. */}
      <div className="rounded-2xl border border-amber/40 bg-amber/10 p-5">
        <p className="text-sm leading-relaxed text-panel-ink">
          Preencha os campos abaixo com os dados dos seus clientes. A Nexora organiza tudo
          automaticamente para você, identifica quem está sumido e mostra o resultado antes de salvar qualquer coisa.
        </p>
      </div>

      <div className="rounded-2xl border border-panel-line bg-panel-card p-5 space-y-5">
        {/* Abas de alternância de modo */}
        <div className="flex items-center gap-2 border-b border-panel-line pb-3">
          <button
            type="button"
            onClick={() => setModo("campos")}
            className={`rounded-xl px-4 py-2 text-sm font-semibold transition ${
              modo === "campos"
                ? "bg-panel-ink text-white"
                : "text-panel-sub hover:text-panel-ink hover:bg-panel-bg"
            }`}
          >
            Preencher por campos
          </button>
          <button
            type="button"
            onClick={() => setModo("colar")}
            className={`rounded-xl px-4 py-2 text-sm font-semibold transition ${
              modo === "colar"
                ? "bg-panel-ink text-white"
                : "text-panel-sub hover:text-panel-ink hover:bg-panel-bg"
            }`}
          >
            Colar planilha / texto
          </button>
        </div>

        {modo === "campos" ? (
          /* MODO CAMPOS INDIVIDUAIS */
          <div className="space-y-4">
            <div className="flex items-center justify-between">
              <span className="text-sm font-medium text-panel-ink">
                Preencha os dados de cada cliente:
              </span>
              <button
                type="button"
                onClick={preencherExemplo}
                className="rounded-lg border border-panel-line px-3 py-1.5 text-xs text-panel-sub transition hover:border-amber hover:text-amber-deep"
              >
                Preencher com exemplo de teste
              </button>
            </div>

            <div className="space-y-3">
              {linhas.map((linha, index) => (
                <div
                  key={linha.id}
                  className="rounded-xl border border-panel-line bg-panel-bg p-4 space-y-3 transition hover:border-panel-sub/30"
                >
                  <div className="flex items-center justify-between">
                    <span className="text-xs font-semibold text-panel-sub uppercase tracking-wider">
                      Cliente {index + 1}
                    </span>
                    {linhas.length > 1 && (
                      <button
                        type="button"
                        onClick={() => removerLinha(linha.id)}
                        className="text-xs text-panel-sub hover:text-red-600 transition flex items-center gap-1 font-medium"
                        title="Remover este cliente"
                      >
                        Remover
                      </button>
                    )}
                  </div>

                  <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-3">
                    <div>
                      <label className="block text-xs font-medium text-panel-ink mb-1">
                        Nome
                      </label>
                      <input
                        type="text"
                        value={linha.nome}
                        onChange={(e) => atualizarLinha(linha.id, "nome", e.target.value)}
                        placeholder="Ex: João Silva"
                        className="w-full rounded-xl border border-panel-line bg-white px-3 py-2 text-sm text-panel-ink outline-none focus:border-amber"
                      />
                    </div>

                    <div>
                      <label className="block text-xs font-medium text-panel-ink mb-1">
                        Telefone / WhatsApp
                      </label>
                      <input
                        type="tel"
                        value={linha.telefone}
                        onChange={(e) => atualizarLinha(linha.id, "telefone", e.target.value)}
                        placeholder="(11) 98888-7777"
                        className="w-full rounded-xl border border-panel-line bg-white px-3 py-2 text-sm text-panel-ink outline-none focus:border-amber"
                      />
                    </div>

                    <div>
                      <label className="block text-xs font-medium text-panel-ink mb-1">
                        Última visita
                      </label>
                      <input
                        type="text"
                        value={linha.data}
                        onChange={(e) => atualizarLinha(linha.id, "data", e.target.value)}
                        placeholder="Ex: 12/03/2026"
                        className="w-full rounded-xl border border-panel-line bg-white px-3 py-2 text-sm text-panel-ink outline-none focus:border-amber"
                      />
                    </div>

                    <div>
                      <label className="block text-xs font-medium text-panel-ink mb-1">
                        Valor
                      </label>
                      <input
                        type="text"
                        value={linha.valor}
                        onChange={(e) => atualizarLinha(linha.id, "valor", e.target.value)}
                        placeholder="Ex: R$ 50,00"
                        className="w-full rounded-xl border border-panel-line bg-white px-3 py-2 text-sm text-panel-ink outline-none focus:border-amber"
                      />
                    </div>
                  </div>
                </div>
              ))}
            </div>

            <button
              type="button"
              onClick={adicionarLinha}
              className="w-full rounded-xl border-2 border-dashed border-panel-line bg-white py-3 text-sm font-semibold text-panel-ink hover:border-amber hover:text-amber-deep transition flex items-center justify-center gap-2"
            >
              <span className="text-lg font-bold leading-none">+</span> Adicionar outro cliente
            </button>
          </div>
        ) : (
          /* MODO COLAR LISTA / PLANILHA */
          <div>
            <label className="block text-sm font-medium text-panel-ink">
              Cole a lista aqui
            </label>
            <textarea
              value={texto}
              onChange={(e) => {
                setTexto(e.target.value);
                setPrevia(null);
              }}
              rows={8}
              placeholder={EXEMPLO}
              className="mt-2 w-full rounded-xl border border-panel-line bg-panel-bg p-3 font-mono text-sm text-panel-ink outline-none focus:border-amber"
            />

            <div className="mt-3 flex flex-wrap items-center gap-3">
              <button
                type="button"
                onClick={() => {
                  setTexto(EXEMPLO);
                  setPrevia(null);
                }}
                className="rounded-lg border border-panel-line px-3 py-1.5 text-sm text-panel-sub transition hover:border-amber hover:text-amber-deep"
              >
                Preencher com exemplo de teste
              </button>
              <label className="cursor-pointer text-sm text-amber-deep underline">
                ou escolher um arquivo
                <input
                  type="file"
                  accept=".csv,.txt,.tsv,text/plain"
                  className="hidden"
                  onChange={(e) => lerArquivo(e.target.files?.[0])}
                />
              </label>
            </div>
            <p className="mt-2 text-xs text-panel-sub">
              Serve planilha, bloco de notas ou o arquivo que o WhatsApp gera quando você manda a
              conversa por e-mail. Se estiver no Excel, abre lá e cola aqui em cima.
            </p>
          </div>
        )}

        {modo === "colar" && (
          <div className="pt-2 border-t border-panel-line">
            <label className="block text-sm font-medium text-panel-ink">
              Seu nome no WhatsApp{" "}
              <span className="font-normal text-panel-sub">(só se colou uma conversa)</span>
            </label>
            <input
              value={meuNome}
              onChange={(e) => setMeuNome(e.target.value)}
              placeholder="Como você aparece na conversa"
              className="mt-2 w-full rounded-xl border border-panel-line bg-panel-bg p-3 text-sm text-panel-ink outline-none focus:border-amber"
            />
            <p className="mt-1 text-xs text-panel-sub">
              Serve para a gente não cadastrar você mesmo como cliente.
            </p>
          </div>
        )}

        <button
          onClick={() => enviar(true)}
          disabled={carregando || !temPeloMenosUmCliente}
          className="mt-3 rounded-xl bg-panel-ink px-6 py-3 text-sm font-semibold text-white transition hover:brightness-125 disabled:opacity-40"
        >
          {carregando ? "Lendo…" : "Ver o que vai entrar"}
        </button>
      </div>

      {erro && (
        <div className="rounded-2xl border border-red-200 bg-red-50 p-5 text-sm text-red-800">
          {erro}
        </div>
      )}

      {recusa && (
        <div className="rounded-2xl border border-amber/40 bg-amber/10 p-5">
          <p className="text-sm text-panel-ink">{recusa.motivo}</p>
          <Link
            href={recusa.acao.href}
            className="mt-3 inline-flex rounded-xl bg-amber px-5 py-3 text-sm font-semibold text-night transition hover:brightness-110"
          >
            {recusa.acao.texto}
          </Link>
        </div>
      )}

      {previa && (
        <div className="rounded-2xl border border-panel-line bg-panel-card p-6">
          <h2 className="font-display text-lg text-panel-ink">
            Ainda não salvei nada. Olha o que vai entrar:
          </h2>

          <ul className="mt-4 space-y-2 text-sm text-panel-ink">
            <li>
              <strong>{previa.criar}</strong> clientes novos
            </li>
            <li>
              <strong>{previa.atualizar}</strong> já estavam na sua lista
            </li>
            <li>
              <strong>{previa.visitasNovas}</strong> visitas novas
            </li>
            {previa.visitasDuplicadas > 0 && (
              <li className="text-panel-sub">
                {previa.visitasDuplicadas} visitas repetidas serão ignoradas
              </li>
            )}
            {previa.ignoradosPorOptOut > 0 && (
              <li className="text-panel-sub">
                {previa.ignoradosPorOptOut} pediram para não receber mensagem e ficam de fora
              </li>
            )}
            {previa.suprimidos > 0 && (
              <li className="text-panel-sub">
                {previa.suprimidos} pediram para ser apagados e não voltam nem se você mandar a
                mesma planilha de novo — é o pedido deles, não um erro da sua lista
              </li>
            )}
          </ul>

          {previa.aviso && (
            <p className="mt-4 rounded-xl bg-amber/20 p-3 text-sm text-[#7A5A10]">
              {previa.aviso}
            </p>
          )}

          {/* Falhar em silêncio é o que faz o dono descobrir o buraco depois de
              já ter confiado. Tudo que não deu para ler é dito aqui. */}
          {(previa.semTelefone.length > 0 || previa.linhasIgnoradas > 0) && (
            <div className="mt-4 rounded-xl border border-panel-line p-4">
              <p className="text-sm font-medium text-panel-ink">
                O que eu não consegui usar
              </p>
              {previa.semTelefone.length > 0 && (
                <p className="mt-2 text-sm text-panel-sub">
                  {previa.semTelefone.length} sem telefone —{" "}
                  {previa.semTelefone
                    .slice(0, 3)
                    .map((s) => s.nome)
                    .join(", ")}
                  {previa.semTelefone.length > 3 && " e outros"}. Sem telefone não dá para
                  mandar mensagem.
                </p>
              )}
              {previa.exemplosIgnorados.map((l) => (
                <p key={l.linha} className="mt-2 text-xs text-panel-sub">
                  Linha {l.linha}: {l.motivo}
                </p>
              ))}
            </div>
          )}

          {aindaEhOExemplo ? (
            <p className="mt-5 rounded-xl bg-amber/20 p-3 text-sm text-[#7A5A10]">
              <strong className="font-semibold">Esse ainda é o exemplo.</strong> Apaga e cola a
              sua lista de verdade — senão João Silva e Maria Souza entram como clientes seus e
              vão receber mensagem.
            </p>
          ) : (
            <>
              <label className="mt-5 flex items-start gap-2 text-sm text-panel-sub">
                <input
                  type="checkbox"
                  checked={confirmo}
                  onChange={(e) => setConfirmo(e.target.checked)}
                  className="mt-1"
                />
                <span>{DECLARACAO_BASE}</span>
              </label>

              <button
                onClick={() => enviar(false)}
                disabled={carregando || !confirmo || previa.criar + previa.visitasNovas === 0}
                className="mt-4 rounded-xl bg-amber px-5 py-3 text-sm font-semibold text-night transition hover:brightness-110 disabled:opacity-40"
              >
                {carregando ? "Salvando…" : "Salvar na minha lista"}
              </button>

              {previa.criar + previa.visitasNovas === 0 && (
                <p className="mt-2 text-sm text-panel-sub">
                  Não há nada novo nessa lista — tudo já estava com você.
                </p>
              )}
            </>
          )}
        </div>
      )}

      <SeusDados />
    </main>
  );
}

/**
 * OS DOIS DIREITOS QUE VIRAM BOTÃO.
 *
 * Os documentos jurídicos prometem exportação (art. 18, V) e eliminação
 * (art. 18, VI). Enquanto isso dependesse de mandar e-mail e alguém rodar SQL,
 * era intenção. Aqui é ação executável — Regra Zero: a tela termina em fazer,
 * não em saber.
 */
function SeusDados() {
  const [telefone, setTelefone] = useState("");
  const [confirmando, setConfirmando] = useState(false);
  const [apagando, setApagando] = useState(false);
  const [erro, setErro] = useState("");
  const [feito, setFeito] = useState<null | {
    visitasApagadas: number;
    entradasAnonimizadas: number;
    naoSeraRecontatado: boolean;
  }>(null);

  const excluir = async () => {
    setApagando(true);
    setErro("");
    try {
      const res = await fetch("/api/clientes/excluir", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ telefone, confirmo: true }),
      });
      const json = await res.json();
      if (!res.ok) {
        setErro(json.error ?? "Não consegui apagar esse cliente.");
        return;
      }
      setFeito(json);
      setTelefone("");
      setConfirmando(false);
    } catch {
      setErro("Não consegui falar com a internet agora. Tenta de novo?");
    } finally {
      setApagando(false);
    }
  };

  return (
    <section className="mt-12 rounded-2xl border border-panel-line bg-panel-card p-6">
      <h2 className="font-display text-lg font-semibold">Seus dados</h2>
      <p className="mt-1 text-sm text-panel-sub">
        A lista é sua. Levar embora e apagar são direitos seus e dos seus clientes — não
        precisa pedir para ninguém.
      </p>

      <div className="mt-6 border-t border-panel-line pt-5">
        <h3 className="text-sm font-semibold">Baixar tudo</h3>
        <p className="mt-1 text-sm text-panel-sub">
          Uma planilha com todos os clientes, quantas vezes vieram, quanto gastaram e quem
          pediu para não receber mensagem. Abre direto no Excel.
        </p>
        <a
          href="/api/dados/exportar"
          className="mt-3 inline-block rounded-xl border border-panel-line px-4 py-2.5 text-sm font-semibold transition hover:border-amber"
        >
          Baixar minha lista em planilha
        </a>
      </div>

      <div className="mt-6 border-t border-panel-line pt-5">
        <h3 className="text-sm font-semibold">Um cliente pediu para ser apagado</h3>
        <p className="mt-1 text-sm text-panel-sub">
          Digite o telefone dele. Apagamos o cadastro, as visitas e os horários futuros. O que
          ele já gastou continua em Dinheiro recuperado, sem o nome — é o seu faturamento, não o
          dado dele. Se ele já tinha pedido para parar, ele não volta nem se você mandar a
          mesma planilha de novo.
        </p>

        <div className="mt-3 flex flex-wrap gap-2">
          <label className="sr-only" htmlFor="telefone-para-apagar">
            Telefone do cliente que pediu para ser apagado
          </label>
          <input
            id="telefone-para-apagar"
            value={telefone}
            onChange={(e) => {
              setTelefone(e.target.value);
              setConfirmando(false);
              setFeito(null);
            }}
            placeholder="(11) 98888-7777"
            className="w-56 rounded-xl border border-panel-line bg-white px-3 py-2.5 text-sm outline-none focus:border-amber"
          />
          {!confirmando ? (
            <button
              onClick={() => setConfirmando(true)}
              disabled={telefone.trim().length < 8}
              className="rounded-xl border border-panel-line px-4 py-2.5 text-sm font-semibold transition hover:border-red-400 disabled:opacity-40"
            >
              Apagar esse cliente
            </button>
          ) : (
            // Dois cliques de propósito: apagar não tem desfazer, e o botão de
            // confirmar diz o que vai acontecer em vez de dizer "OK".
            <button
              onClick={excluir}
              disabled={apagando}
              className="rounded-xl bg-red-600 px-4 py-2.5 text-sm font-semibold text-white transition hover:brightness-110 disabled:opacity-40"
            >
              {apagando ? "Apagando…" : "Confirmo, apagar para sempre"}
            </button>
          )}
        </div>

        {erro && <p className="mt-3 text-sm text-red-600">{erro}</p>}

        {feito && (
          <div className="mt-4 rounded-xl border border-panel-line bg-panel-bg p-4 text-sm">
            <p className="font-semibold">Apagado.</p>
            <p className="mt-1 text-panel-sub">
              {feito.visitasApagadas} visitas removidas.{" "}
              {feito.entradasAnonimizadas > 0 &&
                "O que ele gastou continua somando no seu caixa, só que agora sem o nome dele. "}
              {feito.naoSeraRecontatado
                ? "Ele não será chamado de novo, mesmo que apareça numa lista que você mandar depois."
                : "Se ele aparecer numa lista que você mandar depois, entra como cliente novo."}
            </p>
          </div>
        )}
      </div>
    </section>
  );
}
