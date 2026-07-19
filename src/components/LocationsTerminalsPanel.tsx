import { useCallback, useEffect, useMemo, useState, type FormEvent } from 'react';
import { ArrowRightLeft, Building2, Edit, Loader2, MapPin, MonitorSmartphone, Plus, Search, Trash2 } from 'lucide-react';
import { toast } from 'sonner';
import { useAuth } from '@/contexts/AuthContext';
import { useData } from '@/contexts/DataContext';
import { useOperationalScope } from '@/contexts/useOperationalScope';
import { usePermissions } from '@/contexts/usePermissions';
import { supabase } from '@/integrations/supabase/client';
import { verifyStoreAdminApproval } from '@/lib/adminApproval';
import { filterProductsBySearch } from '@/lib/productSearch';
import { parseDecimalInput } from '@/lib/numberInput';
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
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle, DialogTrigger } from '@/components/ui/dialog';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { PasswordInput } from '@/components/ui/password-input';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Switch } from '@/components/ui/switch';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { getRedactedLogValue, maskEmail } from '../../shared/security/redaction';

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
  current_user_id?: string | null;
  current_username?: string | null;
  current_email?: string | null;
  current_user_role?: string | null;
  current_session_started_at?: string | null;
  current_session_seen_at?: string | null;
}

type PendingDeleteAction =
  | { type: 'location'; location: StoreLocationRow }
  | { type: 'terminal'; terminal: PosTerminalRow };

const TERMINAL_ACTIVE_WINDOW_MS = 10 * 60_000;

const terminalUserRoleLabel: Record<string, string> = {
  admin: 'Administrador',
  operator: 'Operador',
  waiter: 'Garcom',
  hr: 'RH',
};

const parseTimestamp = (value?: string | null) => {
  if (!value) return null;
  const parsed = new Date(value).getTime();
  return Number.isFinite(parsed) ? parsed : null;
};

const getTerminalSeenAt = (terminal: PosTerminalRow) =>
  terminal.current_session_seen_at || terminal.last_seen_at;

const isTerminalOnline = (terminal: PosTerminalRow) => {
  if (!terminal.active) return false;
  const seenAt = parseTimestamp(getTerminalSeenAt(terminal));
  return Boolean(seenAt && Date.now() - seenAt <= TERMINAL_ACTIVE_WINDOW_MS);
};

const formatTerminalSeenAt = (terminal: PosTerminalRow) => {
  const seenAt = parseTimestamp(getTerminalSeenAt(terminal));
  if (!seenAt) return 'Sem atividade';

  const elapsedMinutes = Math.max(0, Math.floor((Date.now() - seenAt) / 60_000));
  if (elapsedMinutes < 1) return 'Agora';
  if (elapsedMinutes < 60) return `${elapsedMinutes} min atras`;

  const elapsedHours = Math.floor(elapsedMinutes / 60);
  if (elapsedHours < 24) return `${elapsedHours} h atras`;

  return `${Math.floor(elapsedHours / 24)} d atras`;
};

const getTerminalUserName = (terminal: PosTerminalRow) =>
  terminal.current_username || maskEmail(terminal.current_email) || (terminal.current_user_id ? 'Usuario identificado' : null);

