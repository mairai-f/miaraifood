import { useEffect, useState } from "react";
import { ImagePlus, Link2, MapPin, MessageCircle, Palette, Save } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
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
  const [saving, setSaving] = useState(false);
  const [uploadingField, setUploadingField] = useState<ImageField | null>(null);
  const { toast } = useToast();

  useEffect(() => {
    setDraft(settings);
  }, [settings]);

  const updateDraft = (next: Partial<AgendaBrandingSettings>) => {
    const nextDraft = { ...draft, ...next };
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
      description: "Logo, textos e Pix da agenda foram atualizados.",
    });
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
        />
        <ImageUploadField
          label="Foto de fundo (hero)"
          value={draft.heroImageUrl}
          uploading={uploadingField === "heroImageUrl"}
          onPick={(file) => void handleUpload("heroImageUrl", file)}
        />
        <ImageUploadField
          label="Imagem sobre nos"
          value={draft.aboutImageUrl}
          uploading={uploadingField === "aboutImageUrl"}
          onPick={(file) => void handleUpload("aboutImageUrl", file)}
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
}: {
  label: string;
  value: string;
  uploading: boolean;
  onPick: (file: File | undefined) => void;
}) {
  return (
    <div className="space-y-2 rounded-lg border p-3">
      <Label>{label}</Label>
      {value ? (
        <img src={value} alt="" className="h-24 w-full rounded-md object-cover" />
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
