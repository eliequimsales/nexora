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
  const erro = searchParams.get("erro");
  const [error, setError] = useState(
    erro === "google"
      ? "Não foi possível entrar com o Google. Tente novamente ou use e-mail e senha."
      : erro === "google-vinculo"
      ? "Não foi possível vincular sua conta Google. Tente novamente ou use e-mail e senha."
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
      // Só aceita caminho interno. A checagem anterior era startsWith("/") e
      // !startsWith("//") — furada por "/\evil.com": passa nas duas, e o
      // navegador normaliza a barra invertida para "//", virando URL
      // protocolo-relativa e saindo do domínio. A lista de permitidos abaixo
      // troca "recusa o que eu lembrei de proibir" por "só aceita o que eu
      // reconheço", que é a única forma que não envelhece mal.
      const next = searchParams.get("next");
      const target =
        next &&
        /^\/[A-Za-z0-9\-._~/]*$/.test(next)
          ? next
          : "/painel/clientes/importar";
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
          className="w-full rounded-lg border border-nx-border bg-nx-surface-2 px-3 py-2.5 placeholder:text-nx-muted text-sm text-nx-primary outline-none focus:border-nx-gold/60 focus:ring-2 focus:ring-nx-gold/15"
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
          className="w-full rounded-lg border border-nx-border bg-nx-surface-2 px-3 py-2.5 placeholder:text-nx-muted text-sm text-nx-primary outline-none focus:border-nx-gold/60 focus:ring-2 focus:ring-nx-gold/15"
        />
      </div>
      {error && <p className="text-sm text-nx-error">{error}</p>}
      <button
        type="submit"
        disabled={loading}
        className="w-full rounded-lg bg-nx-gold shadow-nx-glow-sm px-4 py-3 text-sm font-semibold text-nx-bg transition hover:bg-nx-gold/90 active:scale-[0.98] disabled:opacity-60"
      >
        {loading ? "Entrando..." : "Entrar"}
      </button>
      <Link
        href="/recuperar"
        className="block text-center text-sm text-nx-secondary hover:text-nx-primary"
      >
        Esqueci minha senha
      </Link>
      <div className="flex items-center gap-3 py-1">
        <span className="h-px flex-1 bg-nx-border" />
        <span className="text-xs text-nx-secondary">ou</span>
        <span className="h-px flex-1 bg-nx-border" />
      </div>
      <GoogleButton label="Entrar com o Google" />
    </form>
  );
}

export default function LoginPage() {
  return (
    <div className="flex min-h-screen items-center justify-center bg-nx-bg px-4 text-nx-primary">
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
          <h1 className="mb-6 text-xl font-bold">Entrar na sua conta</h1>
          <Suspense>
            <LoginForm />
          </Suspense>
        </div>
        <p className="mt-6 text-center text-sm text-nx-secondary">
          Ainda não tem conta?{" "}
          <Link href="/cadastro" className="font-semibold text-nx-gold hover:underline">
            Criar conta grátis
          </Link>
        </p>
      </div>
    </div>
  );
}
