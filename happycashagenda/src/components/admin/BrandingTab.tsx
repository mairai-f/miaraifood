import { useEffect, useState } from "react";
import { CalendarDays, Palette, RotateCcw, Save, Sparkles } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Slider } from "@/components/ui/slider";
import { Switch } from "@/components/ui/switch";
import { Textarea } from "@/components/ui/textarea";
import { useAgendaBranding, type AgendaBrandingSettings } from "@/hooks/useAgendaBranding";
import { useToast } from "@/hooks/use-toast";

const BUSINESS_TYPES = [
  "Serviços em geral",
  "Barbearia",
  "Salão de beleza",
  "Clínica",
  "Estética",
  "Pet shop",
  "Oficina",
  "Consultoria",
  "Aulas particulares",
  "Restaurante",
];

const clamp = (value: number, min: number, max: number) => Math.min(Math.max(value, min), max);

const hexToHsl = (hex: string) => {
  const normalized = hex.replace("#", "");
  const r = parseInt(normalized.slice(0, 2), 16) / 255;
  const g = parseInt(normalized.slice(2, 4), 16) / 255;
  const b = parseInt(normalized.slice(4, 6), 16) / 255;
  const max = Math.max(r, g, b);
  const min = Math.min(r, g, b);
  const lightness = (max + min) / 2;
  let hue = 0;
  let saturation = 0;

  if (max !== min) {
    const delta = max - min;
    saturation = lightness > 0.5 ? delta / (2 - max - min) : delta / (max + min);

    if (max === r) hue = (g - b) / delta + (g < b ? 6 : 0);
    if (max === g) hue = (b - r) / delta + 2;
    if (max === b) hue = (r - g) / delta + 4;
    hue /= 6;
  }

  return `${Math.round(hue * 360)} ${Math.round(saturation * 100)}% ${Math.round(lightness * 100)}%`;
};

const hslToHex = (hsl: string) => {
  const [hRaw, sRaw, lRaw] = hsl.replace(/%/g, "").split(/\s+/).map(Number);
  const h = clamp(Number.isFinite(hRaw) ? hRaw : 258, 0, 360) / 360;
  const s = clamp(Number.isFinite(sRaw) ? sRaw : 84, 0, 100) / 100;
  const l = clamp(Number.isFinite(lRaw) ? lRaw : 58, 0, 100) / 100;

  if (s === 0) {
    const gray = Math.round(l * 255).toString(16).padStart(2, "0");
    return `#${gray}${gray}${gray}`;
  }

  const hueToRgb = (p: number, q: number, tValue: number) => {
    let t = tValue;
    if (t < 0) t += 1;
    if (t > 1) t -= 1;
    if (t < 1 / 6) return p + (q - p) * 6 * t;
    if (t < 1 / 2) return q;
    if (t < 2 / 3) return p + (q - p) * (2 / 3 - t) * 6;
    return p;
  };

  const q = l < 0.5 ? l * (1 + s) : l + s - l * s;
  const p = 2 * l - q;
  const r = hueToRgb(p, q, h + 1 / 3);
  const g = hueToRgb(p, q, h);
  const b = hueToRgb(p, q, h - 1 / 3);

  return `#${[r, g, b]
    .map((channel) => Math.round(channel * 255).toString(16).padStart(2, "0"))
    .join("")}`;
};

