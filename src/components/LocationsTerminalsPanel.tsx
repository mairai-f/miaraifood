import { useCallback, useEffect, useMemo, useState, type FormEvent } from 'react';
import { Building2, Loader2, MapPin, MonitorSmartphone, Plus } from 'lucide-react';
import { toast } from 'sonner';
import { useAuth } from '@/contexts/AuthContext';
import { usePermissions } from '@/contexts/usePermissions';
import { supabase } from '@/integrations/supabase/client';
import {
  isValidStoreScopeCode,
  normalizeStoreScopeCode,
  posTerminalTypeLabels,
  storeLocationTypeLabels,
  type PosTerminalType,
  type StoreLocationType,
} from '@/lib/storeScope';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Dialog, DialogContent, DialogFooter, DialogHeader, DialogTitle, DialogTrigger } from '@/components/ui/dialog';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Switch } from '@/components/ui/switch';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { getRedactedLogValue } from '../../shared/security/redaction';

interface StoreLocationRow {
  id: string;
  store_account_id: string;
  owner_user_id: string;
  code: string;
  name: string;
  location_type: StoreLocationType;
  is_headquarters: boolean;
  active: boolean;
}
interface PosTerminalRow {
  id: string;
  store_account_id: string;
  owner_user_id: string;
  location_id: string;
  code: string;
  name: string;
  terminal_type: PosTerminalType;
  installation_id: string | null;
  active: boolean;
  last_seen_at: string | null;
}

