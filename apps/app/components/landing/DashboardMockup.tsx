'use client';

/**
 * DashboardMockup — prévia visual do produto para a landing page.
 * Renderiza um "screenshot" estático do dashboard usando HTML/CSS puro,
 * sem dependências de imagem. Atualizar quando o UI real mudar.
 */
export function DashboardMockup() {
  return (
    <div
      className="relative w-full max-w-3xl mx-auto select-none"
      aria-hidden="true"
    >
      {/* Sombra e brilho de fundo */}
      <div className="absolute inset-0 bg-brand-gold/5 blur-3xl rounded-3xl -z-10" />

      {/* Frame do browser */}
      <div className="rounded-xl border border-brand-border bg-[#0f0f12] shadow-2xl overflow-hidden">
        {/* Browser chrome */}
        <div className="flex items-center gap-2 px-4 py-3 bg-[#1a1a20] border-b border-white/5">
          <div className="flex gap-1.5">
            <div className="w-3 h-3 rounded-full bg-[#ff5f57]" />
            <div className="w-3 h-3 rounded-full bg-[#febc2e]" />
            <div className="w-3 h-3 rounded-full bg-[#28c840]" />
          </div>
          <div className="flex-1 mx-4 bg-white/5 rounded-md px-3 py-1 text-xs text-white/30 font-mono">
            app.nexora.com.br/barbearia-do-marcos/dashboard
          </div>
        </div>

        {/* App shell */}
        <div className="flex h-[340px] sm:h-[420px]">
          {/* Sidebar mini */}
          <div className="w-[52px] sm:w-[160px] bg-[#141418] border-r border-white/5 flex flex-col py-4 gap-1 shrink-0">
            {/* Logo */}
            <div className="flex items-center gap-2 px-3 mb-3">
              <div className="w-6 h-6 rounded-md bg-brand-gold flex items-center justify-center shrink-0">
                <span className="text-[10px] font-bold text-black">N</span>
              </div>
              <span className="text-xs font-semibold text-white/80 hidden sm:block truncate">Nexora</span>
            </div>
            {[
              { icon: '▪', label: 'Dashboard', active: true },
              { icon: '◦', label: 'Clientes', active: false },
              { icon: '◦', label: 'Tarefas', active: false },
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

          {/* Main content */}
          <div className="flex-1 p-3 sm:p-5 overflow-hidden bg-[#0f0f12] space-y-3">
            {/* Header */}
            <div>
              <p className="text-xs sm:text-sm font-bold text-white/90">🎯 Dashboard de Recuperação</p>
              <p className="text-[10px] text-white/30 mt-0.5 hidden sm:block">Barbearia do Marcos • Atualizado agora</p>
            </div>

            {/* KPI cards */}
            <div className="grid grid-cols-2 sm:grid-cols-4 gap-2">
              <div className="rounded-lg bg-white/5 border border-white/5 p-2.5">
                <p className="text-[9px] uppercase tracking-widest text-white/40 mb-1">Inativos</p>
                <p className="text-lg sm:text-xl font-bold text-yellow-400">47</p>
                <p className="text-[9px] text-white/30 mt-1">30+ dias</p>
              </div>
              <div className="rounded-lg bg-emerald-500/10 border border-emerald-500/30 p-2.5">
                <p className="text-[9px] uppercase tracking-widest text-emerald-400 mb-1">Receita rec.</p>
                <p className="text-lg sm:text-xl font-bold text-emerald-400">R$1.840</p>
                <p className="text-[9px] text-white/30 mt-1">este mês</p>
              </div>
              <div className="rounded-lg bg-white/5 border border-white/5 p-2.5 hidden sm:block">
                <p className="text-[9px] uppercase tracking-widest text-white/40 mb-1">Taxa resp.</p>
                <p className="text-xl font-bold text-purple-400">34%</p>
                <p className="text-[9px] text-white/30 mt-1">este mês</p>
              </div>
              <div className="rounded-lg bg-white/5 border border-white/5 p-2.5 hidden sm:block">
                <p className="text-[9px] uppercase tracking-widest text-white/40 mb-1">Potencial</p>
                <p className="text-xl font-bold text-white/70">R$3.760</p>
                <p className="text-[9px] text-white/30 mt-1">estimativa</p>
              </div>
            </div>

            {/* Activity feed mini */}
            <div className="rounded-lg bg-white/5 border border-white/5 p-2.5 space-y-2">
              <p className="text-[9px] text-white/50 font-semibold uppercase tracking-widest">Atividade recente</p>
              {[
                { name: 'Carlos Souza', time: 'há 2 min', status: 'respondeu', color: 'text-emerald-400' },
                { name: 'Rodrigo Melo', time: 'há 15 min', status: 'mensagem enviada', color: 'text-yellow-400' },
                { name: 'André Lima', time: 'há 1h', status: 'mensagem enviada', color: 'text-yellow-400' },
              ].map((item) => (
                <div key={item.name} className="flex items-center justify-between gap-2">
                  <div className="flex items-center gap-2 min-w-0">
                    <div className="w-5 h-5 rounded-full bg-white/10 flex items-center justify-center shrink-0">
                      <span className="text-[9px] text-white/50">{item.name[0]}</span>
                    </div>
                    <span className="text-[10px] text-white/70 truncate">{item.name}</span>
                  </div>
                  <div className="flex items-center gap-2 shrink-0">
                    <span className={`text-[9px] ${item.color}`}>{item.status}</span>
                    <span className="text-[9px] text-white/25">{item.time}</span>
                  </div>
                </div>
              ))}
            </div>
          </div>
        </div>
      </div>

      {/* Badge de resultado */}
      <div className="absolute -bottom-3 left-1/2 -translate-x-1/2 flex items-center gap-2 bg-emerald-500/15 border border-emerald-500/40 rounded-full px-4 py-1.5 whitespace-nowrap">
        <span className="w-2 h-2 rounded-full bg-emerald-400 animate-pulse" />
        <span className="text-xs font-semibold text-emerald-400">R$1.840 recuperados esse mês</span>
      </div>
    </div>
  );
}
