import { useEffect, useState } from "react";
import { Facebook, ImagePlus, Instagram, Pencil, Save, X } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Slider } from "@/components/ui/slider";
import { Textarea } from "@/components/ui/textarea";
import { useAuth } from "@/hooks/useAuth";
import { useAgendaBranding, type AgendaBrandingSettings } from "@/hooks/useAgendaBranding";
import { useToast } from "@/hooks/use-toast";
import { uploadAgendaBrandingImage } from "@/lib/agendaStorage";

type InlineImageField = "logoUrl" | "heroImageUrl" | "aboutImageUrl";
type UploadKind = "logo" | "hero" | "about";

const imageFieldMap: Record<InlineImageField, UploadKind> = {
  logoUrl: "logo",
  heroImageUrl: "hero",
  aboutImageUrl: "about",
};

const imageAccept = "image/*,.avif,.bmp,.gif,.heic,.heif,.ico,.jpg,.jpeg,.png,.svg,.tif,.tiff,.webp";

export function PublicPageInlineEditor() {
  const { user, isAdmin } = useAuth();
  const { settings, updatePreview, saveSettings } = useAgendaBranding();
  const [open, setOpen] = useState(false);
  const [draft, setDraft] = useState<AgendaBrandingSettings>(settings);
  const [initialDraft, setInitialDraft] = useState<AgendaBrandingSettings | null>(null);
  const [saving, setSaving] = useState(false);
  const [uploadingField, setUploadingField] = useState<InlineImageField | null>(null);
  const { toast } = useToast();

  useEffect(() => {
    if (!open) setDraft(settings);
  }, [open, settings]);

  if (!user || !isAdmin) return null;

  const updateDraft = (next: Partial<AgendaBrandingSettings>) => {
    const nextDraft = { ...draft, ...next };
    setDraft(nextDraft);
    updatePreview(nextDraft);
  };

  const openEditor = () => {
    setInitialDraft(settings);
    setDraft(settings);
    setOpen(true);
  };

  const closeEditor = () => {
    if (initialDraft) {
      updatePreview(initialDraft);
      setDraft(initialDraft);
    }
    setInitialDraft(null);
    setOpen(false);
  };

  const handleUpload = async (field: InlineImageField, file: File | undefined) => {
    if (!file) return;

    setUploadingField(field);
    const result = await uploadAgendaBrandingImage(user.id, file, imageFieldMap[field]);
    setUploadingField(null);

    if (result.error || !result.url) {
      toast({
        title: "Falha no upload",
        description: result.error || "Nao foi possivel enviar a imagem.",
        variant: "destructive",
      });
      return;
    }

    updateDraft({ [field]: result.url });
    toast({ title: "Imagem enviada" });
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

    toast({ title: "Pagina salva" });
    setInitialDraft(null);
    setOpen(false);
  };

  return (
    <>
      {!open && (
        <Button
          type="button"
          className="fixed bottom-24 right-4 z-[60] gap-2 rounded-full shadow-lg"
          onClick={openEditor}
        >
          <Pencil className="h-4 w-4" />
          Editar pagina
        </Button>
      )}

      {open && (
        <aside className="fixed bottom-4 right-4 top-20 z-[60] flex w-[min(390px,calc(100vw-2rem))] flex-col rounded-lg border bg-background/95 shadow-2xl backdrop-blur">
          <div className="flex items-center justify-between gap-3 border-b px-4 py-3">
            <div>
              <h2 className="text-sm font-semibold">Editar pagina publica</h2>
              <p className="text-xs text-muted-foreground">Os ajustes aparecem na pagina em tempo real.</p>
            </div>
            <Button type="button" variant="ghost" size="icon" onClick={closeEditor}>
              <X className="h-4 w-4" />
            </Button>
          </div>

          <div className="flex-1 space-y-4 overflow-y-auto p-4">
            <section className="space-y-3">
              <h3 className="text-xs font-semibold uppercase text-muted-foreground">Logo</h3>
              <div className="flex flex-wrap gap-2">
                <UploadButton
                  label={uploadingField === "logoUrl" ? "Enviando..." : "Trocar logo"}
                  disabled={uploadingField === "logoUrl"}
                  onPick={(file) => void handleUpload("logoUrl", file)}
                />
              </div>
              <SliderControl
                label="Tamanho do logo"
                value={draft.logoSize}
                min={24}
                max={64}
                step={1}
                onChange={(logoSize) => updateDraft({ logoSize })}
                format={(value) => `${Math.round(value)}px`}
              />
            </section>

            <section className="space-y-3">
              <h3 className="text-xs font-semibold uppercase text-muted-foreground">Inicio</h3>
              <div className="space-y-2">
                <Label htmlFor="inlineHeroTitle">Titulo principal</Label>
                <Input
                  id="inlineHeroTitle"
                  value={draft.heroTitle}
                  onChange={(event) => updateDraft({ heroTitle: event.target.value })}
                  placeholder={draft.displayName}
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="inlineHeroSubtitle">Subtitulo</Label>
                <Textarea
                  id="inlineHeroSubtitle"
                  value={draft.heroSubtitle || draft.tagline}
                  onChange={(event) => updateDraft({ heroSubtitle: event.target.value })}
                  rows={2}
                />
              </div>
              <UploadButton
                label={uploadingField === "heroImageUrl" ? "Enviando..." : "Trocar imagem principal"}
                disabled={uploadingField === "heroImageUrl"}
                onPick={(file) => void handleUpload("heroImageUrl", file)}
              />
              <ImageAdjuster
                title="Ajuste da imagem principal"
                x={draft.heroImagePositionX}
                y={draft.heroImagePositionY}
                scale={draft.heroImageScale}
                onChange={(next) => updateDraft({
                  heroImagePositionX: next.x ?? draft.heroImagePositionX,
                  heroImagePositionY: next.y ?? draft.heroImagePositionY,
                  heroImageScale: next.scale ?? draft.heroImageScale,
                })}
              />
            </section>

            <section className="space-y-3">
              <h3 className="text-xs font-semibold uppercase text-muted-foreground">Sobre</h3>
              <div className="space-y-2">
                <Label htmlFor="inlineAboutTitle">Titulo sobre</Label>
                <Input
                  id="inlineAboutTitle"
                  value={draft.aboutTitle}
                  onChange={(event) => updateDraft({ aboutTitle: event.target.value })}
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="inlineAboutText">Texto sobre</Label>
                <Textarea
                  id="inlineAboutText"
                  value={draft.aboutText}
                  onChange={(event) => updateDraft({ aboutText: event.target.value })}
                  rows={4}
                />
              </div>
              <UploadButton
                label={uploadingField === "aboutImageUrl" ? "Enviando..." : "Trocar imagem sobre"}
                disabled={uploadingField === "aboutImageUrl"}
                onPick={(file) => void handleUpload("aboutImageUrl", file)}
              />
              <ImageAdjuster
                title="Ajuste da imagem sobre"
                x={draft.aboutImagePositionX}
                y={draft.aboutImagePositionY}
                scale={draft.aboutImageScale}
                onChange={(next) => updateDraft({
                  aboutImagePositionX: next.x ?? draft.aboutImagePositionX,
                  aboutImagePositionY: next.y ?? draft.aboutImagePositionY,
                  aboutImageScale: next.scale ?? draft.aboutImageScale,
                })}
              />
            </section>

            <section className="space-y-3">
              <h3 className="text-xs font-semibold uppercase text-muted-foreground">Redes sociais</h3>
              <div className="space-y-2">
                <Label htmlFor="inlineFacebookUrl" className="flex items-center gap-1">
                  <Facebook className="h-4 w-4" />
                  Facebook
                </Label>
                <Input
                  id="inlineFacebookUrl"
                  value={draft.facebookUrl}
                  onChange={(event) => updateDraft({ facebookUrl: event.target.value })}
                  placeholder="https://facebook.com/suaempresa"
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="inlineInstagramUrl" className="flex items-center gap-1">
                  <Instagram className="h-4 w-4" />
                  Instagram
                </Label>
                <Input
                  id="inlineInstagramUrl"
                  value={draft.instagramUrl}
                  onChange={(event) => updateDraft({ instagramUrl: event.target.value })}
                  placeholder="@suaempresa"
                />
              </div>
            </section>
          </div>

          <div className="flex gap-2 border-t p-4">
            <Button type="button" variant="outline" onClick={closeEditor} className="flex-1">
              Cancelar
            </Button>
            <Button type="button" onClick={handleSave} disabled={saving} className="flex-1 gap-2">
              <Save className="h-4 w-4" />
              {saving ? "Salvando..." : "Salvar"}
            </Button>
          </div>
        </aside>
      )}
    </>
  );
}

