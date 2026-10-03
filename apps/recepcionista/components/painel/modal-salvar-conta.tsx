"use client";

import { useEffect, useState } from "react";

export function ModalSalvarConta({
  aberto,
  aoFechar,
  aoSalvarSucesso,
  nomePadrao = "",
}: {
  aberto: boolean;
  aoFechar: () => void;
  aoSalvarSucesso: (email: string) => void;
  nomePadrao?: string;
}) {
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [nome, setNome] = useState(nomePadrao);
  const [mostrarSenha, setMostrarSenha] = useState(false);
  const [carregando, setCarregando] = useState(false);
  const [erro, setErro] = useState("");
  const [sucesso, setSucesso] = useState(false);

  useEffect(() => {
    if (aberto) {
      setErro("");
      setSucesso(false);
      setNome(nomePadrao);
    }
  }, [aberto, nomePadrao]);

  useEffect(() => {
    function aoTeclar(e: KeyboardEvent) {
      if (e.key === "Escape" && aberto) aoFechar();
    }
    window.addEventListener("keydown", aoTeclar);
    return () => window.removeEventListener("keydown", aoTeclar);
  }, [aberto, aoFechar]);

  if (!aberto) return null;

  async function submeter(e: React.FormEvent) {
    e.preventDefault();
    setErro("");
    setCarregando(true);
    try {
      const res = await fetch("/api/auth/salvar-conta", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ email, password, name: nome || undefined }),
      });
      const data = await res.json().catch(() => null);
      if (!res.ok || !data?.ok) {
        setErro(data?.error ?? "Não foi possível salvar agora. Tente novamente.");
        return;
      }
      setSucesso(true);
      aoSalvarSucesso(email);
      setTimeout(() => {
        aoFechar();
      }, 1200);
    } catch {
      setErro("Falha de conexão. Tente novamente.");
    } finally {
      setCarregando(false);
    }
  }

  return (
    <div
      role="dialog"
      aria-modal="true"
      className="fixed inset-0 z-50 flex items-center justify-center bg-black/70 p-4 backdrop-blur-sm"
      onClick={aoFechar}
    >
      <div
        className="w-full max-w-md rounded-2xl border border-panel-line bg-panel-card p-6 shadow-2xl"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="flex items-start justify-between">
          <div>
            <h2 className="text-lg font-bold text-panel-ink">Salvar meu acesso</h2>
            <p className="mt-1 text-xs text-panel-sub">
              Defina seu e-mail e senha para acessar de qualquer computador ou celular.
            </p>
          </div>
          <button
            type="button"
            onClick={aoFechar}
            className="rounded-lg p-1 text-panel-sub hover:bg-neutral-100 hover:text-panel-ink"
            aria-label="Fechar modal"
          >
            ✕
          </button>
        </div>

        {sucesso ? (
          <div className="my-6 rounded-xl border border-emerald-200 bg-emerald-50 p-4 text-center">
            <p className="text-sm font-bold text-emerald-800">Acesso salvo com sucesso!</p>
            <p className="mt-1 text-xs text-panel-sub">
              Você já pode entrar com este e-mail e senha quando quiser.
            </p>
          </div>
        ) : (
          <form onSubmit={submeter} className="mt-5 space-y-3.5">
            <div>
              <label htmlFor="salvar-email" className="mb-1 block text-xs font-semibold text-panel-ink">
                Seu e-mail profissional
              </label>
              <input
                id="salvar-email"
                type="email"
                required
                placeholder="voce@empresa.com"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                className="w-full rounded-lg border border-panel-line bg-white px-3 py-2 text-sm text-panel-ink outline-none focus:border-amber focus:ring-1 focus:ring-amber"
              />
            </div>

            <div>
              <div className="mb-1 flex items-center justify-between">
                <label htmlFor="salvar-senha" className="block text-xs font-semibold text-panel-ink">
                  Crie uma senha (mínimo 8 caracteres)
                </label>
                <button
                  type="button"
                  onClick={() => setMostrarSenha(!mostrarSenha)}
                  className="text-[11px] font-medium text-amber hover:underline"
                >
                  {mostrarSenha ? "Ocultar" : "Mostrar"}
                </button>
              </div>
              <input
                id="salvar-senha"
                type={mostrarSenha ? "text" : "password"}
                required
                minLength={8}
                placeholder="••••••••"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                className="w-full rounded-lg border border-panel-line bg-white px-3 py-2 text-sm text-panel-ink outline-none focus:border-amber focus:ring-1 focus:ring-amber"
              />
            </div>

            <div>
              <label htmlFor="salvar-nome" className="mb-1 block text-xs font-semibold text-panel-ink">
                Nome da empresa (opcional)
              </label>
              <input
                id="salvar-nome"
                type="text"
                placeholder="Nome da sua clínica ou negócio"
                value={nome}
                onChange={(e) => setNome(e.target.value)}
                className="w-full rounded-lg border border-panel-line bg-white px-3 py-2 text-sm text-panel-ink outline-none focus:border-amber focus:ring-1 focus:ring-amber"
              />
            </div>

            {erro && <p role="alert" className="text-xs font-medium text-red-600">{erro}</p>}

            <div className="mt-5 flex gap-2 pt-2">
              <button
                type="button"
                onClick={aoFechar}
                className="flex-1 rounded-xl border border-panel-line bg-neutral-50 px-4 py-2.5 text-xs font-semibold text-panel-sub hover:bg-neutral-100"
              >
                Continuar testando
              </button>
              <button
                type="submit"
                disabled={carregando}
                className="flex-1 rounded-xl bg-amber px-4 py-2.5 text-xs font-bold text-night shadow-sm hover:brightness-110 disabled:opacity-60"
              >
                {carregando ? "Salvando..." : "Salvar agora"}
              </button>
            </div>
          </form>
        )}
      </div>
    </div>
  );
}
