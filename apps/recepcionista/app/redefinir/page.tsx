"use client";

import Link from "next/link";
import { useRouter, useSearchParams } from "next/navigation";
import { Suspense, useState } from "react";

function Formulario() {
  const router = useRouter();
  const token = useSearchParams().get("token") ?? "";

  const [senha, setSenha] = useState("");
  const [repetir, setRepetir] = useState("");
  const [estado, setEstado] = useState<"pronto" | "enviando" | "feito">("pronto");
  const [erro, setErro] = useState("");

  const curta = senha.length > 0 && senha.length < 8;
  const diferente = repetir.length > 0 && senha !== repetir;
  const podeEnviar = senha.length >= 8 && senha === repetir && token.length > 0;

  const enviar = async () => {
    setEstado("enviando");
    setErro("");
    try {
      const res = await fetch("/api/auth/redefinir", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ token, senha }),
      });
      const json = await res.json();
      if (!res.ok) {
        setErro(json.error ?? "Não consegui redefinir agora.");
        setEstado("pronto");
        return;
      }
      setEstado("feito");
      setTimeout(() => router.push("/login"), 1800);
    } catch {
      setErro("Falha de conexão. Tenta de novo?");
      setEstado("pronto");
    }
  };

  if (!token) {
    return (
      <>
        <h1 className="mt-7 font-display text-2xl text-mist">Link incompleto</h1>
        <p className="mt-3 text-sm leading-relaxed text-mist/70">
          Esse endereço não tem o código de verificação. Abre o link direto do e-mail que
          você recebeu, ou pede outro.
        </p>
        <Link
          href="/recuperar"
          className="mt-6 inline-block rounded-xl bg-amber px-5 py-3 font-display font-bold text-night"
        >
          Pedir outro link
        </Link>
      </>
    );
  }

  if (estado === "feito") {
    return (
      <>
        <h1 className="mt-7 font-display text-2xl text-mist">Senha trocada</h1>
        <p className="mt-3 text-sm text-mist/70">
          Pronto. Já estou te levando para o login.
        </p>
      </>
    );
  }

  return (
    <>
      <h1 className="mt-7 font-display text-2xl text-mist">Criar uma senha nova</h1>
      <p className="mt-3 text-sm text-mist/65">
        Este link só funciona uma vez. Depois de trocar, ele deixa de valer.
      </p>

      <label htmlFor="senha" className="mt-6 block text-xs text-mist/50">
        Nova senha
      </label>
      <input
        id="senha"
        type="password"
        autoComplete="new-password"
        value={senha}
        onChange={(e) => setSenha(e.target.value)}
        placeholder="mínimo 8 caracteres"
        className="mt-1 w-full rounded-xl border border-night-line bg-night p-3 text-mist outline-none placeholder:text-mist/25 focus:border-amber"
      />
      {curta && <p className="mt-1 text-xs text-mist/50">Faltam {8 - senha.length} caracteres.</p>}

      <label htmlFor="repetir" className="mt-4 block text-xs text-mist/50">
        Repita a senha
      </label>
      <input
        id="repetir"
        type="password"
        autoComplete="new-password"
        value={repetir}
        onChange={(e) => setRepetir(e.target.value)}
        onKeyDown={(e) => e.key === "Enter" && podeEnviar && enviar()}
        className="mt-1 w-full rounded-xl border border-night-line bg-night p-3 text-mist outline-none focus:border-amber"
      />
      {diferente && <p className="mt-1 text-xs text-red-300">As duas senhas não batem.</p>}

      {erro && <p className="mt-3 text-sm text-red-300">{erro}</p>}

      <button
        onClick={enviar}
        disabled={!podeEnviar || estado === "enviando"}
        className="mt-5 w-full rounded-xl bg-amber px-6 py-3.5 font-display font-bold text-night transition hover:brightness-105 disabled:opacity-30"
      >
        {estado === "enviando" ? "Trocando…" : "Trocar minha senha"}
      </button>
    </>
  );
}

export default function PaginaRedefinir() {
  return (
    <main className="mx-auto flex min-h-screen max-w-md flex-col justify-center px-6 py-16">
      <div className="rounded-2xl border border-night-line bg-night-soft p-8">
        <Link href="/" className="flex items-center gap-2.5">
          <span className="flex h-9 w-9 items-center justify-center rounded-lg bg-amber font-display text-lg font-bold text-night">
            N
          </span>
          <span className="font-display font-semibold text-mist">Nexora</span>
        </Link>
        {/* useSearchParams exige Suspense no App Router; sem ele o build falha. */}
        <Suspense fallback={<p className="mt-7 text-sm text-mist/50">Carregando…</p>}>
          <Formulario />
        </Suspense>
      </div>
    </main>
  );
}
