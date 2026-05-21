/**
 * Aba de Localizações do Painel Admin
 * - CRUD de localizações com Google Maps embed
 * - Admin define endereço e URL do mapa
 */

import { useState, useEffect } from "react";
import { Plus, Edit, Trash2, MapPin } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { useToast } from "@/hooks/use-toast";
import { supabase } from "@/integrations/supabase/client";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";

interface BusinessLocation {
  id: string;
  name: string;
  address: string;
  phone: string | null;
  google_maps_embed_url: string | null;
  is_active: boolean;
}

interface LocationsTabProps {
  isAdmin: boolean;
}

const normalizeEmbedUrl = (raw: string) => {
  const trimmed = raw.trim();
  // If the user pasted an iframe snippet, extract the src attribute
  const iframeMatch = trimmed.match(/<iframe[^>]+src=["']([^"']+)["']/i);
  if (iframeMatch) return iframeMatch[1];

  // Strip HTML tags if any were pasted
  const noTags = trimmed.replace(/<[^>]+>/g, "").trim();

  // Remove surrounding quotes
  return noTags.replace(/^['"]|['"]$/g, "");
};

export function LocationsTab({ isAdmin }: LocationsTabProps) {
  const [locations, setLocations] = useState<BusinessLocation[]>([]);
  const [loading, setLoading] = useState(true);
  const [showDialog, setShowDialog] = useState(false);
  const [editing, setEditing] = useState<BusinessLocation | null>(null);
  const [submitting, setSubmitting] = useState(false);

  const [name, setName] = useState("");
  const [address, setAddress] = useState("");
  const [phone, setPhone] = useState("");
  const [embedUrl, setEmbedUrl] = useState("");

  const { toast } = useToast();

  useEffect(() => {
    fetchLocations();
  }, []);

  const fetchLocations = async () => {
    const { data } = await supabase
      .from("business_locations")
      .select("*")
      .eq("is_active", true)
      .order("created_at");
    if (data) setLocations(data);
    setLoading(false);
  };

  const openDialog = (loc?: BusinessLocation) => {
    if (loc) {
      setEditing(loc);
      setName(loc.name);
      setAddress(loc.address);
      setPhone(loc.phone || "");
      setEmbedUrl(normalizeEmbedUrl(loc.google_maps_embed_url || ""));
    } else {
      setEditing(null);
      setName("");
      setAddress("");
      setPhone("");
      setEmbedUrl("");
    }
    setShowDialog(true);
  };

  const save = async () => {
    if (!name.trim() || !address.trim()) {
      toast({
        title: "Erro",
        description: "Nome e endereço são obrigatórios.",
        variant: "destructive",
      });
      return;
    }

    setSubmitting(true);

    const data = {
      name,
      address,
      phone: phone || null,
      google_maps_embed_url: normalizeEmbedUrl(embedUrl) || null,
    };

    if (editing) {
      const { error } = await supabase
        .from("business_locations")
        .update(data)
        .eq("id", editing.id);
      if (error) {
        toast({
          title: "Erro",
          description: "Não foi possível atualizar.",
          variant: "destructive",
        });
      } else {
        toast({ title: "Localização atualizada" });
      }
    } else {
      const { error } = await supabase.from("business_locations").insert(data);
      if (error) {
        toast({
          title: "Erro",
          description: "Não foi possível adicionar.",
          variant: "destructive",
        });
      } else {
        toast({ title: "Localização adicionada" });
      }
    }

    setSubmitting(false);
    setShowDialog(false);
    fetchLocations();
  };

  const remove = async (id: string) => {
    const { error } = await supabase
      .from("business_locations")
      .update({ is_active: false })
      .eq("id", id);
    if (!error) {
      toast({ title: "Localização removida" });
      fetchLocations();
    }
  };

  if (loading)
    return (
      <div className="text-center py-8 text-muted-foreground">
        Carregando...
      </div>
    );

  return (
    <div className="space-y-6">
      {isAdmin && (
        <Button onClick={() => openDialog()}>
          <Plus className="w-4 h-4 mr-2" /> Nova Localização
        </Button>
      )}

      {locations.length === 0 ? (
        <Card>
          <CardContent className="py-12 text-center">
            <MapPin className="w-12 h-12 mx-auto text-muted-foreground mb-4" />
            <h3 className="font-serif text-xl font-semibold mb-2">
              Nenhuma localização
            </h3>
            <p className="text-muted-foreground">
              {isAdmin
                ? "Adicione a localização do seu estabelecimento."
                : "Nenhuma localização cadastrada."}
            </p>
          </CardContent>
        </Card>
      ) : (
        locations.map((loc) => (
          <Card key={loc.id}>
            <CardHeader className="flex flex-row items-start justify-between gap-2">
              <div className="space-y-1">
                <CardTitle className="text-lg flex items-center gap-2">
                  <MapPin className="w-5 h-5 text-primary" />
                  {loc.name}
                </CardTitle>
                <p className="text-sm text-muted-foreground">{loc.address}</p>
                {loc.phone && (
                  <p className="text-sm text-muted-foreground">
                    📞 {loc.phone}
                  </p>
                )}
              </div>
              {isAdmin && (
                <div className="flex gap-1">
                  <Button
                    variant="ghost"
                    size="icon"
                    onClick={() => openDialog(loc)}
                  >
                    <Edit className="w-4 h-4" />
                  </Button>
                  <Button
                    variant="ghost"
                    size="icon"
                    onClick={() => remove(loc.id)}
                  >
                    <Trash2 className="w-4 h-4 text-destructive" />
                  </Button>
                </div>
              )}
            </CardHeader>
            {loc.google_maps_embed_url && (
              <CardContent>
                <div className="rounded-lg overflow-hidden border border-border">
                  <iframe
                    src={loc.google_maps_embed_url}
                    width="100%"
                    height="300"
                    style={{ border: 0 }}
                    allowFullScreen
                    loading="lazy"
                    referrerPolicy="no-referrer-when-downgrade"
                    title={`Mapa - ${loc.name}`}
                  />
                </div>
              </CardContent>
            )}
          </Card>
        ))
      )}

      {/* Dialog */}
      <Dialog open={showDialog} onOpenChange={setShowDialog}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>
              {editing ? "Editar Localização" : "Nova Localização"}
            </DialogTitle>
            <DialogDescription>
              Para obter a URL do mapa, vá ao Google Maps, pesquise o endereço,
              clique em "Compartilhar" → "Incorporar um mapa" e copie a URL do
              src do iframe.
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-4">
            <div>
              <Label>Nome da unidade</Label>
              <Input
                value={name}
                onChange={(e) => setName(e.target.value)}
                placeholder="Ex: Unidade Centro"
              />
            </div>
            <div>
              <Label>Endereço</Label>
              <Input
                value={address}
                onChange={(e) => setAddress(e.target.value)}
                placeholder="Rua, número, bairro, cidade"
              />
            </div>
            <div>
              <Label>Telefone (opcional)</Label>
              <Input
                value={phone}
                onChange={(e) => setPhone(e.target.value)}
                placeholder="(11) 99999-9999"
              />
            </div>
            <div>
              <Label>URL Google Maps Embed</Label>
              <Input
                value={embedUrl}
                onChange={(e) => setEmbedUrl(e.target.value)}
                placeholder="https://www.google.com/maps/embed?pb=..."
              />
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setShowDialog(false)}>
              Cancelar
            </Button>
            <Button onClick={save} disabled={submitting}>
              {submitting ? "Salvando..." : "Salvar"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