/** Painel Web; filiais e terminais nao entram no bundle operacional do Electron. */
export function LocationsTerminalsPanel() {
  const { isAdmin, ownerUserId } = useAuth();
  const { hasPermission } = usePermissions();
  const [storeAccountId, setStoreAccountId] = useState('');
  const [locations, setLocations] = useState<StoreLocationRow[]>([]);
  const [terminals, setTerminals] = useState<PosTerminalRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [locationDialogOpen, setLocationDialogOpen] = useState(false);
  const [terminalDialogOpen, setTerminalDialogOpen] = useState(false);
  const [locationName, setLocationName] = useState('');
  const [locationCode, setLocationCode] = useState('');
  const [locationType, setLocationType] = useState<StoreLocationType>('branch');
  const [terminalName, setTerminalName] = useState('');
  const [terminalCode, setTerminalCode] = useState('');
  const [terminalType, setTerminalType] = useState<PosTerminalType>('desktop');
  const [terminalLocationId, setTerminalLocationId] = useState('');

  const canManageMultiStore = isAdmin && hasPermission('multi_store.manage');

  const loadData = useCallback(async () => {
    if (!ownerUserId || !canManageMultiStore) {
      setLoading(false);
      return;
    }

    setLoading(true);
    try {
      // Tipos gerados serao atualizados depois da aplicacao da migracao.
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      const db = supabase as any;
      const { data: accountId, error: accountError } = await db.rpc(
        'get_current_store_account_id_for_context',
        { target_context: 'happycash' },
      );
      if (accountError || !accountId) throw accountError ?? new Error('Empresa HappyCash nao encontrada.');

      const [locationsResult, terminalsResult] = await Promise.all([
        db.from('store_locations').select('*').eq('store_account_id', accountId).order('is_headquarters', { ascending: false }).order('name'),
        db.from('pos_terminals').select('*').eq('store_account_id', accountId).order('name'),
      ]);
      if (locationsResult.error) throw locationsResult.error;
      if (terminalsResult.error) throw terminalsResult.error;

      const nextLocations = (locationsResult.data ?? []) as StoreLocationRow[];
      setStoreAccountId(accountId as string);
      setLocations(nextLocations);
      setTerminals((terminalsResult.data ?? []) as PosTerminalRow[]);
      setTerminalLocationId((current) =>
        current || nextLocations.find((location) => location.active)?.id || '',
      );
    } catch (error) {
      console.error('Erro ao carregar filiais e terminais:', getRedactedLogValue(error));
      toast.error('Nao foi possivel carregar filiais e terminais. Aplique a migracao da Fase 2.');
      setLocations([]);
      setTerminals([]);
    } finally {
      setLoading(false);
    }
  }, [canManageMultiStore, ownerUserId]);

  useEffect(() => {
    void loadData();
  }, [loadData]);

  const locationNameById = useMemo(
    () => new Map(locations.map((location) => [location.id, location.name])),
    [locations],
  );

  const resetLocationForm = () => {
    setLocationName('');
    setLocationCode('');
    setLocationType('branch');
  };

  const resetTerminalForm = () => {
    setTerminalName('');
    setTerminalCode('');
    setTerminalType('desktop');
    setTerminalLocationId(locations.find((location) => location.active)?.id || '');
  };

  const handleCreateLocation = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    const normalizedCode = normalizeStoreScopeCode(locationCode);
    if (!locationName.trim() || !isValidStoreScopeCode(normalizedCode)) {
      toast.error('Informe nome e codigo valido para a filial.');
      return;
    }

    setSaving(true);
    try {
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      const { error } = await (supabase as any).from('store_locations').insert({
        store_account_id: storeAccountId,
        owner_user_id: ownerUserId,
        code: normalizedCode,
        name: locationName.trim(),
        location_type: locationType,
        is_headquarters: false,
      });
      if (error) throw error;
      resetLocationForm();
      setLocationDialogOpen(false);
      await loadData();
      toast.success('Filial cadastrada. Agora vincule pelo menos um terminal.');
    } catch (error) {
      console.error('Erro ao criar filial:', getRedactedLogValue(error));
      toast.error('Nao foi possivel cadastrar a filial. Verifique se o codigo ja existe.');
    } finally {
      setSaving(false);
    }
  };

  const handleCreateTerminal = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    const normalizedCode = normalizeStoreScopeCode(terminalCode);
    if (!terminalName.trim() || !terminalLocationId || !isValidStoreScopeCode(normalizedCode)) {
      toast.error('Informe filial, nome e codigo valido para o terminal.');
      return;
    }

    setSaving(true);
    try {
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      const { error } = await (supabase as any).from('pos_terminals').insert({
        store_account_id: storeAccountId,
        owner_user_id: ownerUserId,
        location_id: terminalLocationId,
        code: normalizedCode,
        name: terminalName.trim(),
        terminal_type: terminalType,
      });
      if (error) throw error;
      resetTerminalForm();
      setTerminalDialogOpen(false);
      await loadData();
      toast.success('Terminal cadastrado.');
    } catch (error) {
      console.error('Erro ao criar terminal:', getRedactedLogValue(error));
      toast.error('Nao foi possivel cadastrar o terminal. Verifique se o codigo ja existe.');
    } finally {
      setSaving(false);
    }
  };

  const updateActiveState = async (table: 'store_locations' | 'pos_terminals', id: string, active: boolean) => {
    try {
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      const { error } = await (supabase as any).from(table).update({ active }).eq('id', id);
      if (error) throw error;
      await loadData();
      toast.success(active ? 'Registro ativado.' : 'Registro desativado.');
    } catch (error) {
      console.error('Erro ao alterar status operacional:', getRedactedLogValue(error));
      toast.error('Nao foi possivel alterar o status.');
    }
  };

  if (!canManageMultiStore) return null;

  return (
    <Card>
      <CardHeader className="space-y-3">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <div>
            <CardTitle className="flex items-center gap-2 text-base">
              <Building2 className="h-4 w-4 text-primary" /> Filiais e terminais
            </CardTitle>
            <p className="mt-2 text-sm text-muted-foreground">
              A empresa e a assinatura continuam unicas; cada operacao passa a informar onde e em qual terminal aconteceu.
            </p>
          </div>
          <Badge variant="outline">Somente Web</Badge>
        </div>
      </CardHeader>
      <CardContent className="space-y-6">
        {loading ? (
          <div className="flex items-center gap-2 py-8 text-sm text-muted-foreground">
            <Loader2 className="h-4 w-4 animate-spin" /> Carregando estrutura operacional...
          </div>
        ) : (
          <>
            <section className="space-y-3" aria-labelledby="locations-title">
              <div className="flex flex-wrap items-center justify-between gap-2">
                <div>
                  <h3 id="locations-title" className="flex items-center gap-2 text-sm font-semibold">
                    <MapPin className="h-4 w-4 text-primary" /> Locais
                  </h3>
                  <p className="text-xs text-muted-foreground">Matriz, filiais e depositos.</p>
                </div>
                <Dialog open={locationDialogOpen} onOpenChange={(open) => {
                  setLocationDialogOpen(open);
                  if (!open) resetLocationForm();
                }}>
                  <DialogTrigger asChild>
                    <Button type="button" size="sm"><Plus className="mr-1 h-4 w-4" />Nova filial</Button>
                  </DialogTrigger>
                  <DialogContent>
                    <form onSubmit={handleCreateLocation}>
                      <DialogHeader><DialogTitle>Cadastrar filial ou deposito</DialogTitle></DialogHeader>
                      <div className="space-y-4 py-4">
                        <div className="space-y-1"><Label htmlFor="location-name">Nome</Label><Input id="location-name" value={locationName} onChange={(event) => setLocationName(event.target.value)} placeholder="Filial Centro" /></div>
                        <div className="space-y-1"><Label htmlFor="location-code">Codigo</Label><Input id="location-code" value={locationCode} onChange={(event) => setLocationCode(normalizeStoreScopeCode(event.target.value))} placeholder="CENTRO" maxLength={32} /></div>
                        <div className="space-y-1">
                          <Label>Tipo</Label>
                          <Select value={locationType} onValueChange={(value) => setLocationType(value as StoreLocationType)}>
                            <SelectTrigger><SelectValue /></SelectTrigger>
                            <SelectContent>
                              <SelectItem value="branch">Filial</SelectItem>
                              <SelectItem value="warehouse">Deposito</SelectItem>
                            </SelectContent>
                          </Select>
                        </div>
                      </div>
                      <DialogFooter><Button type="submit" disabled={saving}>{saving ? 'Salvando...' : 'Cadastrar filial'}</Button></DialogFooter>
                    </form>
                  </DialogContent>
                </Dialog>
              </div>
              <div className="overflow-x-auto rounded-lg border">
                <Table>
                  <TableHeader><TableRow><TableHead>Local</TableHead><TableHead>Tipo</TableHead><TableHead>Codigo</TableHead><TableHead className="text-right">Ativo</TableHead></TableRow></TableHeader>
                  <TableBody>
                    {locations.map((location) => (
                      <TableRow key={location.id}>
                        <TableCell className="font-medium">{location.name}{location.is_headquarters && <Badge className="ml-2">Principal</Badge>}</TableCell>
                        <TableCell>{storeLocationTypeLabels[location.location_type]}</TableCell>
                        <TableCell className="font-mono text-xs">{location.code}</TableCell>
                        <TableCell className="text-right"><Switch aria-label={`Ativar ${location.name}`} checked={location.active} disabled={location.is_headquarters} onCheckedChange={(active) => void updateActiveState('store_locations', location.id, active)} /></TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              </div>
            </section>

            <section className="space-y-3" aria-labelledby="terminals-title">
              <div className="flex flex-wrap items-center justify-between gap-2">
                <div>
                  <h3 id="terminals-title" className="flex items-center gap-2 text-sm font-semibold">
                    <MonitorSmartphone className="h-4 w-4 text-primary" /> Terminais
                  </h3>
                  <p className="text-xs text-muted-foreground">Desktop ativado e reconhecido automaticamente.</p>
                </div>
                <Dialog open={terminalDialogOpen} onOpenChange={(open) => {
                  setTerminalDialogOpen(open);
                  if (!open) resetTerminalForm();
                }}>
                  <DialogTrigger asChild><Button type="button" size="sm" variant="outline"><Plus className="mr-1 h-4 w-4" />Novo terminal</Button></DialogTrigger>
                  <DialogContent>
                    <form onSubmit={handleCreateTerminal}>
                      <DialogHeader><DialogTitle>Cadastrar terminal</DialogTitle></DialogHeader>
                      <div className="space-y-4 py-4">
                        <div className="space-y-1">
                          <Label>Filial</Label>
                          <Select value={terminalLocationId} onValueChange={setTerminalLocationId}>
                            <SelectTrigger><SelectValue placeholder="Selecione" /></SelectTrigger>
                            <SelectContent>{locations.filter((location) => location.active).map((location) => <SelectItem key={location.id} value={location.id}>{location.name}</SelectItem>)}</SelectContent>
                          </Select>
                        </div>
                        <div className="space-y-1"><Label htmlFor="terminal-name">Nome</Label><Input id="terminal-name" value={terminalName} onChange={(event) => setTerminalName(event.target.value)} placeholder="Caixa 01" /></div>
                        <div className="space-y-1"><Label htmlFor="terminal-code">Codigo</Label><Input id="terminal-code" value={terminalCode} onChange={(event) => setTerminalCode(normalizeStoreScopeCode(event.target.value))} placeholder="CX-01" maxLength={32} /></div>
                        <div className="space-y-1">
                          <Label>Tipo</Label>
                          <Select value={terminalType} onValueChange={(value) => setTerminalType(value as PosTerminalType)}>
                            <SelectTrigger><SelectValue /></SelectTrigger>
                            <SelectContent>{Object.entries(posTerminalTypeLabels).map(([value, label]) => <SelectItem key={value} value={value}>{label}</SelectItem>)}</SelectContent>
                          </Select>
                        </div>
                      </div>
                      <DialogFooter><Button type="submit" disabled={saving}>{saving ? 'Salvando...' : 'Cadastrar terminal'}</Button></DialogFooter>
                    </form>
                  </DialogContent>
                </Dialog>
              </div>
              <div className="overflow-x-auto rounded-lg border">
                <Table>
                  <TableHeader><TableRow><TableHead>Terminal</TableHead><TableHead>Filial</TableHead><TableHead>Tipo</TableHead><TableHead>Vinculo</TableHead><TableHead className="text-right">Ativo</TableHead></TableRow></TableHeader>
                  <TableBody>
                    {terminals.map((terminal) => (
                      <TableRow key={terminal.id}>
                        <TableCell><p className="font-medium">{terminal.name}</p><p className="font-mono text-xs text-muted-foreground">{terminal.code}</p></TableCell>
                        <TableCell>{locationNameById.get(terminal.location_id) ?? 'Filial removida'}</TableCell>
                        <TableCell>{posTerminalTypeLabels[terminal.terminal_type]}</TableCell>
                        <TableCell>{terminal.installation_id ? <Badge variant="secondary">Desktop vinculado</Badge> : <span className="text-xs text-muted-foreground">Manual</span>}</TableCell>
                        <TableCell className="text-right"><Switch aria-label={`Ativar ${terminal.name}`} checked={terminal.active} disabled={terminal.code === 'LEGACY'} onCheckedChange={(active) => void updateActiveState('pos_terminals', terminal.id, active)} /></TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              </div>
            </section>
          </>
        )}
      </CardContent>
    </Card>
  );
}
