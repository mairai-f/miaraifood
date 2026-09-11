import { TvScreensPanel } from '@/components/tv/TvScreensPanel';

// Configurações › TV (web e desktop). No desktop é daqui que sai o "Abrir na TV"
// para a TV ligada no computador pelo HDMI.
export default function TvSettings() {
  return (
    <div className="mx-auto w-full max-w-4xl space-y-6 p-4 md:p-6">
      <div>
        <p className="text-xs font-semibold uppercase tracking-wider text-emerald-600">Configurações</p>
        <h1 className="mt-0.5 text-3xl font-extrabold tracking-tight text-foreground">TV</h1>
        <p className="mt-1 text-sm text-muted-foreground">
          Passe as promoções e os produtos que você escolher nas TVs do salão.
        </p>
      </div>
      <TvScreensPanel />
    </div>
  );
}