function UploadButton({
  label,
  disabled,
  onPick,
}: {
  label: string;
  disabled: boolean;
  onPick: (file: File | undefined) => void;
}) {
  return (
    <Button type="button" variant="outline" size="sm" disabled={disabled} className="gap-2" asChild>
      <label>
        <ImagePlus className="h-4 w-4" />
        {label}
        <input
          type="file"
          accept={imageAccept}
          className="hidden"
          onChange={(event) => {
            onPick(event.target.files?.[0]);
            event.currentTarget.value = "";
          }}
        />
      </label>
    </Button>
  );
}

function ImageAdjuster({
  title,
  x,
  y,
  scale,
  onChange,
}: {
  title: string;
  x: number;
  y: number;
  scale: number;
  onChange: (next: { x?: number; y?: number; scale?: number }) => void;
}) {
  return (
    <div className="space-y-3 rounded-lg border p-3">
      <p className="text-sm font-medium">{title}</p>
      <SliderControl label="Horizontal" value={x} min={0} max={100} step={1} onChange={(value) => onChange({ x: value })} />
      <SliderControl label="Vertical" value={y} min={0} max={100} step={1} onChange={(value) => onChange({ y: value })} />
      <SliderControl label="Tamanho" value={scale} min={1} max={2} step={0.01} onChange={(value) => onChange({ scale: value })} format={(value) => `${Math.round(value * 100)}%`} />
    </div>
  );
}

function SliderControl({
  label,
  value,
  min,
  max,
  step,
  onChange,
  format = (nextValue) => `${Math.round(nextValue)}%`,
}: {
  label: string;
  value: number;
  min: number;
  max: number;
  step: number;
  onChange: (value: number) => void;
  format?: (value: number) => string;
}) {
  return (
    <div className="space-y-2">
      <div className="flex items-center justify-between gap-3">
        <Label className="text-xs text-muted-foreground">{label}</Label>
        <span className="text-xs font-medium">{format(value)}</span>
      </div>
      <Slider value={[value]} min={min} max={max} step={step} onValueChange={([nextValue]) => onChange(nextValue)} />
    </div>
  );
}
