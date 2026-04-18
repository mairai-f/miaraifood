import { useEffect, useMemo, useState } from 'react';
import { Loader2, Receipt, Save, ShieldCheck } from 'lucide-react';
import { toast } from 'sonner';
import { useAuth } from '@/contexts/AuthContext';
import { supabase } from '@/integrations/supabase/client';
import { Alert, AlertDescription, AlertTitle } from '@/components/ui/alert';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { PasswordInput } from '@/components/ui/password-input';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { Switch } from '@/components/ui/switch';
import { Textarea } from '@/components/ui/textarea';

const db = supabase as any;

type NfceEnvironment = 'homologacao' | 'producao';
type TaxRegime = '' | '1' | '2' | '3';

interface NfceSettingsForm {
  nfceEnabled: boolean;
  nfceEnvironment: NfceEnvironment;
  nfceSeries: string;
  nfceNextNumber: string;
  issuerState: 'SP';
  issuerLegalName: string;
  issuerTradeName: string;
  issuerCnpj: string;
  issuerStateRegistration: string;
  issuerTaxRegime: TaxRegime;
  operationNature: string;
  cscId: string;
  cscToken: string;
  addressStreet: string;
  addressNumber: string;
  addressComplement: string;
  addressDistrict: string;
  addressCity: string;
  addressZipCode: string;
  danfeMessage: string;
  contingencyOfflineEnabled: boolean;
  printCustomerCopy: boolean;
}

