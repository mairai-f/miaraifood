import { useEffect, useMemo, useState } from 'react';
import { Building2, FileBadge2, KeyRound, Loader2, Save } from 'lucide-react';
import { toast } from 'sonner';

import { useAuth } from '@/contexts/AuthContext';
import { useData } from '@/contexts/DataContext';
import { usePlanAccess } from '@/contexts/PlanContext';
import { supabase } from '@/integrations/supabase/client';
import { useCurrentSubscription } from '@/hooks/use-current-subscription';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from '@/components/ui/dialog';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Switch } from '@/components/ui/switch';
import { maskDocument } from '../../shared/security/redaction';

interface CompanyForm {
  legalName: string;
  tradeName: string;
  cnpj: string;
  stateRegistration: string;
  phone: string;
  address: string;
}

const defaultForm: CompanyForm = {
  legalName: '',
  tradeName: '',
  cnpj: '',
  stateRegistration: '',
  phone: '',
  address: '',
};

const digitsOnly = (value: string) => value.replace(/\D/g, '');

const formatCnpj = (value: string) => {
  const digits = digitsOnly(value).slice(0, 14);
  return digits
    .replace(/^(\d{2})(\d)/, '$1.$2')
    .replace(/^(\d{2})\.(\d{3})(\d)/, '$1.$2.$3')
    .replace(/\.(\d{3})(\d)/, '.$1/$2')
    .replace(/(\d{4})(\d)/, '$1-$2');
};

const toOptionalText = (value: string) => {
  const normalized = value.trim();
  return normalized ? normalized : null;
};

