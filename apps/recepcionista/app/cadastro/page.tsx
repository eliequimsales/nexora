"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useRef, useState } from "react";
import { GoogleButton } from "@/components/google-button";
import {
  trackStartRegistration,
  trackCompleteRegistration,
} from "@/lib/analytics/pixel";

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

  function aoFocarCampo() {
    if (jaIniciou.current) return;
    jaIniciou.current = true;
    trackStartRegistration();
  }

  async function handleSubmit(event: React.FormEvent) {
    event.preventDefault();
    setError("");
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
      router.push("/painel/clientes/importar");
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
        <div className="rounded-2xl border border-nx-border bg-nx-surface p-8 shadow-nx-panel">
          <h1 className="text-xl font-bold">Criar conta da empresa</h1>
          <p className="mb-6 mt-1 text-sm text-nx-secondary">
            Sem cartão. Você importa sua lista e vê quem sumiu logo depois.
          </p>
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
            <label className="flex gap-3 text-sm leading-relaxed text-nx-secondary">
              <input
                type="checkbox"
                checked={aceite}
                onChange={(e) => setAceite(e.target.checked)}
                className="mt-1"
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
              disabled={loading || !aceite}
              className="w-full rounded-lg bg-nx-gold shadow-nx-glow-sm px-4 py-3 text-sm font-semibold text-nx-bg transition hover:bg-nx-gold/90 active:scale-[0.98] disabled:opacity-60"
            >
              {loading ? "Criando conta..." : "Criar minha conta"}
            </button>
            <div className="flex items-center gap-3 py-1">
              <span className="h-px flex-1 bg-nx-border" />
              <span className="text-xs text-nx-secondary">ou</span>
              <span className="h-px flex-1 bg-nx-border" />
            </div>
            <GoogleButton label="Cadastrar com o Google" />
            <p className="text-center text-xs leading-relaxed text-nx-secondary">
              Entrar com o Google também significa aceitar os Termos de Uso, a Política de
              Privacidade e o Contrato de Operador.
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
