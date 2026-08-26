"use client";

import { useRouter } from "next/navigation";

export function LogoutButton() {
  const router = useRouter();

  async function handleLogout() {
    await fetch("/api/auth/logout", { method: "POST" });
    router.push("/login");
    router.refresh();
  }

  return (
    <button
      onClick={handleLogout}
      className="rounded-lg border border-panel-line px-3 py-1.5 text-sm text-panel-sub transition hover:bg-panel-card hover:text-panel-ink"
    >
      Sair
    </button>
  );
}
