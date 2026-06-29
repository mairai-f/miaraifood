import { useCallback, useEffect, useMemo, useState, type FormEvent } from 'react';
import { Boxes, Loader2, Plus, Truck } from 'lucide-react';
import { toast } from 'sonner';
import { useAuth } from '@/contexts/AuthContext';
import { usePermissions } from '@/contexts/usePermissions';
import { supabase } from '@/integrations/supabase/client';
import {
  isValidCatalogCode,
  normalizeCatalogCode,
  type CatalogOption,
  type MeasurementUnitOption,
  type ProductPriceTableOption,
  type ProductSubgroupOption,
  type TransportCompanyOption,
} from '@/lib/catalog';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Dialog, DialogContent, DialogFooter, DialogHeader, DialogTitle, DialogTrigger } from '@/components/ui/dialog';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Switch } from '@/components/ui/switch';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { getRedactedLogValue } from '../../shared/security/redaction';

type StructureKind = 'department' | 'brand' | 'group' | 'subgroup';
type StructureTable = 'product_departments' | 'product_brands' | 'product_groups' | 'product_subgroups';

interface UnitConversionRow {
  id: string;
  from_unit_id: string;
  to_unit_id: string;
  factor: number;
  active: boolean;
}

const structureLabels: Record<StructureKind, string> = {
  department: 'Setor',
  brand: 'Marca',
  group: 'Grupo',
  subgroup: 'Subgrupo',
};

const structureTables: Record<StructureKind, StructureTable> = {
  department: 'product_departments',
  brand: 'product_brands',
  group: 'product_groups',
  subgroup: 'product_subgroups',
};

