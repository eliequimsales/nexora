import { Sparkles, Users } from 'lucide-react';

/**
 * Hero visual original de Clientes, agora com o conteúdo da nova Nexora.
 * A composição, o gradiente, o brilho e os espaçamentos foram preservados.
 */
export function RecoveryHero() {
  return (
    <div
      className="relative overflow-hidden rounded-2xl border border-brand-purple/30 p-6 sm:p-8"
      style={{
        background:
          'linear-gradient(135deg, #7C3AED 0%, #6D28D9 60%, #4C1D95 100%)',
      }}
    >
      <div
        aria-hidden
        className="pointer-events-none absolute -top-24 -right-24 w-72 h-72 rounded-full opacity-30 blur-3xl"
        style={{ background: 'radial-gradient(circle, #EAB308 0%, transparent 70%)' }}
      />

      <div className="relative flex flex-col gap-5 sm:flex-row sm:items-center sm:justify-between">
        <div className="max-w-2xl">
          <div className="inline-flex items-center gap-1.5 rounded-full bg-white/10 px-2.5 py-1 text-2xs font-medium text-white/90 backdrop-blur-sm">
            <Sparkles size={11} className="text-brand-gold" />
            Clientes Nexora
          </div>

          <h1 className="mt-3 text-2xl sm:text-3xl lg:text-4xl font-bold text-white leading-tight">
            Cada cliente tem uma história.
          </h1>

          <p className="mt-3 max-w-xl text-sm sm:text-base text-white/80">
            Encontre rapidamente uma pessoa, entenda quem precisa de atenção e mantenha
            toda a sua base próxima.
          </p>
        </div>

        <div className="hidden sm:flex h-20 w-20 shrink-0 items-center justify-center rounded-2xl border border-white/15 bg-white/10 backdrop-blur-sm">
          <Users size={34} className="text-brand-gold" />
        </div>
      </div>
    </div>
  );
}
