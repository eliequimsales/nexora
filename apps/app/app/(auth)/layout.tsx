export default function AuthLayout({ children }: { children: React.ReactNode }) {
  return (
    <div className="min-h-screen bg-brand-bg flex flex-col items-center justify-center px-4">
      <div className="w-full max-w-sm">
        {/* Logo */}
        <div className="flex items-center justify-center gap-2.5 mb-8">
          <div className="w-8 h-8 rounded-lg bg-brand-amber flex items-center justify-center">
            <span className="text-brand-bg text-sm font-bold">N</span>
          </div>
          <span className="text-text-primary font-semibold text-lg">
            Nexora
          </span>
        </div>
        {children}
      </div>
    </div>
  );
}
