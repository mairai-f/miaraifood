import { Download, MonitorDown, Package, Smartphone } from "lucide-react";

const installers = [
  { label: "Windows .exe", route: "/downloads/windows", icon: MonitorDown, detail: "Executavel para caixa offline no Windows." },
  { label: "Linux", route: "/downloads/linux", icon: MonitorDown, detail: "Instalador Linux principal." },
  { label: "Linux .deb", route: "/downloads/linux-deb", icon: Package, detail: "Pacote Debian/Ubuntu para PDV local." },
  { label: "Android APK", route: "/downloads/android", icon: Smartphone, detail: "APK para garcom, tablet e autoatendimento." },
];

export function OfflineDownloadsPanel() {
  return (
    <section className="space-y-5">
      <div>
        <p className="text-xs font-black uppercase tracking-[0.18em] text-primary">Plano offline</p>
        <h3 className="text-2xl font-black">Executaveis HappyCashFood</h3>
        <p className="mt-1 text-sm text-muted-foreground">
          O plano basico custa R$ 250 sem executavel offline. O plano de R$ 310 libera sistema offline e downloads protegidos.
        </p>
      </div>

      <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-4">
        {installers.map((installer) => {
          const Icon = installer.icon;
          return (
            <a
              key={installer.route}
              href={installer.route}
              className="rounded-lg border bg-card p-4 shadow-sm transition hover:-translate-y-0.5 hover:shadow-panel"
            >
              <div className="flex h-11 w-11 items-center justify-center rounded-lg bg-primary/10 text-primary">
                <Icon className="h-5 w-5" />
              </div>
              <h4 className="mt-4 text-lg font-black">{installer.label}</h4>
              <p className="mt-2 min-h-12 text-sm text-muted-foreground">{installer.detail}</p>
              <span className="mt-4 inline-flex items-center gap-2 rounded-lg border bg-background px-3 py-2 text-sm font-black">
                <Download className="h-4 w-4" />
                Baixar
              </span>
            </a>
          );
        })}
      </div>

      <div className="grid gap-4 lg:grid-cols-2">
        <article className="rounded-lg border bg-card p-5">
          <h4 className="text-xl font-black">Food basico</h4>
          <p className="mt-1 text-3xl font-black text-primary">R$ 250</p>
          <p className="mt-2 text-sm text-muted-foreground">Libera todo o sistema web do HappyCashFood, sem executavel offline.</p>
        </article>
        <article className="rounded-lg border border-primary/40 bg-primary/5 p-5">
          <h4 className="text-xl font-black">Food offline</h4>
          <p className="mt-1 text-3xl font-black text-primary">R$ 310</p>
          <p className="mt-2 text-sm text-muted-foreground">Inclui tudo do basico, executavel Windows, Linux, .deb e APK para operar local.</p>
        </article>
      </div>
    </section>
  );
}
