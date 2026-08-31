"use client";

import Link from "next/link";
import { useState } from "react";

/**
 * RESGATE DO CADERNO — a tela.
 *
 * A adoção de todo concorrente morre aqui: pede-se "um CSV com as colunas
 * certas", o dono não sabe exportar, e o produto acaba antes de começar. Então
 * a promessa desta tela é literal — manda do jeito que estiver.
 *
 * Duas passadas de propósito. Primeiro a Nexora mostra o que ENTRARIA, com o
 * que ela não conseguiu ler dito em português. Só depois o dono grava. Ver
 * antes é a diferença entre um erro corrigível e uma base contaminada, e é
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
  exemplosIgnorados: { linha: number; conteudo: string; motivo: string }[];
};

const EXEMPLO = `Nome, Telefone, Última visita, Valor
João Silva, (11) 98888-7777, 12/03/2026, R$ 50,00
Maria Souza, 11 97777-6666, 28/02/2026, R$ 120,00`;

export default function PaginaImportar() {
  const [texto, setTexto] = useState("");
  const [meuNome, setMeuNome] = useState("");
  const [confirmo, setConfirmo] = useState(false);
  const [carregando, setCarregando] = useState(false);
  const [erro, setErro] = useState("");
  const [previa, setPrevia] = useState<Resultado | null>(null);
  const [gravado, setGravado] = useState<Resultado | null>(null);

  const enviar = async (simular: boolean) => {
    setCarregando(true);
    setErro("");
    try {
      const res = await fetch("/api/clientes/importar", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ texto, meuNome: meuNome || undefined, simular, confirmo }),
      });
      const json = await res.json();
      if (!res.ok) {
        setErro(json.error ?? "Não consegui ler essa lista.");
        return;
      }
      if (simular) setPrevia(json);
      else setGravado(json);
    } catch {
      setErro("Falha de conexão. Tenta de novo?");
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
  // Gravado: a tela termina apontando para a ação que gera dinheiro, não num
  // "importação concluída" que deixa o dono sem próximo passo.
  // -------------------------------------------------------------------------
  if (gravado) {
    return (
      <main className="max-w-2xl space-y-5">
        <h1 className="font-display text-2xl text-panel-ink">Base atualizada</h1>
        <div className="rounded-2xl border border-panel-line bg-panel-card p-6">
          <p className="text-panel-ink">
            Entraram <strong>{gravado.criar}</strong> clientes novos e{" "}
            <strong>{gravado.visitasNovas}</strong> visitas. Sua base agora tem{" "}
            <strong>{gravado.baseTotalDepois}</strong> clientes.
          </p>
          {gravado.visitasDuplicadas > 0 && (
            <p className="mt-2 text-sm text-panel-sub">
              {gravado.visitasDuplicadas} visitas já estavam registradas e foram ignoradas —
              importar duas vezes não duplica nada.
            </p>
          )}
          <Link
            href="/painel/onda"
            className="mt-5 inline-flex rounded-xl bg-amber px-5 py-3 text-sm font-semibold text-night transition hover:brightness-110"
          >
            Ver quem sumiu da minha base
          </Link>
        </div>
      </main>
    );
  }

  return (
    <main className="max-w-2xl space-y-6">
      <header>
        <h1 className="font-display text-2xl text-panel-ink">Trazer minha base</h1>
        <p className="mt-1 text-sm text-panel-sub">
          Manda do jeito que estiver. Planilha torta, colagem do Excel, exportação de
          conversa do WhatsApp — a gente entende, e diz o que não conseguiu ler.
        </p>
      </header>

      <div className="rounded-2xl border border-panel-line bg-panel-card p-5">
        <label className="block text-sm font-medium text-panel-ink">
          Cole a lista aqui
        </label>
        <textarea
          value={texto}
          onChange={(e) => {
            setTexto(e.target.value);
            setPrevia(null);
          }}
          rows={10}
          placeholder={EXEMPLO}
          className="mt-2 w-full rounded-xl border border-panel-line bg-panel-bg p-3 font-mono text-sm text-panel-ink outline-none focus:border-amber"
        />

        <div className="mt-3 flex flex-wrap items-center gap-3">
          <label className="cursor-pointer text-sm text-amber-deep underline">
            ou escolher um arquivo
            <input
              type="file"
              accept=".csv,.txt,.tsv,text/plain"
              className="hidden"
              onChange={(e) => lerArquivo(e.target.files?.[0])}
            />
          </label>
          <span className="text-xs text-panel-sub">CSV, TXT ou a exportação do WhatsApp</span>
        </div>

        <label className="mt-4 block text-sm font-medium text-panel-ink">
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

        <button
          onClick={() => enviar(true)}
          disabled={carregando || texto.trim().length < 10}
          className="mt-5 rounded-xl bg-panel-ink px-5 py-3 text-sm font-semibold text-white transition hover:brightness-125 disabled:opacity-40"
        >
          {carregando ? "Lendo…" : "Ver o que vai entrar"}
        </button>
      </div>

      {erro && (
        <div className="rounded-2xl border border-red-200 bg-red-50 p-5 text-sm text-red-800">
          {erro}
        </div>
      )}

      {previa && (
        <div className="rounded-2xl border border-panel-line bg-panel-card p-6">
          <h2 className="font-display text-lg text-panel-ink">
            Nada foi gravado ainda. Confere:
          </h2>

          <ul className="mt-4 space-y-2 text-sm text-panel-ink">
            <li>
              <strong>{previa.criar}</strong> clientes novos
            </li>
            <li>
              <strong>{previa.atualizar}</strong> já estavam na sua base
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

          <label className="mt-5 flex items-start gap-2 text-sm text-panel-sub">
            <input
              type="checkbox"
              checked={confirmo}
              onChange={(e) => setConfirmo(e.target.checked)}
              className="mt-1"
            />
            <span>
              Confirmo que são clientes meus e que eu já tenho contato com eles. A Nexora
              trata esses dados por minha conta e eu posso apagar tudo quando quiser.
            </span>
          </label>

          <button
            onClick={() => enviar(false)}
            disabled={carregando || !confirmo || previa.criar + previa.visitasNovas === 0}
            className="mt-4 rounded-xl bg-amber px-5 py-3 text-sm font-semibold text-night transition hover:brightness-110 disabled:opacity-40"
          >
            {carregando ? "Gravando…" : "Gravar na minha base"}
          </button>

          {previa.criar + previa.visitasNovas === 0 && (
            <p className="mt-2 text-sm text-panel-sub">
              Não há nada novo nessa lista — tudo já estava na sua base.
            </p>
          )}
        </div>
      )}
    </main>
  );
}
