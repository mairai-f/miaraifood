import { type CSSProperties, useEffect, useState } from "react";
import { Facebook, ImagePlus, Instagram, Link2, MapPin, MessageCircle, Palette, Save, Users } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Slider } from "@/components/ui/slider";
import { Switch } from "@/components/ui/switch";
import { Textarea } from "@/components/ui/textarea";
import { useAgendaBranding, type AgendaBrandingSettings } from "@/hooks/useAgendaBranding";
import { useAuth } from "@/hooks/useAuth";
import { useToast } from "@/hooks/use-toast";
import { uploadAgendaBrandingImage } from "@/lib/agendaStorage";
import { buildAgendaPublicHomePath } from "@/lib/agendaPublicLink";

type ImageField = "logoUrl" | "heroImageUrl" | "aboutImageUrl" | "locationImageUrl";
type UploadKind = "logo" | "hero" | "about" | "location";

const imageFieldMap: Record<ImageField, UploadKind> = {
  logoUrl: "logo",
  heroImageUrl: "hero",
  aboutImageUrl: "about",
  locationImageUrl: "location",
};

const imageAccept = "image/*,.avif,.bmp,.gif,.heic,.heif,.ico,.jpg,.jpeg,.png,.svg,.tif,.tiff,.webp";

export function PublicPageSettingsTab() {
  const { settings, loading, updatePreview, saveSettings } = useAgendaBranding();
  const { user } = useAuth();
  const [draft, setDraft] = useState<AgendaBrandingSettings>(settings);
  const [editing, setEditing] = useState(false);
  const [saving, setSaving] = useState(false);
  const [uploadingField, setUploadingField] = useState<ImageField | null>(null);
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

  const handleUpload = async (field: ImageField, file: File | undefined) => {
    if (!file || !user?.id) return;
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

    toast({
      title: "Pagina publica salva",
      description: "Logo, textos, redes sociais e Pix da agenda foram atualizados.",
    });
    setEditing(false);
  };

  if (loading) {
    return <div className="py-10 text-center text-sm text-muted-foreground">Carregando configuracoes...</div>;
  }

  const publicUrl = `https://agenda.happycashsite.com.br${buildAgendaPublicHomePath(draft.slug)}`;

  return (
    <Card>
      <CardHeader>
        <CardTitle className="flex items-center gap-2 text-base">
          <Palette className="h-5 w-5" />
          Configuracoes da pagina publica
        </CardTitle>
        <CardDescription>
          Personalize a landing da sua empresa. Link publico:{" "}
          <span className="font-medium text-foreground">{publicUrl}</span>
        </CardDescription>
      </CardHeader>
      <CardContent className="grid gap-4 md:grid-cols-2">
        <ImageUploadField
          label="Logotipo"
          value={draft.logoUrl}
          uploading={uploadingField === "logoUrl"}
          onPick={(file) => void handleUpload("logoUrl", file)}
          imageStyle={{ objectFit: "contain" }}
        />
        <ImageUploadField
          label="Foto de fundo (hero)"
          value={draft.heroImageUrl}
          uploading={uploadingField === "heroImageUrl"}
          onPick={(file) => void handleUpload("heroImageUrl", file)}
          imageStyle={{
            objectPosition: `${draft.heroImagePositionX}% ${draft.heroImagePositionY}%`,
            transform: `scale(${draft.heroImageScale})`,
            transformOrigin: `${draft.heroImagePositionX}% ${draft.heroImagePositionY}%`,
          }}
        />
        <ImageUploadField
          label="Imagem sobre nos"
          value={draft.aboutImageUrl}
          uploading={uploadingField === "aboutImageUrl"}
          onPick={(file) => void handleUpload("aboutImageUrl", file)}
          imageStyle={{
            objectPosition: `${draft.aboutImagePositionX}% ${draft.aboutImagePositionY}%`,
            transform: `scale(${draft.aboutImageScale})`,
            transformOrigin: `${draft.aboutImagePositionX}% ${draft.aboutImagePositionY}%`,
          }}
        />

        <div className="space-y-3 rounded-lg border p-3">
          <p className="text-sm font-medium">Tamanho do logo</p>
          <SliderField
            label="Tamanho"
            value={draft.logoSize}
            min={24}
            max={64}
            step={1}
            onChange={(logoSize) => updateDraft({ logoSize })}
            format={(value) => `${Math.round(value)}px`}
          />
        </div>

        <ImagePositionControls
          title="Ajuste da foto de fundo"
          x={draft.heroImagePositionX}
          y={draft.heroImagePositionY}
          scale={draft.heroImageScale}
          onChange={(next) => updateDraft({
            heroImagePositionX: next.x ?? draft.heroImagePositionX,
            heroImagePositionY: next.y ?? draft.heroImagePositionY,
            heroImageScale: next.scale ?? draft.heroImageScale,
          })}
        />
        <ImagePositionControls
          title="Ajuste da imagem sobre nos"
          x={draft.aboutImagePositionX}
          y={draft.aboutImagePositionY}
          scale={draft.aboutImageScale}
          onChange={(next) => updateDraft({
            aboutImagePositionX: next.x ?? draft.aboutImagePositionX,
            aboutImagePositionY: next.y ?? draft.aboutImagePositionY,
            aboutImageScale: next.scale ?? draft.aboutImageScale,
          })}
        />

        <div className="space-y-2 md:col-span-2">
          <Label htmlFor="heroTitle">Titulo da pagina inicial</Label>
          <Input
            id="heroTitle"
            value={draft.heroTitle}
            onChange={(e) => updateDraft({ heroTitle: e.target.value })}
            placeholder={draft.displayName}
          />
        </div>
        <div className="space-y-2 md:col-span-2">
          <Label htmlFor="heroSubtitle">Subtitulo</Label>
          <Textarea
            id="heroSubtitle"
            value={draft.heroSubtitle || draft.tagline}
            onChange={(e) => updateDraft({ heroSubtitle: e.target.value })}
            rows={2}
          />
        </div>
        <div className="space-y-2 md:col-span-2">
          <Label htmlFor="closedMessage">Mensagem de fechado</Label>
          <Input
            id="closedMessage"
            value={draft.closedMessage}
            onChange={(e) => updateDraft({ closedMessage: e.target.value })}
          />
        </div>
        <div className="space-y-3 rounded-lg border p-3 md:col-span-2">
          <div className="flex items-center gap-2">
            <Users className="h-4 w-4 text-primary" />
            <p className="text-sm font-medium">Modo de atendimento</p>
          </div>
          <div className="grid gap-3 md:grid-cols-2">
            <div className="space-y-2">
              <Label htmlFor="serviceMode">Como a empresa atende</Label>
              <Select
                value={draft.serviceMode}
                onValueChange={(serviceMode: AgendaBrandingSettings["serviceMode"]) => updateDraft({ serviceMode })}
              >
                <SelectTrigger id="serviceMode">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="appointment">Somente agendamento</SelectItem>
                  <SelectItem value="walk_in">Somente ordem de chegada</SelectItem>
                  <SelectItem value="both">Agendamento e ordem de chegada</SelectItem>
                </SelectContent>
              </Select>
            </div>
            <div className="flex items-center justify-between gap-4 rounded-md border p-3">
              <div>
                <Label htmlFor="publicQueueVisible">Fila visivel para clientes logados</Label>
                <p className="text-xs text-muted-foreground">A fila aparece apenas depois do login.</p>
              </div>
              <Switch
                id="publicQueueVisible"
                checked={draft.publicQueueVisible}
                onCheckedChange={(publicQueueVisible) => updateDraft({ publicQueueVisible })}
              />
            </div>
          </div>
        </div>
        <div className="space-y-2 md:col-span-2">
          <Label htmlFor="aboutTitle">Titulo sobre nos</Label>
          <Input
            id="aboutTitle"
            value={draft.aboutTitle}
            onChange={(e) => updateDraft({ aboutTitle: e.target.value })}
          />
        </div>
        <div className="space-y-2 md:col-span-2">
          <Label htmlFor="aboutText">Texto sobre nos</Label>
          <Textarea
            id="aboutText"
            value={draft.aboutText}
            onChange={(e) => updateDraft({ aboutText: e.target.value })}
            rows={4}
          />
        </div>
        <div className="space-y-2">
          <Label htmlFor="address" className="flex items-center gap-1">
            <MapPin className="h-4 w-4" />
            Endereco
          </Label>
          <Input
            id="address"
            value={draft.address}
            onChange={(e) => updateDraft({ address: e.target.value })}
          />
        </div>
        <div className="space-y-2">
          <Label htmlFor="whatsapp" className="flex items-center gap-1">
            <MessageCircle className="h-4 w-4" />
            WhatsApp publico
          </Label>
          <Input
            id="whatsapp"
            value={draft.whatsapp}
            onChange={(e) => updateDraft({ whatsapp: e.target.value })}
            placeholder="(00) 00000-0000"
          />
        </div>
        <div className="space-y-2">
          <Label htmlFor="adminWhatsapp">WhatsApp do administrador</Label>
          <Input
            id="adminWhatsapp"
            value={draft.adminWhatsapp}
            onChange={(e) => updateDraft({ adminWhatsapp: e.target.value })}
            placeholder="Recebe confirmacao de todos os agendamentos"
          />
        </div>
        <div className="space-y-2">
          <Label htmlFor="facebookUrl" className="flex items-center gap-1">
            <Facebook className="h-4 w-4" />
            Facebook
          </Label>
          <Input
            id="facebookUrl"
            value={draft.facebookUrl}
            onChange={(e) => updateDraft({ facebookUrl: e.target.value })}
            placeholder="https://facebook.com/suaempresa"
          />
        </div>
        <div className="space-y-2">
          <Label htmlFor="instagramUrl" className="flex items-center gap-1">
            <Instagram className="h-4 w-4" />
            Instagram
          </Label>
          <Input
            id="instagramUrl"
            value={draft.instagramUrl}
            onChange={(e) => updateDraft({ instagramUrl: e.target.value })}
            placeholder="@suaempresa ou https://instagram.com/suaempresa"
          />
        </div>
        <div className="space-y-2">
          <Label htmlFor="pixKey">Chave Pix (QR do agendamento)</Label>
          <Input
            id="pixKey"
            value={draft.pixKey}
            onChange={(e) => updateDraft({ pixKey: e.target.value })}
            placeholder="CPF, CNPJ, e-mail ou telefone"
          />
        </div>
        <div className="space-y-2">
          <Label htmlFor="slug" className="flex items-center gap-1">
            <Link2 className="h-4 w-4" />
            Slug da URL
          </Label>
          <Input
            id="slug"
            value={draft.slug}
            onChange={(e) => updateDraft({ slug: e.target.value })}
          />
          <p className="text-xs text-muted-foreground">{publicUrl}</p>
        </div>

        <div className="md:col-span-2">
          <Button onClick={handleSave} disabled={saving} className="gap-2">
            <Save className="h-4 w-4" />
            {saving ? "Salvando..." : "Salvar pagina publica"}
          </Button>
        </div>
      </CardContent>
    </Card>
  );
}

