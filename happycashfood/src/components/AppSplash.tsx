type AppSplashProps = {
  progress: number;
  title: string;
  subtitle: string;
};

export function AppSplash({ progress, title, subtitle }: AppSplashProps) {
  const safeProgress = Math.max(0, Math.min(progress, 100));

  return (
    <main className="relative flex min-h-dvh items-center justify-center overflow-hidden bg-[#050505] px-5 py-8 text-white">
      <div className="absolute inset-0 bg-[radial-gradient(circle_at_top,_rgba(250,204,21,0.24),_transparent_38%),radial-gradient(circle_at_bottom,_rgba(245,158,11,0.18),_transparent_42%)]" />
      <div className="splash-glow absolute left-1/2 top-1/2 h-64 w-64 rounded-full bg-yellow-400/10 blur-3xl" />

      <section className="splash-card-enter relative z-10 w-full max-w-md text-center">
        <div className="splash-logo-float">
          <img
            src="/happycashfood.webp"
            alt={title}
            className="mx-auto h-auto w-full max-w-[300px] object-contain sm:max-w-[340px]"
            width={1536}
            height={1024}
            loading="eager"
            decoding="async"
          />
        </div>

        <p className="mt-4 text-xs font-semibold uppercase tracking-[0.32em] text-yellow-200/85 sm:text-sm">
          {subtitle}
        </p>

        <div className="mt-9 rounded-lg border border-yellow-400/15 bg-white/5 p-4 shadow-panel backdrop-blur-md">
          <div className="flex items-center justify-between text-[10px] font-semibold uppercase tracking-[0.28em] text-yellow-100/70 sm:text-xs">
            <span>Carregando</span>
            <span>{Math.round(safeProgress)}%</span>
          </div>
          <div className="mt-3 h-2.5 overflow-hidden rounded-full bg-white/10">
            <div className="splash-progress h-full rounded-full" style={{ width: `${safeProgress}%` }} />
          </div>
        </div>
      </section>
    </main>
  );
}