const defaultForm: NfceSettingsForm = {
  nfceEnabled: false,
  nfceEnvironment: 'homologacao',
  nfceSeries: '1',
  nfceNextNumber: '1',
  issuerState: 'SP',
  issuerLegalName: '',
  issuerTradeName: '',
  issuerCnpj: '',
  issuerStateRegistration: '',
  issuerTaxRegime: '',
  operationNature: 'Venda de mercadoria',
  cscId: '',
  cscToken: '',
  addressStreet: '',
  addressNumber: '',
  addressComplement: '',
  addressDistrict: '',
  addressCity: '',
  addressZipCode: '',
  danfeMessage: '',
  contingencyOfflineEnabled: true,
  printCustomerCopy: true,
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

const formatZipCode = (value: string) => {
  const digits = digitsOnly(value).slice(0, 8);
  return digits.replace(/^(\d{5})(\d)/, '$1-$2');
};

const toOptionalText = (value: string) => {
  const normalized = value.trim();
  return normalized ? normalized : null;
};

const getMissingItems = (form: NfceSettingsForm) => {
  const requiredChecks = [
    ['Razao social do emitente', form.issuerLegalName],
    ['CNPJ do emitente', digitsOnly(form.issuerCnpj).length === 14 ? 'ok' : ''],
    ['Inscricao estadual', form.issuerStateRegistration],
    ['Regime tributario (CRT)', form.issuerTaxRegime],
    ['Natureza da operacao', form.operationNature],
    ['CSC ID', form.cscId],
    ['CSC token', form.cscToken],
    ['Logradouro', form.addressStreet],
    ['Numero', form.addressNumber],
    ['Bairro', form.addressDistrict],
    ['Municipio', form.addressCity],
    ['CEP', digitsOnly(form.addressZipCode).length === 8 ? 'ok' : ''],
    ['Serie NFC-e', Number.parseInt(form.nfceSeries, 10) > 0 ? 'ok' : ''],
    ['Proximo numero NFC-e', Number.parseInt(form.nfceNextNumber, 10) > 0 ? 'ok' : ''],
  ] as const;

  return requiredChecks
    .filter(([, value]) => !value)
    .map(([label]) => label);
};

const getStorageErrorMessage = (error: unknown) => {
  const message = error instanceof Error ? error.message : String(error ?? '');
  const loweredMessage = message.toLowerCase();

  if (loweredMessage.includes('store_fiscal_settings')) {
    return 'A base ainda nao possui a migration da configuracao fiscal. Aplique as migrations do Supabase antes de salvar.';
  }

  return 'Nao foi possivel salvar a configuracao fiscal agora.';
};

const mapRowToForm = (row: Record<string, unknown> | null | undefined): NfceSettingsForm => {
  if (!row) return defaultForm;

  return {
    nfceEnabled: Boolean(row.nfce_enabled),
    nfceEnvironment: row.nfce_environment === 'producao' ? 'producao' : 'homologacao',
    nfceSeries: String(row.nfce_series ?? 1),
    nfceNextNumber: String(row.nfce_next_number ?? 1),
    issuerState: 'SP',
    issuerLegalName: String(row.issuer_legal_name ?? ''),
    issuerTradeName: String(row.issuer_trade_name ?? ''),
    issuerCnpj: formatCnpj(String(row.issuer_cnpj ?? '')),
    issuerStateRegistration: String(row.issuer_state_registration ?? ''),
    issuerTaxRegime: row.issuer_tax_regime === '1' || row.issuer_tax_regime === '2' || row.issuer_tax_regime === '3'
      ? row.issuer_tax_regime
      : '',
    operationNature: String(row.operation_nature ?? 'Venda de mercadoria'),
    cscId: String(row.csc_id ?? ''),
    cscToken: String(row.csc_token ?? ''),
    addressStreet: String(row.address_street ?? ''),
    addressNumber: String(row.address_number ?? ''),
    addressComplement: String(row.address_complement ?? ''),
    addressDistrict: String(row.address_district ?? ''),
    addressCity: String(row.address_city ?? ''),
    addressZipCode: formatZipCode(String(row.address_zip_code ?? '')),
    danfeMessage: String(row.danfe_message ?? ''),
    contingencyOfflineEnabled: row.contingency_offline_enabled !== false,
    printCustomerCopy: row.print_customer_copy !== false,
  };
};

export function NfceSettingsPanel() {
  const { isAdmin, ownerUserId, user } = useAuth();
  const [form, setForm] = useState<NfceSettingsForm>(defaultForm);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [loadError, setLoadError] = useState('');
  const [lastSavedAt, setLastSavedAt] = useState<string | null>(null);

  useEffect(() => {
    if (!isAdmin) return;

    if (!ownerUserId) {
      setLoading(false);
      return;
    }

    let active = true;

    const loadSettings = async () => {
      setLoading(true);
      setLoadError('');

      const { data, error } = await db
        .from('store_fiscal_settings')
        .select('*')
        .eq('owner_user_id', ownerUserId)
        .maybeSingle();

      if (!active) return;

      if (error) {
        setLoadError(getStorageErrorMessage(error));
        setLoading(false);
        return;
      }

      setForm(mapRowToForm(data as Record<string, unknown> | null));
      setLastSavedAt(typeof data?.updated_at === 'string' ? data.updated_at : null);
      setLoading(false);
    };

    void loadSettings();

    return () => {
      active = false;
    };
  }, [isAdmin, ownerUserId]);

  const missingItems = useMemo(() => getMissingItems(form), [form]);
  const isReadyForActivation = missingItems.length === 0;
  const statusLabel = form.nfceEnabled
    ? (isReadyForActivation ? 'Configuracao ativa' : 'Atencao: incompleta')
    : (isReadyForActivation ? 'Pronta para integrar' : 'Rascunho');
  const statusVariant = form.nfceEnabled
    ? (isReadyForActivation ? 'default' : 'destructive')
    : (isReadyForActivation ? 'secondary' : 'outline');

  if (!isAdmin) return null;

  const updateForm = <K extends keyof NfceSettingsForm>(field: K, value: NfceSettingsForm[K]) => {
    setForm(current => ({ ...current, [field]: value }));
  };

  const handleSave = async () => {
    if (!ownerUserId || !user?.id) {
      toast.error('Nao foi possivel identificar a loja para salvar a configuracao.');
      return;
    }

    const series = Number.parseInt(form.nfceSeries, 10);
    const nextNumber = Number.parseInt(form.nfceNextNumber, 10);
    const cnpjDigits = digitsOnly(form.issuerCnpj);
    const zipCodeDigits = digitsOnly(form.addressZipCode);

    if (!Number.isInteger(series) || series <= 0) {
      toast.error('Informe uma serie NFC-e valida.');
      return;
    }

    if (!Number.isInteger(nextNumber) || nextNumber <= 0) {
      toast.error('Informe o proximo numero da NFC-e com valor valido.');
      return;
    }

    if (form.issuerCnpj.trim() && cnpjDigits.length !== 14) {
      toast.error('O CNPJ precisa ter 14 digitos.');
      return;
    }

    if (form.addressZipCode.trim() && zipCodeDigits.length !== 8) {
      toast.error('O CEP precisa ter 8 digitos.');
      return;
    }

    if (form.nfceEnabled && !isReadyForActivation) {
      toast.error('Complete os campos obrigatorios antes de ativar a NFC-e.');
      return;
    }

    setSaving(true);

    const payload = {
      owner_user_id: ownerUserId,
      nfce_enabled: form.nfceEnabled,
      nfce_environment: form.nfceEnvironment,
      nfce_series: series,
      nfce_next_number: nextNumber,
      issuer_state: 'SP',
      issuer_legal_name: toOptionalText(form.issuerLegalName),
      issuer_trade_name: toOptionalText(form.issuerTradeName),
      issuer_cnpj: cnpjDigits || null,
      issuer_state_registration: toOptionalText(form.issuerStateRegistration),
      issuer_tax_regime: form.issuerTaxRegime || null,
      operation_nature: toOptionalText(form.operationNature),
      csc_id: toOptionalText(form.cscId),
      csc_token: toOptionalText(form.cscToken),
      address_street: toOptionalText(form.addressStreet),
      address_number: toOptionalText(form.addressNumber),
      address_complement: toOptionalText(form.addressComplement),
      address_district: toOptionalText(form.addressDistrict),
      address_city: toOptionalText(form.addressCity),
      address_zip_code: zipCodeDigits || null,
      danfe_message: toOptionalText(form.danfeMessage),
      contingency_offline_enabled: form.contingencyOfflineEnabled,
      print_customer_copy: form.printCustomerCopy,
      updated_by_user_id: user.id,
    };

    const { data, error } = await db
      .from('store_fiscal_settings')
      .upsert(payload, { onConflict: 'owner_user_id' })
      .select('updated_at')
      .single();

    setSaving(false);

    if (error) {
      const message = getStorageErrorMessage(error);
      toast.error(message);
      setLoadError(message);
      return;
    }

    setLastSavedAt(typeof data?.updated_at === 'string' ? data.updated_at : new Date().toISOString());
    setLoadError('');
    toast.success('Configuracao fiscal da NFC-e salva.');
  };

  return (
    <Card>
      <CardHeader className="space-y-3">
        <div className="flex flex-wrap items-center gap-2">
          <CardTitle className="flex items-center gap-2 text-base">
            <Receipt className="h-4 w-4 text-primary" />
            NFC-e SP
          </CardTitle>
          <Badge variant="outline">Fase 1</Badge>
          <Badge variant={statusVariant}>{statusLabel}</Badge>
        </div>
        <p className="text-sm text-muted-foreground">
          Cadastro fiscal inicial da loja para a NFC-e em Sao Paulo. Esta etapa ainda nao transmite para a SEFAZ no PDV.
        </p>
      </CardHeader>
      <CardContent className="space-y-6">
        <Alert>
          <ShieldCheck className="h-4 w-4" />
          <AlertTitle>Somente administrador</AlertTitle>
          <AlertDescription>
            O acesso a este modulo fica restrito ao painel administrativo. Os dados de CSC e emitente nao ficam expostos para operadores nesta fase.
          </AlertDescription>
        </Alert>

        {loadError && (
          <Alert variant="destructive">
            <AlertTitle>Falha ao carregar configuracao fiscal</AlertTitle>
            <AlertDescription>{loadError}</AlertDescription>
          </Alert>
        )}

        {loading ? (
          <div className="flex items-center gap-2 text-sm text-muted-foreground">
            <Loader2 className="h-4 w-4 animate-spin" />
            Carregando configuracao fiscal...
          </div>
        ) : (
          <>
            <div className="grid gap-4 lg:grid-cols-[1.2fr_0.8fr]">
              <div className="space-y-4 rounded-lg border border-border/60 p-4">
                <div className="flex flex-wrap items-center justify-between gap-3">
                  <div>
                    <p className="text-sm font-medium">Ativacao da NFC-e</p>
                    <p className="text-xs text-muted-foreground">
                      Comece em homologacao e so avance para producao quando a configuracao estiver validada.
                    </p>
                  </div>
                  <div className="flex items-center gap-3">
                    <Label htmlFor="nfce-enabled">Ativar</Label>
                    <Switch
                      id="nfce-enabled"
                      checked={form.nfceEnabled}
                      onCheckedChange={checked => updateForm('nfceEnabled', checked)}
                    />
                  </div>
                </div>

                <div className="grid gap-4 md:grid-cols-3">
                  <div className="space-y-1">
                    <Label>Ambiente</Label>
                    <Select
                      value={form.nfceEnvironment}
                      onValueChange={value => updateForm('nfceEnvironment', value as NfceEnvironment)}
                    >
                      <SelectTrigger>
                        <SelectValue />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="homologacao">Homologacao</SelectItem>
                        <SelectItem value="producao">Producao</SelectItem>
                      </SelectContent>
                    </Select>
                  </div>

                  <div className="space-y-1">
                    <Label>Serie NFC-e</Label>
                    <Input
                      inputMode="numeric"
                      value={form.nfceSeries}
                      onChange={event => updateForm('nfceSeries', event.target.value.replace(/[^\d]/g, '').slice(0, 3) || '1')}
                    />
                  </div>

                  <div className="space-y-1">
                    <Label>Proximo numero</Label>
                    <Input
                      inputMode="numeric"
                      value={form.nfceNextNumber}
                      onChange={event => updateForm('nfceNextNumber', event.target.value.replace(/[^\d]/g, '').slice(0, 9) || '1')}
                    />
                  </div>
                </div>
              </div>

              <div className="space-y-3 rounded-lg border border-border/60 p-4">
                <div>
                  <p className="text-sm font-medium">Checklist de prontidao</p>
                  <p className="text-xs text-muted-foreground">
                    Isso prepara a loja para a proxima etapa: emissao no PDV e DANFE simplificado.
                  </p>
                </div>

                {missingItems.length === 0 ? (
                  <p className="text-sm text-emerald-600">
                    Configuracao base preenchida. A loja esta pronta para a etapa de integracao no PDV.
                  </p>
                ) : (
                  <ul className="list-disc space-y-1 pl-5 text-sm text-muted-foreground">
                    {missingItems.map(item => (
                      <li key={item}>{item}</li>
                    ))}
                  </ul>
                )}

                <p className="text-xs text-muted-foreground">
                  Certificado digital, transmissao SEFAZ, contingencia operacional e impressao real do DANFE entram na proxima fase.
                </p>
              </div>
            </div>

            <div className="space-y-4 rounded-lg border border-border/60 p-4">
              <div>
                <p className="text-sm font-medium">Dados do emitente</p>
                <p className="text-xs text-muted-foreground">
                  Informacoes fiscais basicas da empresa que vai emitir a NFC-e.
                </p>
              </div>

              <div className="grid gap-4 md:grid-cols-2">
                <div className="space-y-1">
                  <Label>Razao social</Label>
                  <Input
                    value={form.issuerLegalName}
                    onChange={event => updateForm('issuerLegalName', event.target.value)}
                    placeholder="Empresa Exemplo LTDA"
                  />
                </div>

                <div className="space-y-1">
                  <Label>Nome fantasia</Label>
                  <Input
                    value={form.issuerTradeName}
                    onChange={event => updateForm('issuerTradeName', event.target.value)}
                    placeholder="HappyCash"
                  />
                </div>

                <div className="space-y-1">
                  <Label>CNPJ</Label>
                  <Input
                    value={form.issuerCnpj}
                    onChange={event => updateForm('issuerCnpj', formatCnpj(event.target.value))}
                    placeholder="00.000.000/0000-00"
                  />
                </div>

                <div className="space-y-1">
                  <Label>Inscricao estadual</Label>
                  <Input
                    value={form.issuerStateRegistration}
                    onChange={event => updateForm('issuerStateRegistration', event.target.value)}
                    placeholder="110042490114"
                  />
                </div>

                <div className="space-y-1">
                  <Label>CRT</Label>
                  <Select
                    value={form.issuerTaxRegime}
                    onValueChange={value => updateForm('issuerTaxRegime', value as TaxRegime)}
                  >
                    <SelectTrigger>
                      <SelectValue placeholder="Selecione o regime" />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="1">1 - Simples Nacional</SelectItem>
                      <SelectItem value="2">2 - Simples excesso sublimite</SelectItem>
                      <SelectItem value="3">3 - Regime normal</SelectItem>
                    </SelectContent>
                  </Select>
                </div>

                <div className="space-y-1">
                  <Label>Natureza da operacao</Label>
                  <Input
                    value={form.operationNature}
                    onChange={event => updateForm('operationNature', event.target.value)}
                    placeholder="Venda de mercadoria"
                  />
                </div>
              </div>
            </div>

            <div className="space-y-4 rounded-lg border border-border/60 p-4">
              <div>
                <p className="text-sm font-medium">Endereco do emitente</p>
                <p className="text-xs text-muted-foreground">
                  Endereco fiscal da loja emissora em Sao Paulo.
                </p>
              </div>

              <div className="grid gap-4 md:grid-cols-2">
                <div className="space-y-1 md:col-span-2">
                  <Label>Logradouro</Label>
                  <Input
                    value={form.addressStreet}
                    onChange={event => updateForm('addressStreet', event.target.value)}
                    placeholder="Rua Exemplo"
                  />
                </div>

                <div className="space-y-1">
                  <Label>Numero</Label>
                  <Input
                    value={form.addressNumber}
                    onChange={event => updateForm('addressNumber', event.target.value)}
                    placeholder="123"
                  />
                </div>

                <div className="space-y-1">
                  <Label>Complemento</Label>
                  <Input
                    value={form.addressComplement}
                    onChange={event => updateForm('addressComplement', event.target.value)}
                    placeholder="Sala 2"
                  />
                </div>

                <div className="space-y-1">
                  <Label>Bairro</Label>
                  <Input
                    value={form.addressDistrict}
                    onChange={event => updateForm('addressDistrict', event.target.value)}
                    placeholder="Centro"
                  />
                </div>

                <div className="space-y-1">
                  <Label>Municipio</Label>
                  <Input
                    value={form.addressCity}
                    onChange={event => updateForm('addressCity', event.target.value)}
                    placeholder="Sao Paulo"
                  />
                </div>

                <div className="space-y-1">
                  <Label>UF</Label>
                  <Input value="SP" disabled />
                </div>

                <div className="space-y-1">
                  <Label>CEP</Label>
                  <Input
                    value={form.addressZipCode}
                    onChange={event => updateForm('addressZipCode', formatZipCode(event.target.value))}
                    placeholder="00000-000"
                  />
                </div>
              </div>
            </div>

            <div className="space-y-4 rounded-lg border border-border/60 p-4">
              <div>
                <p className="text-sm font-medium">Seguranca e DANFE simplificado</p>
                <p className="text-xs text-muted-foreground">
                  O CSC sera usado na integracao futura com o QR Code e a consulta da NFC-e.
                </p>
              </div>

              <div className="grid gap-4 md:grid-cols-2">
                <div className="space-y-1">
                  <Label>CSC ID</Label>
                  <Input
                    value={form.cscId}
                    onChange={event => updateForm('cscId', event.target.value)}
                    placeholder="000001"
                  />
                </div>

                <div className="space-y-1">
                  <Label>CSC token</Label>
                  <PasswordInput
                    value={form.cscToken}
                    onChange={event => updateForm('cscToken', event.target.value)}
                    placeholder="Codigo de seguranca do contribuinte"
                  />
                </div>
              </div>

              <div className="grid gap-4 md:grid-cols-2">
                <div className="flex items-center justify-between rounded-lg border border-border/60 p-3">
                  <div className="pr-3">
                    <p className="text-sm font-medium">Contingencia offline</p>
                    <p className="text-xs text-muted-foreground">
                      Mantem o caminho preparado para emissao em contingencia na fase operacional.
                    </p>
                  </div>
                  <Switch
                    checked={form.contingencyOfflineEnabled}
                    onCheckedChange={checked => updateForm('contingencyOfflineEnabled', checked)}
                  />
                </div>

                <div className="flex items-center justify-between rounded-lg border border-border/60 p-3">
                  <div className="pr-3">
                    <p className="text-sm font-medium">Imprimir via do consumidor</p>
                    <p className="text-xs text-muted-foreground">
                      Preferencia inicial para o DANFE-NFC-e simplificado.
                    </p>
                  </div>
                  <Switch
                    checked={form.printCustomerCopy}
                    onCheckedChange={checked => updateForm('printCustomerCopy', checked)}
                  />
                </div>
              </div>

              <div className="space-y-1">
                <Label>Mensagem padrao do DANFE simplificado</Label>
                <Textarea
                  value={form.danfeMessage}
                  onChange={event => updateForm('danfeMessage', event.target.value)}
                  placeholder="Volte sempre. Documento emitido em ambiente de homologacao."
                />
              </div>
            </div>

            <div className="flex flex-wrap items-center justify-between gap-3 rounded-lg border border-border/60 p-4">
              <div className="text-sm text-muted-foreground">
                {lastSavedAt
                  ? `Ultima gravacao: ${new Date(lastSavedAt).toLocaleString('pt-BR')}`
                  : 'Nenhuma configuracao fiscal salva ainda.'}
              </div>
              <Button onClick={() => void handleSave()} disabled={saving}>
                {saving ? (
                  <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                ) : (
                  <Save className="mr-2 h-4 w-4" />
                )}
                Salvar configuracao fiscal
              </Button>
            </div>
          </>
        )}
      </CardContent>
    </Card>
  );
}