export function BrandingTab() {
  const { settings, loading, updatePreview, saveSettings, resetPreview } = useAgendaBranding();
  const [draft, setDraft] = useState<AgendaBrandingSettings>(settings);
  const [editing, setEditing] = useState(false);
  const [saving, setSaving] = useState(false);
  const { toast } = useToast();

  useEffect(() => {
    if (!editing) setDraft(settings);
  }, [editing, settings]);

  const updateDraft = (next: Partial<AgendaBrandingSettings>) => {
    const nextDraft = { ...draft, ...next };
    setEditing(true);
    setDraft(nextDraft);
    updatePreview(nextDraft);
  };

  const handleSave = async () => {
    setSaving(true);
    const result = await saveSettings(draft);
    setSaving(false);

    if (result.error) {
      toast({
        title: "Nao foi possivel salvar",
        description: result.error,
        variant: "destructive",
      });
      return;
    }

    toast({
      title: "Identidade salva",
      description: "Nome, segmento e cores do HappyCash Agenda foram atualizados.",
    });
    setEditing(false);
  };

  const handleReset = () => {
    setEditing(false);
    resetPreview();
    toast({
      title: "Previa restaurada",
      description: "As cores e textos voltaram para o padrao do HappyCash Agenda.",
    });
  };

  if (loading) {
    return <div className="py-10 text-center text-sm text-muted-foreground">Carregando identidade...</div>;
  }

  return (
    <div className="grid gap-4 lg:grid-cols-[minmax(0,1fr)_360px]">
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2 text-base">
            <Palette className="h-5 w-5" />
            Identidade da empresa
          </CardTitle>
          <CardDescription>
            Configure como o cliente enxerga sua agenda publica e como o painel identifica o negocio.
          </CardDescription>
        </CardHeader>
        <CardContent className="grid gap-4 md:grid-cols-2">
          <div className="space-y-2">
            <Label htmlFor="displayName">Nome da empresa</Label>
            <Input
              id="displayName"
              value={draft.displayName}
              onChange={(event) => updateDraft({ displayName: event.target.value })}
              placeholder="Ex: Clinica Boa Vida"
            />
          </div>

          <div className="space-y-2">
            <Label htmlFor="businessType">Tipo de empresa</Label>
            <Select value={draft.businessType} onValueChange={(value) => updateDraft({ businessType: value })}>
              <SelectTrigger id="businessType">
                <SelectValue placeholder="Selecione o segmento" />
              </SelectTrigger>
              <SelectContent>
                {BUSINESS_TYPES.map((type) => (
                  <SelectItem key={type} value={type}>
                    {type}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

          <div className="space-y-2">
            <Label htmlFor="professionalLabel">Nome para profissional</Label>
            <Input
              id="professionalLabel"
              value={draft.professionalLabel}
              onChange={(event) => updateDraft({ professionalLabel: event.target.value })}
              placeholder="Ex: Especialista, tecnico, professor"
            />
          </div>

          <div className="space-y-2">
            <Label htmlFor="serviceLabel">Nome para servico</Label>
            <Input
              id="serviceLabel"
              value={draft.serviceLabel}
              onChange={(event) => updateDraft({ serviceLabel: event.target.value })}
              placeholder="Ex: Consulta, atendimento, horario"
            />
          </div>

          <div className="space-y-2 md:col-span-2">
            <Label htmlFor="tagline">Frase curta</Label>
            <Textarea
              id="tagline"
              value={draft.tagline}
              onChange={(event) => updateDraft({ tagline: event.target.value })}
              rows={2}
              placeholder="Agende online, pague como preferir e receba lembretes pelo WhatsApp."
            />
          </div>

          <div className="space-y-2">
            <Label htmlFor="slug">Link publico</Label>
            <Input
              id="slug"
              value={draft.slug}
              onChange={(event) => updateDraft({ slug: event.target.value })}
              placeholder="minha-empresa"
            />
            <p className="text-xs text-muted-foreground">
              URL publica: agenda.happycashsite.com.br/{draft.slug}
            </p>
          </div>

          <div className="space-y-2">
            <div className="flex items-center justify-between gap-3">
              <Label htmlFor="logoSize">Tamanho do logo</Label>
              <span className="text-xs font-medium text-muted-foreground">{Math.round(draft.logoSize)}px</span>
            </div>
            <Slider
              id="logoSize"
              value={[draft.logoSize]}
              min={24}
              max={64}
              step={1}
              onValueChange={([logoSize]) => updateDraft({ logoSize })}
            />
          </div>

          <div className="space-y-2">
            <Label htmlFor="primaryColor">Cor principal</Label>
            <Input
              id="primaryColor"
              type="color"
              value={hslToHex(draft.primaryHsl)}
              onChange={(event) => updateDraft({ primaryHsl: hexToHsl(event.target.value) })}
              className="h-10 p-1"
            />
          </div>

          <div className="space-y-2">
            <Label htmlFor="accentColor">Cor de destaque</Label>
            <Input
              id="accentColor"
              type="color"
              value={hslToHex(draft.accentHsl)}
              onChange={(event) => updateDraft({ accentHsl: hexToHsl(event.target.value) })}
              className="h-10 p-1"
            />
          </div>

          <div className="flex items-center justify-between rounded-lg border bg-muted/30 p-3 md:col-span-2">
            <div>
              <Label htmlFor="publicBookingEnabled">Agenda publica ativa</Label>
              <p className="text-xs text-muted-foreground">
                Quando ativo, clientes podem acessar a agenda pelo link publico.
              </p>
            </div>
            <Switch
              id="publicBookingEnabled"
              checked={draft.publicBookingEnabled}
              onCheckedChange={(checked) => updateDraft({ publicBookingEnabled: checked })}
            />
          </div>

          <div className="flex flex-col gap-2 sm:flex-row md:col-span-2">
            <Button onClick={handleSave} disabled={saving} className="gap-2">
              <Save className="h-4 w-4" />
              {saving ? "Salvando..." : "Salvar identidade"}
            </Button>
            <Button type="button" variant="outline" onClick={handleReset} className="gap-2">
              <RotateCcw className="h-4 w-4" />
              Restaurar padrao
            </Button>
          </div>
        </CardContent>
      </Card>

      <Card className="overflow-hidden">
        <CardHeader>
          <CardTitle className="flex items-center gap-2 text-base">
            <Sparkles className="h-5 w-5" />
            Previa
          </CardTitle>
          <CardDescription>Como a marca aparece no app.</CardDescription>
        </CardHeader>
        <CardContent>
          <div className="rounded-lg border bg-background p-4 shadow-sm">
            <div className="flex items-center gap-3">
              <div className="flex min-h-12 min-w-12 items-center justify-center">
                {draft.logoUrl ? (
                  <img
                    src={draft.logoUrl}
                    alt=""
                    className="rounded object-contain"
                    style={{ width: draft.logoSize, height: draft.logoSize }}
                  />
                ) : (
                  <div className="flex h-12 w-12 items-center justify-center rounded-lg bg-primary text-primary-foreground">
                  <CalendarDays className="h-6 w-6" />
                  </div>
                )}
              </div>
              <div>
                <p className="text-xs font-semibold uppercase text-accent">{draft.businessType}</p>
                <h3 className="text-lg font-bold leading-tight">{draft.displayName}</h3>
              </div>
            </div>
            <p className="mt-4 text-sm text-muted-foreground">{draft.tagline}</p>
            <div className="mt-4 grid grid-cols-2 gap-2 text-xs">
              <div className="rounded-lg bg-primary/10 p-3 text-primary">
                {draft.professionalLabel}
                <strong className="mt-1 block text-lg text-foreground">8</strong>
              </div>
              <div className="rounded-lg bg-accent/15 p-3 text-accent-foreground">
                {draft.serviceLabel}
                <strong className="mt-1 block text-lg text-foreground">24</strong>
              </div>
            </div>
            <Button className="mt-4 w-full">Agendar agora</Button>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
