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
      const res = await fetch("/api/auth/signup", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ ...form, aceite }),
      });
      const data = await res.json();
      if (!res.ok) {
        setError(data.error ?? "Erro ao criar conta");
        return;
      }
      trackCompleteRegistration("email");
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

          {/* BENEFÍCIOS RÁPIDOS */}
          <div className="mb-5 grid grid-cols-3 gap-2 text-center text-[11px] font-medium text-nx-secondary">
            <div className="rounded-lg border border-nx-border bg-nx-surface-2 py-1.5 px-2">⚡ Leva 30 seg</div>
            <div className="rounded-lg border border-nx-border bg-nx-surface-2 py-1.5 px-2">🔒 Sem cartão</div>
            <div className="rounded-lg border border-nx-border bg-nx-surface-2 py-1.5 px-2">📱 No seu celular</div>
          </div>

          {/* REASSURANCE: CONEXÃO NO CELULAR SEM CÂMERA */}
          <div className="mb-5 rounded-xl border border-emerald-500/30 bg-emerald-500/10 p-3 text-[11px] sm:text-xs text-emerald-300 leading-relaxed">
            <p className="flex items-center gap-1.5 font-semibold text-emerald-400">
              <span>✓</span> Funciona 100% no seu smartphone
            </p>
            <p className="mt-0.5 text-emerald-300/90">
              Você conecta seu WhatsApp digitando um código seguro de 8 dígitos, sem precisar de câmera nem de outro aparelho.
            </p>
          </div>

          {/* GOOGLE BUTTON EM DESTAQUE (MODO 1-CLIQUE SEM ATRITO) */}
          <div className="rounded-xl border border-nx-gold/40 bg-nx-gold/10 p-3.5 text-center">
            <p className="text-[11px] font-bold uppercase tracking-wider text-nx-gold">
              ⚡ Mais Rápido • 1 Clique
            </p>
            <p className="mt-0.5 mb-2.5 text-[11px] text-nx-secondary">
              Entre direto com o Google sem precisar inventar senha
            </p>
            <GoogleButton label="Cadastrar com o Google" />
          </div>

          <div className="my-5 flex items-center gap-3">
            <span className="h-px flex-1 bg-nx-border" />
            <span className="text-xs text-nx-muted">ou crie com seu e-mail</span>
            <span className="h-px flex-1 bg-nx-border" />
          </div>

          <form onSubmit={handleSubmit} className="space-y-3.5">
            <div>
              <label htmlFor="company-name" className="mb-1 block text-xs font-semibold text-nx-primary">
                Nome da sua empresa
              </label>
              <input
                id="company-name"
                type="text"
                required
                autoComplete="organization"
                placeholder="Ex.: Clínica Renove, Barbearia Silva..."
                value={form.name}
                onFocus={aoFocarCampo}
                onChange={(e) => setForm({ ...form, name: e.target.value })}
                className="w-full rounded-lg border border-nx-border bg-nx-surface-2 px-3 py-2.5 placeholder:text-nx-muted text-sm text-nx-primary outline-none focus:border-nx-gold/60 focus:ring-2 focus:ring-nx-gold/15"
              />
            </div>

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
              {loading ? "Criando conta..." : "Criar minha conta grátis →"}
            </button>
          </form>

          {/* ALTERNATIVAS PARA QUEM QUER TESTAR ANTES DE CADASTRAR */}
          <div className="mt-6 rounded-xl border border-nx-gold/30 bg-nx-gold/5 p-4 text-center">
            <p className="text-xs font-semibold text-nx-primary">
              Prefere ver funcionando antes de criar conta?
            </p>
            <p className="mt-1 text-[11px] text-nx-secondary">
              Experimente a IA respondendo em tempo real no simulador ou fale direto no WhatsApp.
            </p>
            <div className="mt-3 flex flex-col sm:flex-row items-center justify-center gap-2">
              <Link
                href="/#simulador"
                className="w-full sm:w-auto inline-flex items-center justify-center gap-1.5 rounded-lg border border-nx-border bg-nx-surface px-3 py-2 text-xs font-semibold text-nx-primary hover:border-nx-gold/40"
              >
                💬 Ver no Simulador ao Vivo →
              </Link>
              <a
                href="https://wa.me/5521979435139?text=Oi!%20Quero%20ver%20o%20Atendente%20Virtual%20da%20Nexora%20funcionando%20agora."
                target="_blank"
                rel="noopener noreferrer"
                className="w-full sm:w-auto inline-flex items-center justify-center gap-1.5 rounded-lg bg-nx-gold px-3.5 py-2 text-xs font-bold text-nx-bg shadow-nx-glow-sm hover:bg-nx-gold/90"
              >
                📱 Testar no WhatsApp ↗
              </a>
            </div>
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
