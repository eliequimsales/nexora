"use client";

import Link from "next/link";
import { useState } from "react";

export default function PaginaRecuperar() {
  const [email, setEmail] = useState("");
  const [estado, setEstado] = useState<"pronto" | "enviando" | "enviado">("pronto");
  const [erro, setErro] = useState("");

  const enviar = async () => {
    setEstado("enviando");
    setErro("");
    try {
      const res = await fetch("/api/auth/recuperar", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ email }),
      });
      const json = await res.json();
      if (!res.ok) {
        setErro(json.error ?? "Não consegui enviar agora.");
        setEstado("pronto");
        return;
      }
      setEstado("enviado");
    } catch {
      setErro("Falha de conexão. Tenta de novo?");
      setEstado("pronto");
    }
  };

  return (
    <main className="mx-auto flex min-h-screen max-w-md flex-col justify-center px-6 py-16">
      <div className="rounded-2xl border border-night-line bg-night-soft p-8">
        <Link href="/" className="flex items-center gap-2.5">
          <span className="flex h-9 w-9 items-center justify-center rounded-lg bg-amber font-display text-lg font-bold text-night">
            N
          </span>
          <span className="font-display font-semibold text-mist">Nexora</span>
        </Link>

        {estado === "enviado" ? (
          <>
            <h1 className="mt-7 font-display text-2xl text-mist">Link enviado</h1>
            <p className="mt-3 text-sm leading-relaxed text-mist/70">
              Se existir uma conta com esse e-mail, o link de redefinição já está a caminho.
              Ele vale por 1 hora e só pode ser usado uma vez.
            </p>
            <p className="mt-3 text-sm text-mist/50">
              Não chegou em alguns minutos? Confere a caixa de spam.
            </p>
            <Link
              href="/login"
              className="mt-7 inline-block text-sm text-amber underline underline-offset-4"
            >
              Voltar para o login
            </Link>
          </>
        ) : (
          <>
            <h1 className="mt-7 font-display text-2xl text-mist">Esqueci minha senha</h1>
            <p className="mt-3 text-sm leading-relaxed text-mist/65">
              Coloca o e-mail que você usou para criar a conta. Eu te mando um link para
              criar uma senha nova.
            </p>

            <label htmlFor="email" className="mt-6 block text-xs text-mist/50">
              Seu e-mail
            </label>
            <input
              id="email"
              type="email"
              autoComplete="email"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              onKeyDown={(e) => e.key === "Enter" && email.includes("@") && enviar()}
              placeholder="voce@exemplo.com"
              className="mt-1 w-full rounded-xl border border-night-line bg-night p-3 text-mist outline-none placeholder:text-mist/25 focus:border-amber"
            />

            {erro && <p className="mt-3 text-sm text-red-300">{erro}</p>}

            <button
              onClick={enviar}
              disabled={estado === "enviando" || !email.includes("@")}
              className="mt-5 w-full rounded-xl bg-amber px-6 py-3.5 font-display font-bold text-night transition hover:brightness-105 disabled:opacity-30"
            >
              {estado === "enviando" ? "Enviando…" : "Me manda o link"}
            </button>

            <Link
              href="/login"
              className="mt-5 block text-center text-sm text-mist/50 hover:text-mist/80"
            >
              Lembrei a senha
            </Link>
          </>
        )}
      </div>
    </main>
  );
}
