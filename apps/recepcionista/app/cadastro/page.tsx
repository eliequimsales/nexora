"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useState } from "react";
import { GoogleButton } from "@/components/google-button";

const FIELDS = [
  { key: "name", label: "Nome da empresa", type: "text", placeholder: "Ex.: Minha Empresa" },
  { key: "email", label: "E-mail", type: "email", placeholder: "voce@suaempresa.com" },
  { key: "phone", label: "Telefone (com DDD)", type: "tel", placeholder: "11999998888" },
  { key: "password", label: "Senha (mín. 8 caracteres)", type: "password", placeholder: "••••••••" },
] as const;

export default function CadastroPage() {
  const router = useRouter();
  const [form, setForm] = useState({ name: "", email: "", phone: "", password: "" });
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);

  async function handleSubmit(event: React.FormEvent) {
    event.preventDefault();
    setError("");
    setLoading(true);
    try {
      const res = await fetch("/api/auth/signup", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(form),
      });
      const data = await res.json();
      if (!res.ok) {
        setError(data.error ?? "Erro ao criar conta");
        return;
      }
      router.push("/painel/configuracoes");
      router.refresh();
    } catch {
      setError("Falha de conexão. Tente novamente.");
    } finally {
      setLoading(false);
    }
  }

  return (
    <div className="flex min-h-screen items-center justify-center bg-panel-bg px-4 py-10 text-panel-ink">
      <div className="w-full max-w-sm">
        <Link href="/" className="mb-8 flex items-center justify-center gap-2">
          <span className="flex h-8 w-8 items-center justify-center rounded-lg bg-amber font-display text-base font-bold text-night">
            N
          </span>
          <span className="font-display text-lg font-semibold">
            Nexora
          </span>
        </Link>
        <div className="rounded-2xl border border-panel-line bg-panel-card p-8 shadow-sm">
          <h1 className="font-display text-xl font-bold">Criar conta da empresa</h1>
          <p className="mb-6 mt-1 text-sm text-panel-sub">
            Em poucos minutos seu Atendente estará no ar.
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
                  onChange={(e) => setForm({ ...form, [field.key]: e.target.value })}
                  className="w-full rounded-lg border border-panel-line bg-white px-3 py-2.5 text-sm text-panel-ink outline-none focus:border-amber"
                />
              </div>
            ))}
            {error && <p className="text-sm text-red-600">{error}</p>}
            <button
              type="submit"
              disabled={loading}
              className="w-full rounded-lg bg-amber px-4 py-3 text-sm font-semibold text-night transition hover:brightness-110 disabled:opacity-60"
            >
              {loading ? "Criando conta..." : "Criar meu Atendente"}
            </button>
            <div className="flex items-center gap-3 py-1">
              <span className="h-px flex-1 bg-panel-line" />
              <span className="text-xs text-panel-sub">ou</span>
              <span className="h-px flex-1 bg-panel-line" />
            </div>
            <GoogleButton label="Cadastrar com o Google" />
          </form>
        </div>
        <p className="mt-6 text-center text-sm text-panel-sub">
          Já tem conta?{" "}
          <Link href="/login" className="font-semibold text-amber-deep hover:underline">
            Entrar
          </Link>
        </p>
      </div>
    </div>
  );
}