/** Backoffice Web do catalogo; este componente nao e importado pelo Desktop. */
export function CatalogConfigurationPanel() {
  const { isAdmin, ownerUserId } = useAuth();
  const { hasPermission } = usePermissions();
  const canManageStructure = isAdmin && hasPermission('products.manage');
  const canManagePricing = isAdmin && hasPermission('pricing.manage');
  const canManageTransport = isAdmin && hasPermission('purchases.manage');
  const canOpenPanel = canManageStructure || canManagePricing || canManageTransport;
  const [storeAccountId, setStoreAccountId] = useState('');
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [departments, setDepartments] = useState<CatalogOption[]>([]);
  const [brands, setBrands] = useState<CatalogOption[]>([]);
  const [groups, setGroups] = useState<CatalogOption[]>([]);
  const [subgroups, setSubgroups] = useState<ProductSubgroupOption[]>([]);
  const [units, setUnits] = useState<MeasurementUnitOption[]>([]);
  const [conversions, setConversions] = useState<UnitConversionRow[]>([]);
  const [priceTables, setPriceTables] = useState<ProductPriceTableOption[]>([]);
  const [transportCompanies, setTransportCompanies] = useState<TransportCompanyOption[]>([]);
  const [structureDialogOpen, setStructureDialogOpen] = useState(false);
  const [structureKind, setStructureKind] = useState<StructureKind>('department');
  const [structureCode, setStructureCode] = useState('');
  const [structureName, setStructureName] = useState('');
  const [structureGroupId, setStructureGroupId] = useState('');
  const [unitDialogOpen, setUnitDialogOpen] = useState(false);
  const [unitCode, setUnitCode] = useState('');
  const [unitName, setUnitName] = useState('');
  const [unitSymbol, setUnitSymbol] = useState('');
  const [unitDecimals, setUnitDecimals] = useState('0');
  const [conversionDialogOpen, setConversionDialogOpen] = useState(false);
  const [conversionFromId, setConversionFromId] = useState('');
  const [conversionToId, setConversionToId] = useState('');
  const [conversionFactor, setConversionFactor] = useState('');
  const [priceDialogOpen, setPriceDialogOpen] = useState(false);
  const [priceCode, setPriceCode] = useState('');
  const [priceName, setPriceName] = useState('');
  const [priceDescription, setPriceDescription] = useState('');
  const [transportDialogOpen, setTransportDialogOpen] = useState(false);
  const [transportCode, setTransportCode] = useState('');
  const [transportName, setTransportName] = useState('');
  const [transportDocument, setTransportDocument] = useState('');
  const [transportContact, setTransportContact] = useState('');
  const [transportPhone, setTransportPhone] = useState('');
  const [transportEmail, setTransportEmail] = useState('');

  const loadData = useCallback(async () => {
    if (!ownerUserId || !canOpenPanel) {
      setLoading(false);
      return;
    }
    setLoading(true);
    try {
      // As tabelas entram nos tipos gerados depois que a migracao for aplicada.
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      const db = supabase as any;
      const { data: accountId, error: accountError } = await db.rpc(
        'get_current_store_account_id_for_context',
        { target_context: 'happycash' },
      );
      if (accountError || !accountId) throw accountError ?? new Error('Empresa HappyCash nao encontrada.');
      const results = await Promise.all([
        db.from('product_departments').select('*').eq('store_account_id', accountId).order('name'),
        db.from('product_brands').select('*').eq('store_account_id', accountId).order('name'),
        db.from('product_groups').select('*').eq('store_account_id', accountId).order('name'),
        db.from('product_subgroups').select('*').eq('store_account_id', accountId).order('name'),
        db.from('measurement_units').select('*').eq('store_account_id', accountId).order('name'),
        db.from('measurement_unit_conversions').select('*').eq('store_account_id', accountId).order('created_at'),
        db.from('product_price_tables').select('*').eq('store_account_id', accountId).order('is_default', { ascending: false }).order('name'),
        db.from('transport_companies').select('*').eq('store_account_id', accountId).order('name'),
      ]);
      const failed = results.find((result) => result.error);
      if (failed?.error) throw failed.error;
      setStoreAccountId(accountId as string);
      setDepartments((results[0].data ?? []) as CatalogOption[]);
      setBrands((results[1].data ?? []) as CatalogOption[]);
      setGroups((results[2].data ?? []) as CatalogOption[]);
      setSubgroups((results[3].data ?? []) as ProductSubgroupOption[]);
      setUnits((results[4].data ?? []) as MeasurementUnitOption[]);
      setConversions((results[5].data ?? []) as UnitConversionRow[]);
      setPriceTables((results[6].data ?? []) as ProductPriceTableOption[]);
      setTransportCompanies((results[7].data ?? []) as TransportCompanyOption[]);
    } catch (error) {
      console.error('Erro ao carregar catalogo avancado:', getRedactedLogValue(error));
      toast.error('Nao foi possivel carregar o catalogo avancado. Aplique a migracao da Fase 3.');
    } finally {
      setLoading(false);
    }
  }, [canOpenPanel, ownerUserId]);

  useEffect(() => {
    void loadData();
  }, [loadData]);

  const groupNames = useMemo(() => new Map(groups.map((group) => [group.id, group.name])), [groups]);
  const unitNames = useMemo(() => new Map(units.map((unit) => [unit.id, `${unit.name} (${unit.symbol})`])), [units]);

  const insertRow = async (table: string, values: Record<string, unknown>) => {
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const { error } = await (supabase as any).from(table).insert({
      store_account_id: storeAccountId,
      owner_user_id: ownerUserId,
      ...values,
    });
    if (error) throw error;
  };

  const updateActiveState = async (table: string, id: string, active: boolean) => {
    try {
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      const { error } = await (supabase as any).from(table).update({ active }).eq('id', id);
      if (error) throw error;
      await loadData();
      toast.success(active ? 'Cadastro ativado.' : 'Cadastro desativado.');
    } catch (error) {
      console.error('Erro ao alterar cadastro do catalogo:', getRedactedLogValue(error));
      toast.error('Nao foi possivel alterar o status. Verifique se o registro esta em uso.');
    }
  };

  const handleCreateStructure = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    const code = normalizeCatalogCode(structureCode);
    if (!structureName.trim() || !isValidCatalogCode(code) || (structureKind === 'subgroup' && !structureGroupId)) {
      toast.error('Informe codigo, nome e o grupo quando necessario.');
      return;
    }
    setSaving(true);
    try {
      await insertRow(structureTables[structureKind], {
        code,
        name: structureName.trim(),
        ...(structureKind === 'subgroup' ? { product_group_id: structureGroupId } : {}),
      });
      setStructureCode(''); setStructureName(''); setStructureGroupId(''); setStructureDialogOpen(false);
      await loadData();
      toast.success(`${structureLabels[structureKind]} cadastrado.`);
    } catch (error) {
      console.error('Erro ao criar estrutura de produto:', getRedactedLogValue(error));
      toast.error('Nao foi possivel cadastrar. Verifique se o codigo ja existe.');
    } finally { setSaving(false); }
  };

  const handleCreateUnit = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    const code = normalizeCatalogCode(unitCode);
    const decimalPlaces = Number.parseInt(unitDecimals, 10);
    if (!unitName.trim() || !unitSymbol.trim() || !isValidCatalogCode(code) || decimalPlaces < 0 || decimalPlaces > 6) {
      toast.error('Informe uma unidade valida e entre 0 e 6 casas decimais.');
      return;
    }
    setSaving(true);
    try {
      await insertRow('measurement_units', { code, name: unitName.trim(), symbol: unitSymbol.trim().toUpperCase(), decimal_places: decimalPlaces });
      setUnitCode(''); setUnitName(''); setUnitSymbol(''); setUnitDecimals('0'); setUnitDialogOpen(false);
      await loadData(); toast.success('Unidade cadastrada.');
    } catch (error) {
      console.error('Erro ao criar unidade:', getRedactedLogValue(error));
      toast.error('Nao foi possivel cadastrar a unidade.');
    } finally { setSaving(false); }
  };

  const handleCreateConversion = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    const factor = Number(conversionFactor.replace(',', '.'));
    if (!conversionFromId || !conversionToId || conversionFromId === conversionToId || !Number.isFinite(factor) || factor <= 0) {
      toast.error('Escolha unidades diferentes e informe um fator maior que zero.');
      return;
    }
    setSaving(true);
    try {
      await insertRow('measurement_unit_conversions', { from_unit_id: conversionFromId, to_unit_id: conversionToId, factor });
      setConversionFromId(''); setConversionToId(''); setConversionFactor(''); setConversionDialogOpen(false);
      await loadData(); toast.success('Conversao cadastrada.');
    } catch (error) {
      console.error('Erro ao criar conversao:', getRedactedLogValue(error));
      toast.error('Nao foi possivel cadastrar a conversao.');
    } finally { setSaving(false); }
  };

  const handleCreatePriceTable = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    const code = normalizeCatalogCode(priceCode);
    if (!priceName.trim() || !isValidCatalogCode(code)) {
      toast.error('Informe codigo e nome da tabela.');
      return;
    }
    setSaving(true);
    try {
      await insertRow('product_price_tables', { code, name: priceName.trim(), description: priceDescription.trim(), is_default: priceTables.length === 0 });
      setPriceCode(''); setPriceName(''); setPriceDescription(''); setPriceDialogOpen(false);
      await loadData(); toast.success('Tabela de preco cadastrada.');
    } catch (error) {
      console.error('Erro ao criar tabela de preco:', getRedactedLogValue(error));
      toast.error('Nao foi possivel cadastrar a tabela de preco.');
    } finally { setSaving(false); }
  };

  const handleCreateTransport = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    const code = normalizeCatalogCode(transportCode);
    if (!transportName.trim() || !isValidCatalogCode(code)) {
      toast.error('Informe codigo e razao social da transportadora.');
      return;
    }
    setSaving(true);
    try {
      await insertRow('transport_companies', {
        code, name: transportName.trim(), document: transportDocument.trim(), contact_name: transportContact.trim(),
        phone: transportPhone.trim(), email: transportEmail.trim(),
      });
      setTransportCode(''); setTransportName(''); setTransportDocument(''); setTransportContact('');
      setTransportPhone(''); setTransportEmail(''); setTransportDialogOpen(false);
      await loadData(); toast.success('Transportadora cadastrada.');
    } catch (error) {
      console.error('Erro ao criar transportadora:', getRedactedLogValue(error));
      toast.error('Nao foi possivel cadastrar a transportadora.');
    } finally { setSaving(false); }
  };

  if (!canOpenPanel) return null;

  const structureSections: Array<{ kind: StructureKind; rows: CatalogOption[] }> = [
    { kind: 'department', rows: departments }, { kind: 'brand', rows: brands },
    { kind: 'group', rows: groups }, { kind: 'subgroup', rows: subgroups },
  ];

  return (
    <Card>
      <CardHeader className="space-y-2">
        <CardTitle className="flex items-center gap-2 text-base"><Boxes className="h-4 w-4 text-primary" /> Catalogo avancado</CardTitle>
        <p className="text-sm text-muted-foreground">Administracao Web de classificacao, unidades, precos e transporte. O Desktop recebe apenas os dados operacionais.</p>
      </CardHeader>
      <CardContent>
        {loading ? (
          <div className="flex items-center gap-2 py-8 text-sm text-muted-foreground"><Loader2 className="h-4 w-4 animate-spin" /> Carregando catalogo...</div>
        ) : (
          <Tabs defaultValue={canManageStructure ? 'structure' : canManagePricing ? 'pricing' : 'transport'}>
            <TabsList className="grid h-auto w-full grid-cols-2 lg:grid-cols-4">
              {canManageStructure && <TabsTrigger value="structure">Estrutura</TabsTrigger>}
              {canManageStructure && <TabsTrigger value="units">Unidades</TabsTrigger>}
              {canManagePricing && <TabsTrigger value="pricing">Precos</TabsTrigger>}
              {canManageTransport && <TabsTrigger value="transport">Transportadoras</TabsTrigger>}
            </TabsList>

            {canManageStructure && <TabsContent value="structure" className="space-y-4 pt-3">
              <Dialog open={structureDialogOpen} onOpenChange={setStructureDialogOpen}>
                <DialogTrigger asChild><Button size="sm"><Plus className="mr-1 h-4 w-4" /> Novo cadastro</Button></DialogTrigger>
                <DialogContent><form onSubmit={handleCreateStructure} className="space-y-4">
                  <DialogHeader><DialogTitle>Nova estrutura de produto</DialogTitle></DialogHeader>
                  <div className="space-y-1"><Label>Tipo</Label><Select value={structureKind} onValueChange={(value) => { setStructureKind(value as StructureKind); setStructureGroupId(''); }}><SelectTrigger><SelectValue /></SelectTrigger><SelectContent>{Object.entries(structureLabels).map(([value, label]) => <SelectItem key={value} value={value}>{label}</SelectItem>)}</SelectContent></Select></div>
                  {structureKind === 'subgroup' && <div className="space-y-1"><Label>Grupo pai</Label><Select value={structureGroupId} onValueChange={setStructureGroupId}><SelectTrigger><SelectValue placeholder="Selecione" /></SelectTrigger><SelectContent>{groups.filter((row) => row.active).map((row) => <SelectItem key={row.id} value={row.id}>{row.name}</SelectItem>)}</SelectContent></Select></div>}
                  <div className="space-y-1"><Label>Codigo</Label><Input value={structureCode} onChange={(event) => setStructureCode(normalizeCatalogCode(event.target.value))} placeholder="Ex: BEBIDAS" /></div>
                  <div className="space-y-1"><Label>Nome</Label><Input value={structureName} onChange={(event) => setStructureName(event.target.value)} /></div>
                  <DialogFooter><Button type="submit" disabled={saving}>{saving ? 'Salvando...' : 'Cadastrar'}</Button></DialogFooter>
                </form></DialogContent>
              </Dialog>
              <div className="grid gap-4 lg:grid-cols-2">{structureSections.map(({ kind, rows }) => <div key={kind} className="rounded-md border p-3"><h3 className="mb-2 text-sm font-semibold">{structureLabels[kind]}s</h3><div className="space-y-2">{rows.map((row) => <div key={row.id} className="flex items-center justify-between gap-2 text-sm"><div><span className="font-medium">{row.name}</span><span className="ml-2 text-xs text-muted-foreground">{row.code}{kind === 'subgroup' ? ` · ${groupNames.get((row as ProductSubgroupOption).product_group_id) ?? 'Sem grupo'}` : ''}</span></div><Switch checked={row.active} onCheckedChange={(active) => void updateActiveState(structureTables[kind], row.id, active)} aria-label={`${activeLabel(row.active)} ${row.name}`} /></div>)}{rows.length === 0 && <p className="text-xs text-muted-foreground">Nenhum cadastro.</p>}</div></div>)}</div>
            </TabsContent>}

            {canManageStructure && <TabsContent value="units" className="space-y-4 pt-3">
              <div className="flex flex-wrap gap-2">
                <Dialog open={unitDialogOpen} onOpenChange={setUnitDialogOpen}><DialogTrigger asChild><Button size="sm"><Plus className="mr-1 h-4 w-4" /> Unidade</Button></DialogTrigger><DialogContent><form onSubmit={handleCreateUnit} className="space-y-4"><DialogHeader><DialogTitle>Nova unidade</DialogTitle></DialogHeader><div className="grid grid-cols-2 gap-3"><div className="space-y-1"><Label>Codigo</Label><Input value={unitCode} onChange={(event) => setUnitCode(normalizeCatalogCode(event.target.value))} /></div><div className="space-y-1"><Label>Simbolo</Label><Input value={unitSymbol} onChange={(event) => setUnitSymbol(event.target.value.toUpperCase())} /></div></div><div className="space-y-1"><Label>Nome</Label><Input value={unitName} onChange={(event) => setUnitName(event.target.value)} /></div><div className="space-y-1"><Label>Casas decimais</Label><Input type="number" min="0" max="6" value={unitDecimals} onChange={(event) => setUnitDecimals(event.target.value)} /></div><DialogFooter><Button type="submit" disabled={saving}>Cadastrar</Button></DialogFooter></form></DialogContent></Dialog>
                <Dialog open={conversionDialogOpen} onOpenChange={setConversionDialogOpen}><DialogTrigger asChild><Button size="sm" variant="outline"><Plus className="mr-1 h-4 w-4" /> Conversao</Button></DialogTrigger><DialogContent><form onSubmit={handleCreateConversion} className="space-y-4"><DialogHeader><DialogTitle>Nova conversao</DialogTitle></DialogHeader><div className="space-y-1"><Label>De</Label><Select value={conversionFromId} onValueChange={setConversionFromId}><SelectTrigger><SelectValue placeholder="Unidade de origem" /></SelectTrigger><SelectContent>{units.filter((row) => row.active).map((row) => <SelectItem key={row.id} value={row.id}>{row.name} ({row.symbol})</SelectItem>)}</SelectContent></Select></div><div className="space-y-1"><Label>Para</Label><Select value={conversionToId} onValueChange={setConversionToId}><SelectTrigger><SelectValue placeholder="Unidade de destino" /></SelectTrigger><SelectContent>{units.filter((row) => row.active).map((row) => <SelectItem key={row.id} value={row.id}>{row.name} ({row.symbol})</SelectItem>)}</SelectContent></Select></div><div className="space-y-1"><Label>Fator multiplicador</Label><Input inputMode="decimal" value={conversionFactor} onChange={(event) => setConversionFactor(event.target.value)} placeholder="Ex: 12" /></div><DialogFooter><Button type="submit" disabled={saving}>Cadastrar</Button></DialogFooter></form></DialogContent></Dialog>
              </div>
              <Table><TableHeader><TableRow><TableHead>Unidade</TableHead><TableHead>Precisao</TableHead><TableHead className="text-right">Ativa</TableHead></TableRow></TableHeader><TableBody>{units.map((row) => <TableRow key={row.id}><TableCell>{row.name} <span className="text-xs text-muted-foreground">({row.symbol})</span></TableCell><TableCell>{row.decimal_places} casas</TableCell><TableCell className="text-right"><Switch checked={row.active} onCheckedChange={(active) => void updateActiveState('measurement_units', row.id, active)} aria-label={`${activeLabel(row.active)} ${row.name}`} /></TableCell></TableRow>)}</TableBody></Table>
              <div><h3 className="mb-2 text-sm font-semibold">Conversoes</h3>{conversions.map((row) => <div key={row.id} className="flex items-center justify-between border-t py-2 text-sm"><span>1 {unitNames.get(row.from_unit_id)} = {row.factor} {unitNames.get(row.to_unit_id)}</span><Switch checked={row.active} onCheckedChange={(active) => void updateActiveState('measurement_unit_conversions', row.id, active)} aria-label="Alterar conversao" /></div>)}{conversions.length === 0 && <p className="text-xs text-muted-foreground">Nenhuma conversao cadastrada.</p>}</div>
            </TabsContent>}

            {canManagePricing && <TabsContent value="pricing" className="space-y-4 pt-3">
              <Dialog open={priceDialogOpen} onOpenChange={setPriceDialogOpen}><DialogTrigger asChild><Button size="sm"><Plus className="mr-1 h-4 w-4" /> Tabela de preco</Button></DialogTrigger><DialogContent><form onSubmit={handleCreatePriceTable} className="space-y-4"><DialogHeader><DialogTitle>Nova tabela de preco</DialogTitle></DialogHeader><div className="space-y-1"><Label>Codigo</Label><Input value={priceCode} onChange={(event) => setPriceCode(normalizeCatalogCode(event.target.value))} placeholder="Ex: ATACADO" /></div><div className="space-y-1"><Label>Nome</Label><Input value={priceName} onChange={(event) => setPriceName(event.target.value)} /></div><div className="space-y-1"><Label>Descricao</Label><Input value={priceDescription} onChange={(event) => setPriceDescription(event.target.value)} /></div><DialogFooter><Button type="submit" disabled={saving}>Cadastrar</Button></DialogFooter></form></DialogContent></Dialog>
              <Table><TableHeader><TableRow><TableHead>Tabela</TableHead><TableHead>Descricao</TableHead><TableHead>Uso</TableHead><TableHead className="text-right">Ativa</TableHead></TableRow></TableHeader><TableBody>{priceTables.map((row) => <TableRow key={row.id}><TableCell>{row.name}<div className="text-xs text-muted-foreground">{row.code}</div></TableCell><TableCell>{row.description || '—'}</TableCell><TableCell>{row.is_default ? <Badge>Padrao do PDV</Badge> : <Badge variant="outline">Alternativa</Badge>}</TableCell><TableCell className="text-right"><Switch checked={row.active} disabled={row.is_default} onCheckedChange={(active) => void updateActiveState('product_price_tables', row.id, active)} aria-label={`${activeLabel(row.active)} ${row.name}`} /></TableCell></TableRow>)}</TableBody></Table>
              <p className="text-xs text-muted-foreground">Os precos de cada produto sao informados no cadastro de Produtos. A tabela VAREJO continua sendo o fallback do PDV e do modo offline.</p>
            </TabsContent>}

            {canManageTransport && <TabsContent value="transport" className="space-y-4 pt-3">
              <Dialog open={transportDialogOpen} onOpenChange={setTransportDialogOpen}><DialogTrigger asChild><Button size="sm"><Truck className="mr-1 h-4 w-4" /> Nova transportadora</Button></DialogTrigger><DialogContent><form onSubmit={handleCreateTransport} className="space-y-4"><DialogHeader><DialogTitle>Nova transportadora</DialogTitle></DialogHeader><div className="grid grid-cols-2 gap-3"><div className="space-y-1"><Label>Codigo</Label><Input value={transportCode} onChange={(event) => setTransportCode(normalizeCatalogCode(event.target.value))} /></div><div className="space-y-1"><Label>CNPJ/CPF</Label><Input value={transportDocument} onChange={(event) => setTransportDocument(event.target.value)} /></div></div><div className="space-y-1"><Label>Razao social / nome</Label><Input value={transportName} onChange={(event) => setTransportName(event.target.value)} /></div><div className="space-y-1"><Label>Contato</Label><Input value={transportContact} onChange={(event) => setTransportContact(event.target.value)} /></div><div className="grid grid-cols-2 gap-3"><div className="space-y-1"><Label>Telefone</Label><Input value={transportPhone} onChange={(event) => setTransportPhone(event.target.value)} /></div><div className="space-y-1"><Label>Email</Label><Input type="email" value={transportEmail} onChange={(event) => setTransportEmail(event.target.value)} /></div></div><DialogFooter><Button type="submit" disabled={saving}>Cadastrar</Button></DialogFooter></form></DialogContent></Dialog>
              <Table><TableHeader><TableRow><TableHead>Transportadora</TableHead><TableHead>Documento</TableHead><TableHead>Contato</TableHead><TableHead className="text-right">Ativa</TableHead></TableRow></TableHeader><TableBody>{transportCompanies.map((row) => <TableRow key={row.id}><TableCell>{row.name}<div className="text-xs text-muted-foreground">{row.code}</div></TableCell><TableCell>{row.document || '—'}</TableCell><TableCell>{row.contact_name || row.phone || row.email || '—'}</TableCell><TableCell className="text-right"><Switch checked={row.active} onCheckedChange={(active) => void updateActiveState('transport_companies', row.id, active)} aria-label={`${activeLabel(row.active)} ${row.name}`} /></TableCell></TableRow>)}</TableBody></Table>
            </TabsContent>}
          </Tabs>
        )}
      </CardContent>
    </Card>
  );
}

const activeLabel = (active: boolean) => active ? 'Desativar' : 'Ativar';