/** Painel Web; filiais e terminais nao entram no bundle operacional do Electron. */
export function LocationsTerminalsPanel() {
  const { ownerUserId, session } = useAuth();
  const { products, syncNow } = useData();
  const { refreshOperationalScope } = useOperationalScope();
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
  const [terminalEditingId, setTerminalEditingId] = useState('');
  const [transferDialogOpen, setTransferDialogOpen] = useState(false);
  const [transferSourceLocationId, setTransferSourceLocationId] = useState('');
  const [transferTargetLocationId, setTransferTargetLocationId] = useState('');
  const [transferProductId, setTransferProductId] = useState('');
  const [transferProductSearch, setTransferProductSearch] = useState('');
  const [transferQuantity, setTransferQuantity] = useState('');
  const [transferReason, setTransferReason] = useState('Transferencia entre filiais');
  const [transferring, setTransferring] = useState(false);
  const [pendingDeleteAction, setPendingDeleteAction] = useState<PendingDeleteAction | null>(null);
  const [deleteAuthorizationOpen, setDeleteAuthorizationOpen] = useState(false);
  const [deleteAuthorizationEmail, setDeleteAuthorizationEmail] = useState('');
  const [deleteAuthorizationPassword, setDeleteAuthorizationPassword] = useState('');
  const [deleteAuthorizationError, setDeleteAuthorizationError] = useState('');
  const [deleteSubmitting, setDeleteSubmitting] = useState(false);

  const canManageMultiStore = hasPermission('multi_store.manage');

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
  const activeLocations = useMemo(
    () => locations.filter((location) => location.active),
    [locations],
  );
  const terminalsByLocation = useMemo(() => {
    const counts = new Map<string, number>();
    terminals.forEach((terminal) => {
      counts.set(terminal.location_id, (counts.get(terminal.location_id) ?? 0) + 1);
    });
    return counts;
  }, [terminals]);
  const activeProducts = useMemo(
    () => products.filter((product) => !product.deleted),
    [products],
  );
  const selectedTransferProduct = useMemo(
    () => activeProducts.find((product) => product.id === transferProductId) ?? null,
    [activeProducts, transferProductId],
  );
  const transferProductResults = useMemo(
    () => transferProductSearch.trim() && !selectedTransferProduct
      ? filterProductsBySearch(activeProducts, transferProductSearch).slice(0, 8)
      : [],
    [activeProducts, selectedTransferProduct, transferProductSearch],
  );

  useEffect(() => {
    if (activeLocations.length === 0) return;
    setTransferSourceLocationId((current) => current || activeLocations[0]?.id || '');
    setTransferTargetLocationId((current) => current || activeLocations.find((location) => location.id !== activeLocations[0]?.id)?.id || '');
  }, [activeLocations]);

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
    setTerminalEditingId('');
  };

  const openTerminalEdit = (terminal: PosTerminalRow) => {
    setTerminalEditingId(terminal.id);
    setTerminalLocationId(terminal.location_id);
    setTerminalName(terminal.name);
    setTerminalCode(terminal.code);
    setTerminalType(terminal.terminal_type);
    setTerminalDialogOpen(true);
  };

  const resetTransferForm = () => {
    setTransferSourceLocationId(activeLocations[0]?.id || '');
    setTransferTargetLocationId(activeLocations.find((location) => location.id !== activeLocations[0]?.id)?.id || '');
    setTransferProductId('');
    setTransferProductSearch('');
    setTransferQuantity('');
    setTransferReason('Transferencia entre filiais');
  };

  const resetDeleteAuthorization = () => {
    setPendingDeleteAction(null);
    setDeleteAuthorizationOpen(false);
    setDeleteAuthorizationEmail('');
    setDeleteAuthorizationPassword('');
    setDeleteAuthorizationError('');
  };

  const requestDeleteLocation = (location: StoreLocationRow) => {
    if (location.is_headquarters) {
      toast.error('A Matriz nao pode ser excluida.');
      return;
    }

    setPendingDeleteAction({ type: 'location', location });
    setDeleteAuthorizationEmail('');
    setDeleteAuthorizationPassword('');
    setDeleteAuthorizationError('');
    setDeleteAuthorizationOpen(true);
  };

  const requestDeleteTerminal = (terminal: PosTerminalRow) => {
    if (terminal.code === 'LEGACY') {
      toast.error('O terminal padrao da Matriz nao pode ser excluido.');
      return;
    }

    setPendingDeleteAction({ type: 'terminal', terminal });
    setDeleteAuthorizationEmail('');
    setDeleteAuthorizationPassword('');
    setDeleteAuthorizationError('');
    setDeleteAuthorizationOpen(true);
  };

  const handleConfirmDeleteAuthorization = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    if (!pendingDeleteAction) return;

    const adminEmail = deleteAuthorizationEmail.trim();
    const adminPassword = deleteAuthorizationPassword.trim();
    if (!adminEmail || !adminPassword) {
      setDeleteAuthorizationError('Informe login e senha do administrador.');
      return;
    }

    if (!session?.access_token) {
      setDeleteAuthorizationError('Sua sessao expirou. Entre novamente para excluir.');
      return;
    }

    setDeleteSubmitting(true);
    setDeleteAuthorizationError('');
    try {
      const approval = await verifyStoreAdminApproval(
        session.access_token,
        adminEmail,
        adminPassword,
        'multi_store.manage',
      );
      if (!approval.success) {
        setDeleteAuthorizationError(approval.error);
        setDeleteAuthorizationPassword('');
        return;
      }

      // Tipos gerados serao atualizados depois da aplicacao da migracao.
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      const db = supabase as any;
      const { data, error } = pendingDeleteAction.type === 'terminal'
        ? await db.rpc('delete_pos_terminal_operationally', { target_terminal_id: pendingDeleteAction.terminal.id })
        : await db.rpc('delete_store_location_operationally', { target_location_id: pendingDeleteAction.location.id });
      if (error) throw error;

      await loadData();
      await refreshOperationalScope();
      try {
        await syncNow();
      } catch (syncError) {
        console.warn('Exclusao aplicada, mas a sincronizacao local falhou:', getRedactedLogValue(syncError));
      }

      if (pendingDeleteAction.type === 'terminal') {
        toast.success('Terminal excluido. Desktop desvinculado volta a pedir a license key.');
      } else {
        const result = data as { locationRemovedFromDatabase?: boolean; deletedTerminals?: number } | null;
        toast.success(
          result?.locationRemovedFromDatabase
            ? 'Filial excluida. Terminais vinculados foram removidos.'
            : 'Filial retirada da operacao. Historico preservado e terminais removidos.',
        );
      }

      resetDeleteAuthorization();
    } catch (error) {
      console.error('Erro ao excluir filial ou terminal:', getRedactedLogValue(error));
      const message = error instanceof Error ? error.message : 'Nao foi possivel excluir agora.';
      setDeleteAuthorizationError(message);
      setDeleteAuthorizationPassword('');
      toast.error(message);
    } finally {
      setDeleteSubmitting(false);
    }
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

  const handleSaveTerminal = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    const normalizedCode = normalizeStoreScopeCode(terminalCode);
    const currentTerminal = terminals.find((terminal) => terminal.id === terminalEditingId);
    const isLegacyTerminal = currentTerminal?.code === 'LEGACY';
    if (!terminalName.trim() || !terminalLocationId || !isValidStoreScopeCode(normalizedCode)) {
      toast.error('Informe filial, nome e codigo valido para o terminal.');
      return;
    }

    setSaving(true);
    try {
      const wasEditing = Boolean(terminalEditingId);
      const payload = {
        store_account_id: storeAccountId,
        owner_user_id: ownerUserId,
        location_id: isLegacyTerminal ? currentTerminal.location_id : terminalLocationId,
        code: isLegacyTerminal ? currentTerminal.code : normalizedCode,
        name: terminalName.trim(),
        terminal_type: terminalType,
      };
      // Tipos gerados serao atualizados depois da aplicacao da migracao.
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      const db = supabase as any;
      const { error } = terminalEditingId
        ? await db.from('pos_terminals').update(payload).eq('id', terminalEditingId)
        : await db.from('pos_terminals').insert(payload);
      if (error) throw error;
      resetTerminalForm();
      setTerminalDialogOpen(false);
      await loadData();
      toast.success(wasEditing ? 'Terminal atualizado.' : 'Terminal cadastrado.');
    } catch (error) {
      console.error('Erro ao salvar terminal:', getRedactedLogValue(error));
      toast.error('Nao foi possivel salvar o terminal. Verifique se o codigo ja existe.');
    } finally {
      setSaving(false);
    }
  };

  const handleTransferStock = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    const quantity = Math.max(0, parseDecimalInput(transferQuantity));
    if (!transferSourceLocationId || !transferTargetLocationId || transferSourceLocationId === transferTargetLocationId) {
      toast.error('Escolha origem e destino diferentes.');
      return;
    }
    if (!transferProductId || quantity <= 0) {
      toast.error('Escolha um produto e informe quantidade.');
      return;
    }

    setTransferring(true);
    try {
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      const { error } = await (supabase as any).rpc('transfer_location_stock', {
        p_source_location_id: transferSourceLocationId,
        p_target_location_id: transferTargetLocationId,
        p_product_id: transferProductId,
        p_quantity: quantity,
        p_reason: transferReason.trim() || 'Transferencia entre filiais',
      });
      if (error) throw error;
      resetTransferForm();
      setTransferDialogOpen(false);
      await syncNow();
      toast.success('Transferencia de estoque registrada.');
    } catch (error) {
      console.error('Erro ao transferir estoque:', getRedactedLogValue(error));
      toast.error(error instanceof Error ? error.message : 'Nao foi possivel transferir o estoque.');
    } finally {
      setTransferring(false);
    }
  };

  const updateActiveState = async (table: 'store_locations' | 'pos_terminals', id: string, active: boolean) => {
    try {
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      const { error } = await (supabase as any).from(table).update({ active }).eq('id', id);
      if (error) throw error;
      await loadData();
      await refreshOperationalScope();
      toast.success(active ? 'Registro ativado.' : 'Registro desativado.');
    } catch (error) {
      console.error('Erro ao alterar status operacional:', getRedactedLogValue(error));
      toast.error('Nao foi possivel alterar o status.');
    }
  };

  const deleteAuthorizationTitle = pendingDeleteAction?.type === 'terminal'
    ? `Excluir terminal ${pendingDeleteAction.terminal.name}?`
    : pendingDeleteAction?.type === 'location'
      ? `Excluir filial ${pendingDeleteAction.location.name}?`
      : 'Confirmar exclusao';
  const deleteAuthorizationDescription = pendingDeleteAction?.type === 'terminal'
    ? 'O terminal sera removido do banco. Se ele estiver vinculado a um HappyCash Desktop, aquela maquina sera bloqueada e voltara para a tela inicial da license key.'
    : pendingDeleteAction?.type === 'location'
      ? `A filial sera retirada da operacao e ${terminalsByLocation.get(pendingDeleteAction.location.id) ?? 0} terminal(is) vinculado(s) tambem sera(o) removido(s). Se existir historico, o banco preserva os registros e deixa a filial inativa.`
      : 'Confirme com login e senha do administrador para continuar.';

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
          <div className="flex flex-wrap items-center gap-2">
            <Dialog open={transferDialogOpen} onOpenChange={(open) => {
              setTransferDialogOpen(open);
              if (!open) resetTransferForm();
            }}>
              <DialogTrigger asChild>
                <Button type="button" size="sm" variant="outline" disabled={activeLocations.length < 2}>
                  <ArrowRightLeft className="mr-1 h-4 w-4" />Transferir estoque
                </Button>
              </DialogTrigger>
              <DialogContent className="max-w-2xl">
                <form onSubmit={handleTransferStock}>
                  <DialogHeader>
                    <DialogTitle>Transferir estoque entre filiais</DialogTitle>
                    <DialogDescription>Movimenta o saldo da origem para o destino e registra auditoria.</DialogDescription>
                  </DialogHeader>
                  <div className="space-y-4 py-4">
                    <div className="grid gap-3 sm:grid-cols-2">
                      <div className="space-y-1">
                        <Label>Origem</Label>
                        <Select value={transferSourceLocationId} onValueChange={setTransferSourceLocationId}>
                          <SelectTrigger><SelectValue placeholder="Selecione" /></SelectTrigger>
                          <SelectContent>{activeLocations.map((location) => <SelectItem key={location.id} value={location.id}>{location.name}</SelectItem>)}</SelectContent>
                        </Select>
                      </div>
                      <div className="space-y-1">
                        <Label>Destino</Label>
                        <Select value={transferTargetLocationId} onValueChange={setTransferTargetLocationId}>
                          <SelectTrigger><SelectValue placeholder="Selecione" /></SelectTrigger>
                          <SelectContent>{activeLocations.map((location) => <SelectItem key={location.id} value={location.id}>{location.name}</SelectItem>)}</SelectContent>
                        </Select>
                      </div>
                    </div>
                    <div className="space-y-1">
                      <Label>Produto</Label>
                      {selectedTransferProduct ? (
                        <div className="flex items-center justify-between gap-2 rounded-md border bg-muted/30 px-3 py-2 text-sm">
                          <span className="truncate">{selectedTransferProduct.name}</span>
                          <Button type="button" size="sm" variant="ghost" onClick={() => { setTransferProductId(''); setTransferProductSearch(''); }}>Trocar</Button>
                        </div>
                      ) : (
                        <div className="relative">
                          <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
                          <Input className="pl-9" value={transferProductSearch} onChange={(event) => setTransferProductSearch(event.target.value)} placeholder="Buscar produto" />
                          {transferProductResults.length > 0 && (
                            <div className="absolute z-20 mt-1 max-h-56 w-full overflow-auto rounded-md border bg-popover p-1 shadow-lg">
                              {transferProductResults.map((product) => (
                                <button
                                  key={product.id}
                                  type="button"
                                  className="flex w-full items-center justify-between gap-3 rounded px-3 py-2 text-left text-sm hover:bg-muted"
                                  onClick={() => {
                                    setTransferProductId(product.id);
                                    setTransferProductSearch(product.name);
                                  }}
                                >
                                  <span className="truncate">{product.name}</span>
                                  <span className="shrink-0 text-xs text-muted-foreground">Est. {product.stock}</span>
                                </button>
                              ))}
                            </div>
                          )}
                        </div>
                      )}
                    </div>
                    <div className="grid gap-3 sm:grid-cols-[160px_1fr]">
                      <div className="space-y-1">
                        <Label>Quantidade</Label>
                        <Input inputMode="decimal" value={transferQuantity} onChange={(event) => setTransferQuantity(event.target.value)} placeholder="0" />
                      </div>
                      <div className="space-y-1">
                        <Label>Motivo</Label>
                        <Input value={transferReason} onChange={(event) => setTransferReason(event.target.value)} />
                      </div>
                    </div>
                  </div>
                  <DialogFooter>
                    <Button type="button" variant="outline" disabled={transferring} onClick={() => setTransferDialogOpen(false)}>Cancelar</Button>
                    <Button type="submit" disabled={transferring}>
                      {transferring ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : <ArrowRightLeft className="mr-2 h-4 w-4" />}
                      {transferring ? 'Transferindo...' : 'Transferir'}
                    </Button>
                  </DialogFooter>
                </form>
              </DialogContent>
            </Dialog>
            <Badge variant="outline">Somente Web</Badge>
          </div>
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
                  <TableHeader><TableRow><TableHead>Local</TableHead><TableHead>Tipo</TableHead><TableHead>Codigo</TableHead><TableHead className="text-right">Ativo</TableHead><TableHead className="text-right">Acoes</TableHead></TableRow></TableHeader>
                  <TableBody>
                    {locations.map((location) => (
                      <TableRow key={location.id}>
                        <TableCell className="font-medium">{location.name}{location.is_headquarters && <Badge className="ml-2">Principal</Badge>}</TableCell>
                        <TableCell>{storeLocationTypeLabels[location.location_type]}</TableCell>
                        <TableCell className="font-mono text-xs">{location.code}</TableCell>
                        <TableCell className="text-right"><Switch aria-label={`Ativar ${location.name}`} checked={location.active} disabled={location.is_headquarters} onCheckedChange={(active) => void updateActiveState('store_locations', location.id, active)} /></TableCell>
                        <TableCell className="text-right">
                          <Button
                            type="button"
                            size="icon"
                            variant="ghost"
                            className="text-destructive hover:text-destructive"
                            disabled={location.is_headquarters || deleteSubmitting}
                            onClick={() => requestDeleteLocation(location)}
                            aria-label={`Excluir ${location.name}`}
                          >
                            <Trash2 className="h-4 w-4" />
                          </Button>
                        </TableCell>
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
                    <form onSubmit={handleSaveTerminal}>
                      <DialogHeader><DialogTitle>{terminalEditingId ? 'Editar terminal' : 'Cadastrar terminal'}</DialogTitle></DialogHeader>
                      <div className="space-y-4 py-4">
                        <div className="space-y-1">
                          <Label>Filial</Label>
                          <Select value={terminalLocationId} onValueChange={setTerminalLocationId} disabled={terminals.find((terminal) => terminal.id === terminalEditingId)?.code === 'LEGACY'}>
                            <SelectTrigger><SelectValue placeholder="Selecione" /></SelectTrigger>
                            <SelectContent>{locations.filter((location) => location.active).map((location) => <SelectItem key={location.id} value={location.id}>{location.name}</SelectItem>)}</SelectContent>
                          </Select>
                        </div>
                        <div className="space-y-1"><Label htmlFor="terminal-name">Nome</Label><Input id="terminal-name" value={terminalName} onChange={(event) => setTerminalName(event.target.value)} placeholder="Caixa 01" /></div>
                        <div className="space-y-1"><Label htmlFor="terminal-code">Codigo</Label><Input id="terminal-code" value={terminalCode} disabled={terminals.find((terminal) => terminal.id === terminalEditingId)?.code === 'LEGACY'} onChange={(event) => setTerminalCode(normalizeStoreScopeCode(event.target.value))} placeholder="CX-01" maxLength={32} /></div>
                        <div className="space-y-1">
                          <Label>Tipo</Label>
                          <Select value={terminalType} onValueChange={(value) => setTerminalType(value as PosTerminalType)}>
                            <SelectTrigger><SelectValue /></SelectTrigger>
                            <SelectContent>{Object.entries(posTerminalTypeLabels).map(([value, label]) => <SelectItem key={value} value={value}>{label}</SelectItem>)}</SelectContent>
                          </Select>
                        </div>
                      </div>
                      <DialogFooter><Button type="submit" disabled={saving}>{saving ? 'Salvando...' : terminalEditingId ? 'Salvar terminal' : 'Cadastrar terminal'}</Button></DialogFooter>
                    </form>
                  </DialogContent>
                </Dialog>
              </div>
              <div className="overflow-x-auto rounded-lg border">
                <Table>
                  <TableHeader><TableRow><TableHead>Terminal</TableHead><TableHead>Filial</TableHead><TableHead>Tipo</TableHead><TableHead>Usuario atual</TableHead><TableHead>Vinculo</TableHead><TableHead className="text-right">Acoes</TableHead></TableRow></TableHeader>
                  <TableBody>
                    {terminals.map((terminal) => (
                      <TableRow key={terminal.id}>
                        <TableCell>
                          <div className="space-y-1">
                            <div className="flex flex-wrap items-center gap-2">
                              <p className="font-medium">{terminal.name}</p>
                              <Badge variant={isTerminalOnline(terminal) ? 'default' : 'outline'}>
                                {isTerminalOnline(terminal) ? 'Online' : 'Offline'}
                              </Badge>
                            </div>
                            <p className="font-mono text-xs text-muted-foreground">{terminal.code}</p>
                          </div>
                        </TableCell>
                        <TableCell>{locationNameById.get(terminal.location_id) ?? 'Filial removida'}</TableCell>
                        <TableCell>{posTerminalTypeLabels[terminal.terminal_type]}</TableCell>
                        <TableCell>
                          {getTerminalUserName(terminal) ? (
                            <div className="space-y-1">
                              <p className="font-medium">{getTerminalUserName(terminal)}</p>
                              <p className="text-xs text-muted-foreground">
                                {terminal.current_user_role ? terminalUserRoleLabel[terminal.current_user_role] ?? terminal.current_user_role : 'Perfil nao informado'} - {formatTerminalSeenAt(terminal)}
                              </p>
                            </div>
                          ) : (
                            <span className="text-xs text-muted-foreground">Sem usuario conectado</span>
                          )}
                        </TableCell>
                        <TableCell>{terminal.installation_id ? <Badge variant="secondary">Desktop vinculado</Badge> : <span className="text-xs text-muted-foreground">Manual</span>}</TableCell>
                        <TableCell className="text-right">
                          <div className="flex items-center justify-end gap-2">
                            <Button type="button" size="icon" variant="ghost" onClick={() => openTerminalEdit(terminal)} aria-label={`Editar ${terminal.name}`}>
                              <Edit className="h-4 w-4" />
                            </Button>
                            <Button
                              type="button"
                              size="icon"
                              variant="ghost"
                              className="text-destructive hover:text-destructive"
                              disabled={terminal.code === 'LEGACY' || deleteSubmitting}
                              onClick={() => requestDeleteTerminal(terminal)}
                              aria-label={`Excluir ${terminal.name}`}
                            >
                              <Trash2 className="h-4 w-4" />
                            </Button>
                            <Switch aria-label={`Ativar ${terminal.name}`} checked={terminal.active} disabled={terminal.code === 'LEGACY' || Boolean(terminal.installation_id)} onCheckedChange={(active) => void updateActiveState('pos_terminals', terminal.id, active)} />
                          </div>
                        </TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              </div>
            </section>
          </>
        )}
        <Dialog
          open={deleteAuthorizationOpen}
          onOpenChange={(open) => {
            if (!open && !deleteSubmitting) resetDeleteAuthorization();
          }}
        >
          <DialogContent className="sm:max-w-md">
            <DialogHeader>
              <DialogTitle>{deleteAuthorizationTitle}</DialogTitle>
              <DialogDescription>{deleteAuthorizationDescription}</DialogDescription>
            </DialogHeader>
            <form className="space-y-4" onSubmit={handleConfirmDeleteAuthorization}>
              <div className="space-y-1">
                <Label htmlFor="store-scope-delete-admin-login">Login do administrador</Label>
                <Input
                  id="store-scope-delete-admin-login"
                  name="store-scope-delete-admin-login"
                  type="email"
                  value={deleteAuthorizationEmail}
                  onChange={(event) => setDeleteAuthorizationEmail(event.target.value)}
                  placeholder="admin@empresa.com"
                  autoComplete="off"
                  autoFocus
                />
              </div>
              <div className="space-y-1">
                <Label htmlFor="store-scope-delete-admin-password">Senha do administrador</Label>
                <PasswordInput
                  id="store-scope-delete-admin-password"
                  name="store-scope-delete-admin-password"
                  value={deleteAuthorizationPassword}
                  onChange={(event) => setDeleteAuthorizationPassword(event.target.value)}
                  placeholder="Digite a senha"
                  autoComplete="new-password"
                />
              </div>
              {deleteAuthorizationError ? (
                <p className="text-sm font-medium text-destructive">{deleteAuthorizationError}</p>
              ) : null}
              <DialogFooter>
                <Button type="button" variant="outline" disabled={deleteSubmitting} onClick={() => setDeleteAuthorizationOpen(false)}>
                  Cancelar
                </Button>
                <Button type="submit" variant="destructive" disabled={deleteSubmitting}>
                  {deleteSubmitting ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : <Trash2 className="mr-2 h-4 w-4" />}
                  {deleteSubmitting ? 'Validando...' : 'Confirmar exclusao'}
                </Button>
              </DialogFooter>
            </form>
          </DialogContent>
        </Dialog>
      </CardContent>
    </Card>
  );
}
