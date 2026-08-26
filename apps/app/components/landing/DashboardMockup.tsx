'use client';

/**
 * Prévia visual da aplicação para a landing.
 * Preserva integralmente o frame, o shell e o acabamento do mockup original.
 */
export function DashboardMockup() {
  return (
    <div
      className="relative w-full max-w-3xl mx-auto select-none"
      aria-hidden="true"
    >
      <div className="absolute inset-0 bg-brand-gold/5 blur-3xl rounded-3xl -z-10" />

      <div className="rounded-xl border border-brand-border bg-[#0f0f12] shadow-2xl overflow-hidden">
        <div className="flex items-center gap-2 px-4 py-3 bg-[#1a1a20] border-b border-white/5">
          <div className="flex gap-1.5">
            <div className="w-3 h-3 rounded-full bg-[#ff5f57]" />
            <div className="w-3 h-3 rounded-full bg-[#febc2e]" />
            <div className="w-3 h-3 rounded-full bg-[#28c840]" />
          </div>
          <div className="flex-1 mx-4 bg-white/5 rounded-md px-3 py-1 text-xs text-white/30 font-mono">
            app.nexora.com.br/negocio-do-marcos/inicio
          </div>
        </div>

        <div className="flex h-[340px] sm:h-[420px]">
          <div className="w-[52px] sm:w-[160px] bg-[#141418] border-r border-white/5 flex flex-col py-4 gap-1 shrink-0">
            <div className="flex items-center gap-2 px-3 mb-3">
              <div className="w-6 h-6 rounded-md bg-brand-gold flex items-center justify-center shrink-0">
                <span className="text-[10px] font-bold text-black">N</span>
              </div>
              <span className="text-xs font-semibold text-white/80 hidden sm:block truncate">Nexora</span>
            </div>
            {[
              { icon: '▪', label: 'Início', active: true },
              { icon: '◦', label: 'Clientes', active: false },
            ].map((item) => (
              <div
                key={item.label}
                className={`flex items-center gap-2.5 px-3 py-2 mx-1.5 rounded-md text-xs ${
                  item.active
                    ? 'bg-brand-gold/15 text-brand-gold'
                    : 'text-white/30'
                }`}
              >
                <span className="text-[10px]">{item.icon}</span>
                <span className="hidden sm:block">{item.label}</span>
              </div>
            ))}
          </div>

          <div className="flex-1 p-3 sm:p-5 overflow-hidden bg-[#0f0f12] space-y-3">
            <div>
              <p className="text-xs sm:text-sm font-bold text-white/90">Início</p>
              <p className="text-[10px] text-white/30 mt-0.5 hidden sm:block">
                Negócio do Marcos • Seus clientes em um só lugar
              </p>
            </div>

            <div className="grid grid-cols-2 sm:grid-cols-4 gap-2">
              <div className="rounded-lg bg-brand-gold/10 border border-brand-gold/30 p-2.5">
                <p className="text-[9px] uppercase tracking-widest text-brand-gold mb-1">
                  Adicionar
                </p>
                <p className="text-lg sm:text-xl font-bold text-brand-gold">+</p>
                <p className="text-[9px] text-white/30 mt-1">novo cliente</p>
              </div>
              <div className="rounded-lg bg-purple-500/10 border border-purple-500/30 p-2.5">
                <p className="text-[9px] uppercase tracking-widest text-purple-400 mb-1">
                  Importar
                </p>
                <p className="text-lg sm:text-xl font-bold text-purple-400">↑</p>
                <p className="text-[9px] text-white/30 mt-1">CSV ou XLSX</p>
              </div>
              <div className="rounded-lg bg-white/5 border border-white/5 p-2.5 hidden sm:block">
                <p className="text-[9px] uppercase tracking-widest text-white/40 mb-1">
                  Atenção
                </p>
                <p className="text-xl font-bold text-yellow-400">3</p>
                <p className="text-[9px] text-white/30 mt-1">agora</p>
              </div>
              <div className="rounded-lg bg-white/5 border border-white/5 p-2.5 hidden sm:block">
                <p className="text-[9px] uppercase tracking-widest text-white/40 mb-1">
                  Clientes
                </p>
                <p className="text-xl font-bold text-white/70">128</p>
                <p className="text-[9px] text-white/30 mt-1">na base</p>
              </div>
            </div>

            <div className="rounded-lg bg-white/5 border border-white/5 p-2.5 space-y-2">
              <p className="text-[9px] text-white/50 font-semibold uppercase tracking-widest">
                Precisam de atenção
              </p>
              {[
                { name: 'Maria Almeida', reason: 'Sem interação há 42 dias.' },
                { name: 'João Pereira', reason: 'Sem interação há 36 dias.' },
                { name: 'Ana Costa', reason: 'Sem interação há 31 dias.' },
              ].map((item) => (
                <div key={item.name} className="flex items-center justify-between gap-2">
                  <div className="flex items-center gap-2 min-w-0">
                    <div className="w-5 h-5 rounded-full bg-white/10 flex items-center justify-center shrink-0">
                      <span className="text-[9px] text-white/50">{item.name[0]}</span>
                    </div>
                    <span className="text-[10px] text-white/70 truncate">{item.name}</span>
                  </div>
                  <div className="flex shrink-0 items-center gap-2">
                    <span className="text-[9px] text-yellow-400">atenção</span>
                    <span className="text-[9px] text-white/25 hidden sm:block">
                      {item.reason}
                    </span>
                  </div>
                </div>
              ))}
            </div>
          </div>
        </div>
      </div>

      <div className="absolute -bottom-3 left-1/2 -translate-x-1/2 flex items-center gap-2 bg-emerald-500/15 border border-emerald-500/40 rounded-full px-4 py-1.5 whitespace-nowrap">
        <span className="w-2 h-2 rounded-full bg-emerald-400 animate-pulse" />
        <span className="text-xs font-semibold text-emerald-400">
          Seus clientes sempre por perto
        </span>
      </div>
    </div>
  );
}