export function CompanyProfileCard() {
  const { ownerUserId, user, isAdmin } = useAuth();
  const { blockSaleWithoutStock, updateStoreOperationalSettings } = useData();
  const { planId } = usePlanAccess();
  const { subscription, loading: loadingSubscription } = useCurrentSubscription();
  const [dialogOpen, setDialogOpen] = useState(false);
  const [savedForm, setSavedForm] = useState<CompanyForm>(defaultForm);
  const [form, setForm] = useState<CompanyForm>(defaultForm);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [savingStockPolicy, setSavingStockPolicy] = useState(false);
  const isDemoMode = planId === 'demo';
  const isDesktopRuntime = typeof window !== 'undefined' && Boolean(window.electronAPI);

  useEffect(() => {
    if (!isAdmin) return;

    if (isDemoMode) {
      setSavedForm(defaultForm);
      setForm(defaultForm);
      setLoading(false);
      return;
    }

    if (!ownerUserId) {
      setLoading(false);
      return;
    }

    let active = true;
    // Generated Supabase types are behind the current schema for these tables.
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const db = supabase as any;

    const loadCompany = async () => {
      setLoading(true);
      const [
        { data: storeAccountData, error: storeAccountError },
        { data: fiscalSettingsData, error: fiscalSettingsError },
      ] = await Promise.all([
        db.from('store_accounts').select('nome_estabelecimento, cnpj, telefone, endereco').eq('owner_user_id', ownerUserId).maybeSingle(),
        db.from('store_fiscal_settings').select('issuer_legal_name, issuer_trade_name, issuer_cnpj, issuer_state_registration').eq('owner_user_id', ownerUserId).maybeSingle(),
      ]);

      if (!active) return;

      if (storeAccountError || fiscalSettingsError) {
        setSavedForm(defaultForm);
        setForm(defaultForm);
        setLoading(false);
        return;
      }

      const tradeName = String(
        fiscalSettingsData?.issuer_trade_name ??
        storeAccountData?.nome_estabelecimento ??
        '',
      );
      const legalName = String(fiscalSettingsData?.issuer_legal_name ?? '');
      const cnpj = String(fiscalSettingsData?.issuer_cnpj ?? storeAccountData?.cnpj ?? '');
      const stateRegistration = String(fiscalSettingsData?.issuer_state_registration ?? '');

      const nextForm = {
        legalName,
        tradeName,
        cnpj: formatCnpj(cnpj),
        stateRegistration,
        phone: String(storeAccountData?.telefone ?? ''),
        address: String(storeAccountData?.endereco ?? ''),
      };

      setSavedForm(nextForm);
      setForm(nextForm);
      setLoading(false);
    };

    void loadCompany();

    return () => {
      active = false;
    };
  }, [isAdmin, isDemoMode, ownerUserId]);

  const companyDisplayName = useMemo(
    () => savedForm.tradeName.trim() || savedForm.legalName.trim() || 'Empresa nao cadastrada',
    [savedForm.legalName, savedForm.tradeName],
  );
  const desktopKeyUnlocked = subscription?.plan_id === 'pro' && subscription.status === 'active';
  const desktopKeyStatusMessage = loadingSubscription
      ? 'Verificando a liberacao da chave desktop desta conta...'
      : desktopKeyUnlocked
        ? 'A chave desktop existe, mas nao e exibida na tela. Use o fluxo de ativacao protegido para novas maquinas.'
        : subscription?.plan_id !== 'pro'
          ? 'A chave desktop fica disponivel somente para contas com plano PRO.'
          : subscription?.status === 'pending'
            ? 'A chave desktop fica liberada quando o pagamento do plano for confirmado no Asaas.'
            : 'A chave desktop fica protegida e liberada somente com plano PRO ativo.';

  if (!isAdmin) return null;

  const updateField = <K extends keyof CompanyForm>(field: K, value: CompanyForm[K]) => {
    setForm(current => ({ ...current, [field]: value }));
  };

  const handleSave = async () => {
    if (!ownerUserId || !user?.id) {
      toast.error('Nao foi possivel identificar a empresa desta conta.');
      return;
    }

    if (!form.tradeName.trim() && !form.legalName.trim()) {
      toast.error('Preencha pelo menos o nome fantasia ou a razao social.');
      return;
    }

    const cnpjDigits = digitsOnly(form.cnpj);
    if (form.cnpj.trim() && cnpjDigits.length !== 14) {
      toast.error('O CNPJ precisa ter 14 digitos.');
      return;
    }

    setSaving(true);
    if (isDemoMode) {
      setSaving(false);
      setSavedForm(form);
      toast.success('Modo demo: os dados da empresa ficam disponíveis apenas durante este teste e não são salvos no banco.');
      setDialogOpen(false);
      return;
    }

    // Generated Supabase types are behind the current schema for these tables.
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const db = supabase as any;
    const businessName = form.tradeName.trim() || form.legalName.trim();

    const [
      { error: fiscalSettingsError },
      { error: storeAccountError },
    ] = await Promise.all([
      db.from('store_fiscal_settings').upsert({
        owner_user_id: ownerUserId,
        issuer_legal_name: toOptionalText(form.legalName),
        issuer_trade_name: toOptionalText(form.tradeName),
        issuer_cnpj: cnpjDigits || null,
        issuer_state_registration: toOptionalText(form.stateRegistration),
        updated_by_user_id: user.id,
      }, { onConflict: 'owner_user_id' }),
      db.from('store_accounts').update({
        nome_estabelecimento: businessName,
        cnpj: cnpjDigits || null,
        telefone: toOptionalText(form.phone),
        endereco: toOptionalText(form.address),
      }).eq('owner_user_id', ownerUserId),
    ]);

    setSaving(false);

    if (fiscalSettingsError || storeAccountError) {
      toast.error('Nao foi possivel salvar os dados da empresa agora.');
      return;
    }

    setSavedForm(form);
    toast.success('Dados da empresa atualizados.');
    setDialogOpen(false);
  };

  const handleDialogOpenChange = (open: boolean) => {
    setDialogOpen(open);

    if (!open) {
      setForm(savedForm);
    }
  };

  const handleStockPolicyChange = async (nextValue: boolean) => {
    setSavingStockPolicy(true);

    try {
      await updateStoreOperationalSettings({ blockSaleWithoutStock: nextValue });
      toast.success(nextValue
        ? 'Venda sem saldo voltou a ser bloqueada para produtos com controle de estoque.'
        : 'Venda sem saldo liberada. O sistema pode levar o estoque para negativo.');
    } catch {
      toast.error('Nao foi possivel atualizar a politica de venda sem estoque agora.');
    } finally {
      setSavingStockPolicy(false);
    }
  };

  return (
    <Card>
      <CardHeader className="space-y-3">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <div className="space-y-2">
            <CardTitle className="flex items-center gap-2 text-base">
              <Building2 className="h-4 w-4 text-primary" />
              Empresa
            </CardTitle>
            <p className="text-sm text-muted-foreground">
              Esses dados alimentam o nome exibido no cupom e deixam a base pronta para a etapa fiscal.
            </p>
          </div>

          <Dialog open={dialogOpen} onOpenChange={handleDialogOpenChange}>
            <DialogTrigger asChild>
              <Button variant="outline">Cadastrar empresa</Button>
            </DialogTrigger>
            <DialogContent className="sm:max-w-lg">
              <DialogHeader>
                <DialogTitle>Cadastro da empresa</DialogTitle>
                <DialogDescription>
                  Cadastre os dados principais da loja para usar no sistema, no cupom e nas proximas etapas fiscais.
                </DialogDescription>
              </DialogHeader>

              <div className="grid gap-4 py-2">
                <div className="space-y-1">
                  <Label>Razao social</Label>
                  <Input
                    value={form.legalName}
                    onChange={event => updateField('legalName', event.target.value)}
                    placeholder="Empresa Exemplo LTDA"
                  />
                </div>

                <div className="space-y-1">
                  <Label>Nome fantasia</Label>
                  <Input
                    value={form.tradeName}
                    onChange={event => updateField('tradeName', event.target.value)}
                    placeholder="Minha Loja"
                  />
                </div>

                <div className="grid gap-4 sm:grid-cols-2">
                  <div className="space-y-1">
                    <Label>CNPJ</Label>
                    <Input
                      value={form.cnpj}
                      onChange={event => updateField('cnpj', formatCnpj(event.target.value))}
                      placeholder="00.000.000/0000-00"
                    />
                  </div>

                  <div className="space-y-1">
                    <Label>Inscricao estadual</Label>
                    <Input
                      value={form.stateRegistration}
                      onChange={event => updateField('stateRegistration', event.target.value)}
                      placeholder="110042490114"
                    />
                  </div>
                </div>

                <div className="space-y-1">
                  <Label>Telefone / WhatsApp</Label>
                  <Input
                    value={form.phone}
                    onChange={event => updateField('phone', event.target.value)}
                    placeholder="(11) 99999-9999"
                  />
                </div>

                <div className="space-y-1">
                  <Label>Endereco da loja</Label>
                  <Input
                    value={form.address}
                    onChange={event => updateField('address', event.target.value)}
                    placeholder="Rua Exemplo, 123 - Bairro - Cidade/UF"
                  />
                </div>
              </div>

              <DialogFooter>
                <Button variant="outline" onClick={() => handleDialogOpenChange(false)} disabled={saving}>
                  Cancelar
                </Button>
                <Button onClick={() => void handleSave()} disabled={saving}>
                  {saving ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : <Save className="mr-2 h-4 w-4" />}
                  Salvar empresa
                </Button>
              </DialogFooter>
            </DialogContent>
          </Dialog>
        </div>
      </CardHeader>

      <CardContent className="space-y-4">
        {loading ? (
          <div className="flex items-center gap-2 text-sm text-muted-foreground">
            <Loader2 className="h-4 w-4 animate-spin" />
            Carregando dados da empresa...
          </div>
        ) : (
          <>
            <div className="rounded-lg border border-border/70 bg-background/70 p-4">
              <p className="text-xs uppercase tracking-[0.2em] text-muted-foreground">Empresa no sistema</p>
              <p className="mt-2 text-lg font-semibold">{companyDisplayName}</p>
              <p className="mt-1 text-sm text-muted-foreground">
                O cupom vai usar o nome da empresa, mantendo a assinatura do sistema HappyCash no rodape.
              </p>
            </div>

            <div className="rounded-lg border border-border/70 bg-background/70 p-4">
              <div className="flex items-center justify-between gap-4">
                <div className="space-y-1">
                  <p className="text-sm font-semibold">Travar venda sem saldo</p>
                  <p className="text-sm text-muted-foreground">
                    Ligado: produtos com controle de estoque travam no PDV e no fiado. Desligado: a venda pode levar o saldo para negativo.
                  </p>
                </div>
                <Switch
                  checked={blockSaleWithoutStock}
                  disabled={loading || savingStockPolicy || !ownerUserId}
                  onCheckedChange={(checked) => void handleStockPolicyChange(checked)}
                />
              </div>
            </div>

            <div className="rounded-lg border border-primary/15 bg-primary/5 p-4">
              <div className="flex flex-wrap items-start justify-between gap-3">
                <div className="space-y-2">
                  <p className="flex items-center gap-2 text-xs font-semibold uppercase tracking-[0.18em] text-primary">
                    <KeyRound className="h-3.5 w-3.5" />
                    Chave Desktop
                  </p>
                  <p className="font-mono text-sm text-foreground">
                    {desktopKeyUnlocked ? 'Protegida' : 'Disponivel apos plano ativo'}
                  </p>
                  <p className="text-sm text-muted-foreground">
                    {desktopKeyStatusMessage}
                  </p>
                </div>

                {isDesktopRuntime ? null : (
                  <Badge variant="outline">Nao exibida no navegador</Badge>
                )}
              </div>
            </div>

            <div className="flex flex-wrap gap-2">
              <Badge variant="outline" className="gap-2">
                <FileBadge2 className="h-3.5 w-3.5" />
                {savedForm.cnpj.trim() ? maskDocument(savedForm.cnpj) : 'CNPJ pendente'}
              </Badge>
              <Badge variant="secondary">
                {savedForm.stateRegistration.trim() ? 'IE protegida' : 'IE pendente'}
              </Badge>
            </div>
          </>
        )}
      </CardContent>
    </Card>
  );
}
