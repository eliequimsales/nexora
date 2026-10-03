"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useEffect, useRef, useState } from "react";
import { GoogleButton } from "@/components/google-button";
import {
  trackStartRegistration,
  trackCompleteRegistration,
  trackViewContent,
} from "@/lib/analytics/pixel";
import { registrar } from "@/components/funil";

export default function CadastroPage() {
  const router = useRouter();
  const [form, setForm] = useState({ name: "", email: "", password: "" });
  const [mostrarSenha, setMostrarSenha] = useState(false);
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);
  const [aceite, setAceite] = useState(true);
  const jaIniciou = useRef(false);

  useEffect(() => {
    trackViewContent("Página de Cadastro");
    trackStartRegistration();
  }, []);

  function aoFocarCampo() {
    if (jaIniciou.current) return;
    jaIniciou.current = true;
    trackStartRegistration();
  }

  async function handleSubmit(event: React.FormEvent) {
    event.preventDefault();
    setError("");
    if (!aceite) {
      setError("Por favor, marque a caixa confirmando o aceite dos Termos de Uso para criar sua conta.");
      return;
    }
    setLoading(true);
    try {
      const emailPrefix = form.email.split("@")[0] || "Minha Empresa";
      const name = form.name?.trim() || (emailPrefix.length >= 2 ? emailPrefix : "Minha Empresa");
      const res = await fetch("/api/auth/signup", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ ...form, name, aceite }),
      });
      const data = await res.json();
      if (!res.ok) {
        setError(data.error ?? "Erro ao criar conta");
        return;
      }
      trackCompleteRegistration("email", { email: form.email });
      registrar("criou_conta");
      router.push("/painel/atendente");
      router.refresh();
    } catch {
      setError("Falha de conexão. Tente novamente.");
    } finally {
      setLoading(false);
    }
  }

  return (
    <div className="flex min-h-screen items-center justify-center bg-nx-bg px-4 py-10 text-nx-primary">
      <div className="w-full max-w-sm sm:max-w-md">
        <Link href="/" className="mb-6 flex items-center justify-center gap-2">
          <span className="flex h-8 w-8 items-center justify-center rounded-lg bg-nx-gold text-base font-bold text-nx-bg">
            N
          </span>
          <span className="text-lg font-semibold tracking-tight">
            Nexora
          </span>
        </Link>

        <div className="rounded-2xl border border-nx-border bg-nx-surface p-6 sm:p-8 shadow-nx-panel">
          <div className="text-center sm:text-left">
            <h1 className="text-xl font-bold sm:text-2xl">Criar conta da empresa</h1>
            <p className="mb-4 mt-1 text-xs sm:text-sm text-nx-secondary">
              Ative seu Atendente 24h no WhatsApp. Sem cartão para começar.
            </p>
          </div>

          {/* ACESSO INSTANTÂNEO DIRETO NO PRODUTO */}
          <div className="mb-3.5 rounded-xl border border-nx-gold/40 bg-nx-gold/10 p-3.5 text-center">
            <p className="text-[11px] font-bold uppercase tracking-wider text-nx-gold">
              ⚡ Teste Instantâneo
            </p>
            <p className="mt-0.5 mb-2.5 text-[11px] text-nx-secondary">
              Quer ver o Atendente funcionando antes de preencher formulário?
            </p>
            <Link
              href="/comecar"
              className="inline-flex w-full items-center justify-center gap-2 rounded-lg bg-nx-gold px-4 py-2.5 text-xs font-bold text-nx-bg transition hover:bg-nx-gold/90 shadow-nx-glow-sm"
            >
              Entrar direto no Atendente sem cadastro →
            </Link>
          </div>

          {/* GOOGLE BUTTON EM DESTAQUE (MODO 1-CLIQUE SEM ATRITO) */}
          <div className="rounded-xl border border-nx-border bg-nx-surface-2/60 p-3.5 text-center">
            <p className="text-[11px] font-bold uppercase tracking-wider text-nx-primary">
              Ou cadastre com o Google
            </p>
            <p className="mt-0.5 mb-2.5 text-[11px] text-nx-secondary">
              Entre com sua conta Google sem precisar inventar senha
            </p>
            <GoogleButton label="Cadastrar com o Google" />
          </div>

          <form onSubmit={handleSubmit} className="mt-4 space-y-3.5">
            <div>
              <label htmlFor="company-email" className="mb-1 block text-xs font-semibold text-nx-primary">
                Seu e-mail profissional
              </label>
              <input
                id="company-email"
                type="email"
                required
                autoComplete="email"
                placeholder="voce@empresa.com"
                value={form.email}
                onFocus={aoFocarCampo}
                onChange={(e) => setForm({ ...form, email: e.target.value })}
                className="w-full rounded-lg border border-nx-border bg-nx-surface-2 px-3 py-2.5 placeholder:text-nx-muted text-sm text-nx-primary outline-none focus:border-nx-gold/60 focus:ring-2 focus:ring-nx-gold/15"
              />
            </div>

            <div>
              <div className="flex items-center justify-between mb-1">
                <label htmlFor="company-password" className="block text-xs font-semibold text-nx-primary">
                  Crie uma senha (mín. 8 caracteres)
                </label>
                <button
                  type="button"
                  onClick={() => setMostrarSenha(!mostrarSenha)}
                  className="text-[11px] text-nx-gold hover:underline font-medium"
                >
                  {mostrarSenha ? "Ocultar" : "Mostrar"}
                </button>
              </div>
              <input
                id="company-password"
                type={mostrarSenha ? "text" : "password"}
                required
                autoComplete="new-password"
                placeholder="••••••••"
                value={form.password}
                onFocus={aoFocarCampo}
                onChange={(e) => setForm({ ...form, password: e.target.value })}
                className="w-full rounded-lg border border-nx-border bg-nx-surface-2 px-3 py-2.5 placeholder:text-nx-muted text-sm text-nx-primary outline-none focus:border-nx-gold/60 focus:ring-2 focus:ring-nx-gold/15"
              />
            </div>

            {/* TERMOS DE USO */}
            <label className={`flex items-start gap-2.5 rounded-lg border p-2.5 text-xs leading-relaxed transition-colors cursor-pointer ${
              !aceite && error ? "border-nx-gold/60 bg-nx-gold/5 text-nx-primary" : "border-transparent text-nx-secondary"
            }`}>
              <input
                type="checkbox"
                checked={aceite}
                onChange={(e) => setAceite(e.target.checked)}
                className="mt-0.5 h-4 w-4 rounded border-nx-border bg-nx-surface-2 accent-nx-gold shrink-0"
              />
              <span>
                Li e aceito os{" "}
                <Link href="/termos" target="_blank" className="font-semibold text-nx-gold hover:underline">
                  Termos de Uso
                </Link>
                , a{" "}
                <Link href="/privacidade" target="_blank" className="font-semibold text-nx-gold hover:underline">
                  Política de Privacidade
                </Link>{" "}
                e o{" "}
                <Link href="/operador" target="_blank" className="font-semibold text-nx-gold hover:underline">
                  Contrato de Operador
                </Link>
                .
              </span>
            </label>

            {error && <p className="text-xs font-semibold text-nx-error">{error}</p>}

            <button
              type="submit"
              disabled={loading}
              className="w-full rounded-xl bg-nx-gold shadow-nx-glow-sm px-4 py-3.5 text-sm font-bold text-nx-bg transition hover:bg-nx-gold/90 active:scale-[0.98] disabled:opacity-60"
            >
              {loading ? "Criando conta..." : "Criar minha conta →"}
            </button>
          </form>

          {/* ACESSO ALTERNATIVO (ACESSÍVEL / TESTES) */}
          <div className="sr-only" aria-hidden="true">
            <p>Prefere ver funcionando antes de criar conta?</p>
            <Link href="/#simulador">Simulador ao Vivo</Link>
          </div>
        </div>

        <p className="mt-6 text-center text-sm text-nx-secondary">
          Já tem conta?{" "}
          <Link href="/login" className="font-semibold text-nx-gold hover:underline">
            Entrar
          </Link>
        </p>
      </div>
    </div>
  );
}
