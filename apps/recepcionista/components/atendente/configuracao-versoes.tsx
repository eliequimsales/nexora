"use client";
import { useState } from "react";
import type { TelaConfiguracaoNexa } from "@/lib/atendente/configuracao-schema";
import type { VersaoDoAtendente } from "@/lib/atendente/configuracao";
import { requisitarConfiguracaoNexa as requisitar, type OperarConfiguracaoNexa } from "./configuracao-requisicao";
import { BOTAO_NEXA as BOTAO } from "./configuracao-campos";

export function VersoesDoAtendente({ revisao, desabilitado, aoRestaurar, operar }: { revisao: number; desabilitado: boolean; operar: OperarConfiguracaoNexa; aoRestaurar: (tela: TelaConfiguracaoNexa) => void | Promise<void> }) {
  const [aberto, setAberto] = useState(false); const [versoes, setVersoes] = useState<VersaoDoAtendente[]>([]);
  const [ocupado, setOcupado] = useState(false); const [erro, setErro] = useState(""); const [escolhida, setEscolhida] = useState<string | null>(null);
  async function abrir() {
    if (aberto) { setAberto(false); return; }
    setOcupado(true); setErro("");
    try { const r = await requisitar<{ versoes: VersaoDoAtendente[] }>("/api/atendente/configuracao/versoes"); setVersoes(r.versoes); setAberto(true); }
    catch (e) { setErro((e as Error).message); } finally { setOcupado(false); }
  }
  async function restaurar() {
    if (!escolhida || ocupado) return; setOcupado(true); setErro("");
    try { const t = await operar(() => requisitar<TelaConfiguracaoNexa>("/api/atendente/configuracao/versoes", "POST", { revisao, versaoId: escolhida })); if (!t) return; await aoRestaurar(t); setEscolhida(null); setAberto(false); }
    catch (e) { setErro((e as Error).message); } finally { setOcupado(false); }
  }
  return <div className="mt-6 border-t border-panel-line pt-4"><button type="button" className={BOTAO} disabled={ocupado || desabilitado} aria-expanded={aberto} onClick={() => void abrir()}>{ocupado ? "Carregando…" : "Versões anteriores"}</button>
    {erro && <p role="alert" className="mt-3 text-xs text-red-700">{erro}</p>}
    {aberto && <div className="mt-4 space-y-3"><p className="text-xs leading-relaxed text-panel-sub">Você pode recuperar uma das cinco versões anteriores para conferir e testar. A versão em uso continua atendendo até você aplicar a alteração.</p>
      {!versoes.length && <p className="text-sm text-panel-sub">O histórico começa na primeira aplicação das informações.</p>}
      {versoes.map(v => <div key={v.id} className="flex flex-wrap items-center justify-between gap-3 rounded-xl border border-panel-line p-3"><div className="text-xs"><p className="font-semibold">{v.empresa}</p><p className="mt-1 text-panel-sub">{new Date(v.em).toLocaleString("pt-BR")}{v.atual ? " · Em uso" : ""}</p></div>{!v.atual && <button type="button" className={BOTAO} disabled={ocupado || desabilitado} onClick={() => setEscolhida(v.id)}>Recuperar para revisão</button>}</div>)}
      {escolhida && <div className="rounded-xl bg-amber/10 p-4"><p className="text-sm font-semibold">Substituir o rascunho pela versão escolhida?</p><p className="mt-1 text-xs leading-relaxed text-panel-sub">As alterações ainda não aplicadas serão substituídas. A conversa fica guardada e você precisará conferir e testar novamente.</p><div className="mt-3 flex flex-wrap gap-2"><button type="button" className={BOTAO} disabled={ocupado || desabilitado} onClick={() => void restaurar()}>Recuperar esta versão</button><button type="button" className={BOTAO} disabled={ocupado} onClick={() => setEscolhida(null)}>Continuar com o rascunho</button></div></div>}
    </div>}
  </div>;
}