function ImageUploadField({
  label,
  value,
  uploading,
  onPick,
  imageStyle,
}: {
  label: string;
  value: string;
  uploading: boolean;
  onPick: (file: File | undefined) => void;
  imageStyle?: CSSProperties;
}) {
  return (
    <div className="space-y-2 rounded-lg border p-3">
      <Label>{label}</Label>
      {value ? (
        <div className="h-24 w-full overflow-hidden rounded-md bg-muted">
          <img src={value} alt="" className="h-full w-full object-cover" style={imageStyle} />
        </div>
      ) : (
        <div className="flex h-24 items-center justify-center rounded-md bg-muted text-xs text-muted-foreground">
          Sem imagem
        </div>
      )}
      <Button type="button" variant="outline" size="sm" className="gap-2" disabled={uploading} asChild>
        <label>
          <ImagePlus className="h-4 w-4" />
          {uploading ? "Enviando..." : "Enviar imagem"}
          <input
            type="file"
            accept={imageAccept}
            className="hidden"
            onChange={(e) => {
              onPick(e.target.files?.[0]);
              e.currentTarget.value = "";
            }}
          />
        </label>
      </Button>
    </div>
  );
}

function ImagePositionControls({
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
      <SliderField label="Mover horizontal" value={x} min={0} max={100} step={1} onChange={(value) => onChange({ x: value })} />
      <SliderField label="Mover vertical" value={y} min={0} max={100} step={1} onChange={(value) => onChange({ y: value })} />
      <SliderField label="Tamanho" value={scale} min={1} max={2} step={0.01} onChange={(value) => onChange({ scale: value })} format={(value) => `${Math.round(value * 100)}%`} />
    </div>
  );
}

function SliderField({
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
