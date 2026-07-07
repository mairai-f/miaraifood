type AppSplashProps = {
  progress: number;
  title: string;
  subtitle: string;
};

export function AppSplash({ progress, title, subtitle }: AppSplashProps) {
  const safeProgress = Math.max(0, Math.min(progress, 100));

  return (
    <main className="relative flex min-h-dvh items-center justify-center overflow-hidden bg-[#fff7ef] px-5 py-8 text-[#2f2419]">
      <div className="absolute inset-0 bg-[radial-gradient(circle_at_top_left,_rgba(255,143,60,0.18),_transparent_30%),radial-gradient(circle_at_bottom_right,_rgba(255,205,127,0.26),_transparent_36%)]" />
      <div className="splash-glow absolute left-1/2 top-1/2 h-72 w-72 rounded-full bg-orange-300/20 blur-3xl" />
      <div className="splash-orbit absolute -left-10 top-16 h-24 w-24 rounded-[28px] bg-white/80 shadow-panel" />
      <div className="splash-orbit absolute -right-8 bottom-24 h-28 w-28 rounded-full border-[22px] border-[#ffb065]/30" />
      <div className="absolute bottom-[-6rem] right-[-5rem] h-56 w-56 rounded-full border-[42px] border-[#ff9e4a]/24" />

      <section className="splash-card-enter relative z-10 w-full max-w-md text-center">
        <div className="menu-surface overflow-hidden rounded-[36px] p-6 sm:p-7">
          <div className="absolute inset-x-0 top-0 h-24 bg-[radial-gradient(circle_at_top,_rgba(255,160,84,0.20),_transparent_72%)]" />
          <div className="splash-logo-float relative rounded-[28px] bg-white px-5 py-6 shadow-[0_24px_60px_rgba(101,56,12,0.12)]">
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

          <p className="mt-6 text-[11px] font-extrabold uppercase tracking-[0.32em] text-[#ff7f32]/82 sm:text-xs">
            {subtitle}
          </p>
          <h1 className="mt-3 text-3xl font-extrabold tracking-[-0.04em] text-[#25180d]">
            {title}
          </h1>
          <p className="mt-2 text-sm font-semibold leading-6 text-[#7a5b43]">
            Carregando o cardapio digital com mesas, delivery e checkout rapido.
          </p>

          <div className="mt-8 rounded-[28px] bg-[#fff4e7] p-5 text-left">
            <div className="flex items-center justify-between text-[10px] font-extrabold uppercase tracking-[0.28em] text-[#b86a2f] sm:text-xs">
              <span>Abrindo app</span>
              <span>{Math.round(safeProgress)}%</span>
            </div>
            <div className="mt-3 h-3 overflow-hidden rounded-full bg-white">
              <div className="splash-progress h-full rounded-full" style={{ width: `${safeProgress}%` }} />
            </div>
            <div className="mt-4 flex items-center justify-between">
              <span className="text-xs font-extrabold text-[#6e513d]">Splash, menu e checkout</span>
              <div className="flex gap-2">
                <span className="splash-dot inline-flex h-2.5 w-2.5 rounded-full bg-[#ff8b3d]" />
                <span className="splash-dot inline-flex h-2.5 w-2.5 rounded-full bg-[#ffb15d]" style={{ animationDelay: "140ms" }} />
                <span className="splash-dot inline-flex h-2.5 w-2.5 rounded-full bg-[#ffd27a]" style={{ animationDelay: "280ms" }} />
              </div>
            </div>
          </div>
        </div>
      </section>
    </main>
  );
}
