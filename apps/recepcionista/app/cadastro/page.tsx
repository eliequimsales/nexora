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

const FIELDS = [
  { key: "name", label: "Nome da empresa", type: "text", placeholder: "Ex.: Minha Empresa" },
  { key: "email", label: "E-mail", type: "email", placeholder: "voce@suaempresa.com" },
  { key: "password", label: "Senha (mín. 8 caracteres)", type: "password", placeholder: "••••••••" },
] as const;

export default function CadastroPage() {
  const router = useRouter();
  const [form, setForm] = useState({ name: "", email: "", password: "" });
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);
  const [aceite, setAceite] = useState(false);
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
      <div className="w-full max-w-sm">
        <Link href="/" className="mb-8 flex items-center justify-center gap-2">
          <span className="flex h-8 w-8 items-center justify-center rounded-lg bg-nx-gold text-base font-bold text-nx-bg">
            N
          </span>
          <span className="text-lg font-semibold">
            Nexora
          </span>
        </Link>
        <div className="rounded-2xl border border-nx-border bg-nx-surface p-7 sm:p-8 shadow-nx-panel">
          <h1 className="text-xl font-bold">Criar conta da empresa</h1>
          <p className="mb-4 mt-1 text-sm text-nx-secondary">
            Ative seu Atendente 24h no WhatsApp. Sem cartão para começar.
          </p>

          <div className="mb-5 grid grid-cols-3 gap-2 text-center text-[11px] font-medium text-nx-secondary">
            <div className="rounded-lg border border-nx-border bg-nx-surface-2 py-1.5 px-2">⚡ Leva 30 seg</div>
            <div className="rounded-lg border border-nx-border bg-nx-surface-2 py-1.5 px-2">🔒 Sem cartão</div>
            <div className="rounded-lg border border-nx-border bg-nx-surface-2 py-1.5 px-2">📱 No WhatsApp</div>
          </div>

          <GoogleButton label="Cadastrar com o Google em 1 clique" />

          <div className="my-5 flex items-center gap-3">
            <span className="h-px flex-1 bg-nx-border" />
            <span className="text-xs text-nx-muted">ou preencha com seu e-mail</span>
            <span className="h-px flex-1 bg-nx-border" />
          </div>

          <form onSubmit={handleSubmit} className="space-y-4">
            {FIELDS.map((field) => (
              <div key={field.key}>
                <label htmlFor={field.key} className="mb-1 block text-sm font-medium">
                  {field.label}
                </label>
                <input
                  id={field.key}
                  type={field.type}
                  required
                  placeholder={field.placeholder}
                  value={form[field.key]}
                  onFocus={aoFocarCampo}
                  onChange={(e) => setForm({ ...form, [field.key]: e.target.value })}
                  className="w-full rounded-lg border border-nx-border bg-nx-surface-2 px-3 py-2.5 placeholder:text-nx-muted text-sm text-nx-primary outline-none focus:border-nx-gold/60 focus:ring-2 focus:ring-nx-gold/15"
                />
              </div>
            ))}
            {/*
              Aceite explícito, sem marcação prévia. Checkbox já marcado não é
              consentimento — é armadilha, e o CDC trata cláusula assim como não
              escrita. A data e a versão do texto ficam gravadas no cadastro.
            */}
            <label className={`flex gap-3 rounded-lg border p-2.5 text-sm leading-relaxed transition-colors ${
              !aceite && error ? "border-nx-gold/60 bg-nx-gold/5 text-nx-primary" : "border-transparent text-nx-secondary"
            }`}>
              <input
                type="checkbox"
                checked={aceite}
                onChange={(e) => setAceite(e.target.checked)}
                className="mt-1 accent-nx-gold"
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
            {error && <p className="text-sm text-nx-error">{error}</p>}
            <button
              type="submit"
              disabled={loading}
              className="w-full rounded-lg bg-nx-gold shadow-nx-glow-sm px-4 py-3 text-sm font-semibold text-nx-bg transition hover:bg-nx-gold/90 active:scale-[0.98] disabled:opacity-60"
            >
              {loading ? "Criando conta..." : "Criar minha conta"}
            </button>
            <p className="text-center text-xs leading-relaxed text-nx-muted">
              Entrar com o Google também confirma o aceite dos Termos de Uso e Política de Privacidade.
            </p>
          </form>
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
