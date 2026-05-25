/**
 * Aba de Clientes do Painel Admin
 * - CRUD de clientes manuais
 * - Listagem com busca
 */

import { useCallback, useEffect, useState } from "react";
import { Plus, Edit, Trash2, Users, Search, Phone, Mail } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { useToast } from "@/hooks/use-toast";
import { useAgendaBranding } from "@/hooks/useAgendaBranding";
import { supabase } from "@/integrations/supabase/client";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";

interface Client {
  id: string;
  store_account_id: string;
  owner_user_id: string;
  name: string;
  phone: string | null;
  email: string | null;
  notes: string | null;
  created_at: string;
}

export function ClientsTab() {
  const [clients, setClients] = useState<Client[]>([]);
  const [loading, setLoading] = useState(true);
  const [searchTerm, setSearchTerm] = useState("");
  const [showDialog, setShowDialog] = useState(false);
  const [editing, setEditing] = useState<Client | null>(null);
  const [submitting, setSubmitting] = useState(false);
  const [deleteTarget, setDeleteTarget] = useState<Client | null>(null);

  const [name, setName] = useState("");
  const [phone, setPhone] = useState("");
  const [email, setEmail] = useState("");
  const [notes, setNotes] = useState("");

  const { toast } = useToast();
  const { settings } = useAgendaBranding();

  const fetchClients = useCallback(async () => {
    if (!settings.storeAccountId) {
      setClients([]);
      setLoading(false);
      return;
    }

    const { data } = await supabase
      .from("agenda_clients")
      .select("*")
      .eq("store_account_id", settings.storeAccountId)
      .order("name");
    if (data) setClients(data);
    setLoading(false);
  }, [settings.storeAccountId]);

  useEffect(() => {
    if (!settings.storeAccountId) {
      setClients([]);
      setLoading(false);
      return;
    }

    void fetchClients();

    const channel = supabase
      .channel(`agenda:clients:${settings.storeAccountId}`)
      .on(
        "postgres_changes",
        {
          event: "*",
          schema: "public",
          table: "agenda_clients",
          filter: `store_account_id=eq.${settings.storeAccountId}`,
        },
        (payload) => {
          if (payload.eventType === "INSERT" && payload.new) {
            setClients((prev) => {
              const incoming = payload.new as Client;
              return prev.some((c) => c.id === incoming.id)
                ? prev
                : [incoming, ...prev];
            });
          }
          if (payload.eventType === "UPDATE" && payload.new) {
            setClients((prev) =>
              prev.map((c) =>
                c.id === (payload.new as Client).id
                  ? (payload.new as Client)
                  : c,
              ),
            );
          }
          if (payload.eventType === "DELETE" && payload.old) {
            setClients((prev) =>
              prev.filter((c) => c.id !== (payload.old as Client).id),
            );
          }
        },
      )
      .subscribe();

    return () => {
      supabase.removeChannel(channel);
    };
  }, [fetchClients, settings.storeAccountId]);

  const openDialog = (client?: Client) => {
    if (client) {
      setEditing(client);
      setName(client.name);
      setPhone(client.phone || "");
      setEmail(client.email || "");
      setNotes(client.notes || "");
    } else {
      setEditing(null);
      setName("");
      setPhone("");
      setEmail("");
      setNotes("");
    }
    setShowDialog(true);
  };

  const save = async () => {
    if (!name.trim()) {
      toast({
        title: "Erro",
        description: "Nome é obrigatório.",
        variant: "destructive",
      });
      return;
    }

    setSubmitting(true);

    const data = {
      name: name.trim(),
      phone: phone || "",
      email: email || null,
      notes: notes || null,
    };

    if (editing) {
      const { error } = await supabase
        .from("agenda_clients")
        .update(data)
        .eq("id", editing.id);
      if (error) {
        toast({
          title: "Erro",
          description: "Não foi possível atualizar.",
          variant: "destructive",
        });
      } else {
        toast({ title: "Cliente atualizado" });
      }
    } else {
      const { error } = await supabase.from("agenda_clients").insert(data);
      if (error) {
        toast({
          title: "Erro",
          description: "Não foi possível adicionar.",
          variant: "destructive",
        });
      } else {
        toast({ title: "Cliente adicionado" });
      }
    }

    setSubmitting(false);
    setShowDialog(false);
    fetchClients();
  };

  const confirmRemove = async () => {
    if (!deleteTarget) return;
    const { error } = await supabase
      .from("agenda_clients")
      .delete()
      .eq("id", deleteTarget.id);
    if (!error) {
      toast({ title: "Cliente removido" });
      fetchClients();
    } else {
      toast({
        title: "Erro",
        description: "Não foi possível remover.",
        variant: "destructive",
      });
    }
    setDeleteTarget(null);
  };

  const filtered = clients.filter(
    (c) =>
      c.name.toLowerCase().includes(searchTerm.toLowerCase()) ||
      c.phone?.toLowerCase().includes(searchTerm.toLowerCase()) ||
      c.email?.toLowerCase().includes(searchTerm.toLowerCase()),
  );

  if (loading)
    return (
      <div className="text-center py-8 text-muted-foreground">
        Carregando...
      </div>
    );

  return (
    <div className="space-y-6">
      <div className="flex flex-col sm:flex-row gap-3 justify-between">
        <div className="relative flex-1 max-w-sm">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
          <Input
            placeholder="Buscar cliente..."
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
            className="pl-9"
          />
        </div>
        <Button onClick={() => openDialog()}>
          <Plus className="w-4 h-4 mr-2" /> Novo Cliente
        </Button>
      </div>

      {filtered.length === 0 ? (
        <Card>
          <CardContent className="py-12 text-center">
            <Users className="w-12 h-12 mx-auto text-muted-foreground mb-4" />
            <h3 className="font-serif text-xl font-semibold mb-2">
              Nenhum cliente
            </h3>
            <p className="text-muted-foreground">
              {searchTerm
                ? "Nenhum cliente encontrado."
                : "Cadastre seus clientes para usar nas metas de fidelidade."}
            </p>
          </CardContent>
        </Card>
      ) : (
        <Card>
          <CardContent className="p-0">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Nome</TableHead>
                  <TableHead className="hidden sm:table-cell">
                    Telefone
                  </TableHead>
                  <TableHead className="hidden md:table-cell">Email</TableHead>
                  <TableHead className="w-[100px]">Ações</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {filtered.map((client) => (
                  <TableRow key={client.id}>
                    <TableCell className="font-medium">
                      {client.name}
                      {client.phone && (
                        <span className="block sm:hidden text-xs text-muted-foreground mt-0.5">
                          {client.phone}
                        </span>
                      )}
                    </TableCell>
                    <TableCell className="hidden sm:table-cell">
                      {client.phone || "—"}
                    </TableCell>
                    <TableCell className="hidden md:table-cell">
                      {client.email || "—"}
                    </TableCell>
                    <TableCell>
                      <div className="flex gap-1">
                        <Button
                          variant="ghost"
                          size="icon"
                          onClick={() => openDialog(client)}
                        >
                          <Edit className="w-4 h-4" />
                        </Button>
                        <Button
                          variant="ghost"
                          size="icon"
                          onClick={() => setDeleteTarget(client)}
                        >
                          <Trash2 className="w-4 h-4 text-destructive" />
                        </Button>
                      </div>
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </CardContent>
        </Card>
      )}

      <Dialog open={showDialog} onOpenChange={setShowDialog}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>
              {editing ? "Editar Cliente" : "Novo Cliente"}
            </DialogTitle>
            <DialogDescription>
              Cadastre os dados do cliente para uso nas metas de fidelidade e
              agendamentos.
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-4">
            <div>
              <Label>Nome *</Label>
              <Input
                value={name}
                onChange={(e) => setName(e.target.value)}
                placeholder="Nome completo"
              />
            </div>
            <div>
              <Label>Telefone</Label>
              <Input
                value={phone}
                onChange={(e) => setPhone(e.target.value)}
                placeholder="(11) 99999-9999"
              />
            </div>
            <div>
              <Label>Email</Label>
              <Input
                type="email"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                placeholder="email@exemplo.com"
              />
            </div>
            <div>
              <Label>Observações</Label>
              <Textarea
                value={notes}
                onChange={(e) => setNotes(e.target.value)}
                placeholder="Anotações sobre o cliente..."
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

      <AlertDialog
        open={!!deleteTarget}
        onOpenChange={(open) => !open && setDeleteTarget(null)}
      >
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Excluir cliente</AlertDialogTitle>
            <AlertDialogDescription>
              Tem certeza que deseja excluir{" "}
              <strong>{deleteTarget?.name}</strong>? Esta ação não pode ser
              desfeita.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancelar</AlertDialogCancel>
            <AlertDialogAction
              onClick={confirmRemove}
              className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
            >
              Excluir
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
}
