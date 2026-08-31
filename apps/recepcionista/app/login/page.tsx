"use client";

import Link from "next/link";
import { useRouter, useSearchParams } from "next/navigation";
import { Suspense, useState } from "react";
import { GoogleButton } from "@/components/google-button";

function LoginForm() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState(
    searchParams.get("erro") === "google"
      ? "Não foi possível entrar com o Google. Tente novamente ou use e-mail e senha."
      : "",
  );
  const [loading, setLoading] = useState(false);

  async function handleSubmit(event: React.FormEvent) {
    event.preventDefault();
    setError("");
    setLoading(true);
    try {
      const res = await fetch("/api/auth/login", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ email, password }),
      });
      const data = await res.json();
      if (!res.ok) {
        setError(data.error ?? "Erro ao entrar");
        return;
      }
      // Só aceita caminhos internos — evita open redirect via ?next=
      const next = searchParams.get("next");
      const target = next && next.startsWith("/") && !next.startsWith("//") ? next : "/painel";
      router.push(target);
      router.refresh();
    } catch {
      setError("Falha de conexão. Tente novamente.");
    } finally {
      setLoading(false);
    }
  }

  return (
    <form onSubmit={handleSubmit} className="space-y-4">
      <div>
        <label htmlFor="email" className="mb-1 block text-sm font-medium">
          E-mail
        </label>
        <input
          id="email"
          type="email"
          required
          value={email}
          onChange={(e) => setEmail(e.target.value)}
          className="w-full rounded-lg border border-panel-line bg-white px-3 py-2.5 text-sm text-panel-ink outline-none focus:border-amber"
        />
      </div>
      <div>
        <label htmlFor="password" className="mb-1 block text-sm font-medium">
          Senha
        </label>
        <input
          id="password"
          type="password"
          required
          value={password}
          onChange={(e) => setPassword(e.target.value)}
          className="w-full rounded-lg border border-panel-line bg-white px-3 py-2.5 text-sm text-panel-ink outline-none focus:border-amber"
        />
      </div>
      {error && <p className="text-sm text-red-600">{error}</p>}
      <button
        type="submit"
        disabled={loading}
        className="w-full rounded-lg bg-amber px-4 py-3 text-sm font-semibold text-night transition hover:brightness-110 disabled:opacity-60"
      >
        {loading ? "Entrando..." : "Entrar"}
      </button>
      <Link
        href="/recuperar"
        className="block text-center text-sm text-panel-sub hover:text-panel-ink"
      >
        Esqueci minha senha
      </Link>
      <div className="flex items-center gap-3 py-1">
        <span className="h-px flex-1 bg-panel-line" />
        <span className="text-xs text-panel-sub">ou</span>
        <span className="h-px flex-1 bg-panel-line" />
      </div>
      <GoogleButton label="Entrar com o Google" />
    </form>
  );
}

export default function LoginPage() {
  return (
    <div className="flex min-h-screen items-center justify-center bg-panel-bg px-4 text-panel-ink">
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
          <h1 className="mb-6 font-display text-xl font-bold">Entrar na sua conta</h1>
          <Suspense>
            <LoginForm />
          </Suspense>
        </div>
        <p className="mt-6 text-center text-sm text-panel-sub">
          Ainda não tem conta?{" "}
          <Link href="/cadastro" className="font-semibold text-amber-deep hover:underline">
            Criar conta grátis
          </Link>
        </p>
      </div>
    </div>
  );
}
