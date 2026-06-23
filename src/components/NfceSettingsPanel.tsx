import { useEffect, useMemo, useState } from 'react';
import { Cloud, Loader2, Receipt, Save, ShieldCheck, Upload } from 'lucide-react';
import { toast } from 'sonner';
import { formatDateTime } from '../../shared/locale/format';
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

// Generated Supabase types are behind the current schema for these fiscal tables.
// eslint-disable-next-line @typescript-eslint/no-explicit-any
const db = supabase as any;

type NfceEnvironment = 'homologacao' | 'producao';
type TaxRegime = '' | '1' | '2' | '3';
type FiscalProvider = 'internal' | 'nuvem_fiscal';
type FiscalMode = 'receipt_only' | 'nfce';
type DanfePrintWidth = '80mm' | '58mm';

interface NfceSettingsForm {
  fiscalMode: FiscalMode;
  fiscalProvider: FiscalProvider;
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
  issuerCityIbgeCode: string;
  addressZipCode: string;
  danfeMessage: string;
  contingencyOfflineEnabled: boolean;
  printCustomerCopy: boolean;
  danfeAutoPrint: boolean;
  danfeStoreLocally: boolean;
  consumerDocumentPromptEnabled: boolean;
  danfePrintWidth: DanfePrintWidth;
}

interface NuvemFiscalSyncState {
  companySyncedAt: string | null;
  nfceConfigSyncedAt: string | null;
  certificateSyncedAt: string | null;
  lastError: string | null;
}

const defaultForm: NfceSettingsForm = {
  fiscalMode: 'receipt_only',
  fiscalProvider: 'internal',
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
  issuerCityIbgeCode: '',
  addressZipCode: '',
  danfeMessage: '',
  contingencyOfflineEnabled: true,
  printCustomerCopy: true,
  danfeAutoPrint: false,
  danfeStoreLocally: true,
  consumerDocumentPromptEnabled: true,
  danfePrintWidth: '80mm',
};

const defaultNuvemFiscalSyncState: NuvemFiscalSyncState = {
  companySyncedAt: null,
  nfceConfigSyncedAt: null,
  certificateSyncedAt: null,
  lastError: null,
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
  if (form.fiscalMode === 'receipt_only') {
    return [];
  }

  const requiredChecks = [
    ['Razao social do emitente', form.issuerLegalName],
    ['CNPJ do emitente', digitsOnly(form.issuerCnpj).length === 14 ? 'ok' : ''],
    ['Inscricao estadual', form.issuerStateRegistration],
    ['Regime tributario (CRT)', form.issuerTaxRegime],
    ['Natureza da operacao', form.operationNature],
    ['CSC ID', digitsOnly(form.cscId) ? 'ok' : ''],
    ['CSC token', form.cscToken],
    ['Logradouro', form.addressStreet],
    ['Numero', form.addressNumber],
    ['Bairro', form.addressDistrict],
    ['Municipio', form.addressCity],
    ...(form.fiscalProvider === 'nuvem_fiscal'
      ? [['Codigo IBGE do municipio', digitsOnly(form.issuerCityIbgeCode).length === 7 ? 'ok' : '']] as const
      : []),
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
    return 'A base ainda nao possui a migration da configuracao fiscal. Aplique as migrations antes de salvar.';
  }

  return 'Nao foi possivel salvar a configuracao fiscal agora.';
};

const mapRowToForm = (row: Record<string, unknown> | null | undefined): NfceSettingsForm => {
  if (!row) return defaultForm;

  return {
    fiscalMode: row.fiscal_mode === 'nfce' || row.nfce_enabled === true ? 'nfce' : 'receipt_only',
    nfceEnabled: Boolean(row.nfce_enabled),
    fiscalProvider: row.fiscal_provider === 'nuvem_fiscal' ? 'nuvem_fiscal' : 'internal',
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
    issuerCityIbgeCode: digitsOnly(String(row.issuer_city_ibge_code ?? '')).slice(0, 7),
    addressZipCode: formatZipCode(String(row.address_zip_code ?? '')),
    danfeMessage: String(row.danfe_message ?? ''),
    contingencyOfflineEnabled: row.contingency_offline_enabled !== false,
    printCustomerCopy: row.print_customer_copy !== false,
    danfeAutoPrint: row.danfe_auto_print === true,
    danfeStoreLocally: row.danfe_store_locally !== false,
    consumerDocumentPromptEnabled: row.consumer_document_prompt_enabled !== false,
    danfePrintWidth: row.danfe_print_width === '58mm' ? '58mm' : '80mm',
  };
};

export function NfceSettingsPanel() {
  const { isAdmin, ownerUserId, session, user } = useAuth();
  const [form, setForm] = useState<NfceSettingsForm>(defaultForm);
  const [nuvemFiscalSync, setNuvemFiscalSync] = useState<NuvemFiscalSyncState>(defaultNuvemFiscalSyncState);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [syncingNuvemFiscal, setSyncingNuvemFiscal] = useState(false);
  const [uploadingCertificate, setUploadingCertificate] = useState(false);
  const [certificateBase64, setCertificateBase64] = useState('');
  const [certificateFileName, setCertificateFileName] = useState('');
  const [certificatePassword, setCertificatePassword] = useState('');
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
      setNuvemFiscalSync({
        companySyncedAt: typeof data?.nuvem_fiscal_company_synced_at === 'string' ? data.nuvem_fiscal_company_synced_at : null,
        nfceConfigSyncedAt: typeof data?.nuvem_fiscal_nfce_config_synced_at === 'string' ? data.nuvem_fiscal_nfce_config_synced_at : null,
        certificateSyncedAt: typeof data?.nuvem_fiscal_certificate_synced_at === 'string' ? data.nuvem_fiscal_certificate_synced_at : null,
        lastError: typeof data?.nuvem_fiscal_last_error === 'string' ? data.nuvem_fiscal_last_error : null,
      });
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
  const statusLabel = form.fiscalMode === 'receipt_only'
    ? 'Recibo interno'
    : form.nfceEnabled
    ? (isReadyForActivation ? 'Configuracao ativa' : 'Atencao: incompleta')
    : (isReadyForActivation ? 'Pronta para integrar' : 'Rascunho');
  const statusVariant = form.fiscalMode === 'receipt_only'
    ? 'secondary'
    : form.nfceEnabled
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
    const cityIbgeCodeDigits = digitsOnly(form.issuerCityIbgeCode);

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

    if (form.fiscalMode === 'nfce' && form.fiscalProvider === 'nuvem_fiscal' && cityIbgeCodeDigits.length !== 7) {
      toast.error('Informe o codigo IBGE do municipio com 7 digitos para usar a Nuvem Fiscal.');
      return;
    }

    if (form.fiscalMode === 'nfce' && form.nfceEnabled && !isReadyForActivation) {
      toast.error('Complete os campos obrigatorios antes de ativar a NFC-e.');
      return;
    }

    setSaving(true);

    const payload = {
      owner_user_id: ownerUserId,
      fiscal_mode: form.fiscalMode,
      fiscal_provider: form.fiscalProvider,
      nfce_enabled: form.fiscalMode === 'nfce' ? form.nfceEnabled : false,
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
      issuer_city_ibge_code: cityIbgeCodeDigits || null,
      address_zip_code: zipCodeDigits || null,
      danfe_message: toOptionalText(form.danfeMessage),
      contingency_offline_enabled: form.contingencyOfflineEnabled,
      print_customer_copy: form.printCustomerCopy,
      danfe_auto_print: form.danfeAutoPrint,
      danfe_store_locally: form.danfeStoreLocally,
      consumer_document_prompt_enabled: form.consumerDocumentPromptEnabled,
      danfe_print_width: form.danfePrintWidth,
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

  const handleSyncNuvemFiscalSettings = async () => {
    if (!session?.access_token) {
      toast.error('Sua sessao expirou. Entre novamente para sincronizar com a Nuvem Fiscal.');
      return;
    }

    setSyncingNuvemFiscal(true);

    const { data, error } = await supabase.functions.invoke<{
      success?: boolean;
      error?: string;
      companySyncedAt?: string;
      nfceConfigSyncedAt?: string;
    }>('manage-fiscal-documents', {
      headers: {
        Authorization: `Bearer ${session.access_token}`,
      },
      body: {
        action: 'sync_nuvem_fiscal_settings',
      },
    });

    setSyncingNuvemFiscal(false);

    if (error || !data?.success) {
      toast.error(data?.error || 'Nao foi possivel sincronizar a Nuvem Fiscal.');
      return;
    }

    setNuvemFiscalSync(current => ({
      ...current,
      companySyncedAt: data.companySyncedAt ?? new Date().toISOString(),
      nfceConfigSyncedAt: data.nfceConfigSyncedAt ?? new Date().toISOString(),
      lastError: null,
    }));
    toast.success('Empresa e configuracao NFC-e sincronizadas com a Nuvem Fiscal.');
  };

  const handleCertificateFileChange = (file: File | null) => {
    setCertificateBase64('');
    setCertificateFileName('');

    if (!file) return;

    const reader = new FileReader();
    reader.onload = () => {
      const result = typeof reader.result === 'string' ? reader.result : '';
      setCertificateBase64(result.includes(',') ? result.split(',').pop() || '' : result);
      setCertificateFileName(file.name);
    };
    reader.onerror = () => {
      toast.error('Nao foi possivel ler o certificado.');
    };
    reader.readAsDataURL(file);
  };

  const handleUploadCertificate = async () => {
    if (!session?.access_token) {
      toast.error('Sua sessao expirou. Entre novamente para enviar o certificado.');
      return;
    }

    if (!certificateBase64 || !certificatePassword.trim()) {
      toast.error('Selecione o certificado A1 e informe a senha.');
      return;
    }

    setUploadingCertificate(true);

    const { data, error } = await supabase.functions.invoke<{
      success?: boolean;
      error?: string;
      certificateSyncedAt?: string;
    }>('manage-fiscal-documents', {
      headers: {
        Authorization: `Bearer ${session.access_token}`,
      },
      body: {
        action: 'upload_nuvem_fiscal_certificate',
        certificateBase64,
        password: certificatePassword,
      },
    });

    setUploadingCertificate(false);

    if (error || !data?.success) {
      toast.error(data?.error || 'Nao foi possivel enviar o certificado para a Nuvem Fiscal.');
      return;
    }

    setCertificateBase64('');
    setCertificateFileName('');
    setCertificatePassword('');
    setNuvemFiscalSync(current => ({
      ...current,
      certificateSyncedAt: data.certificateSyncedAt ?? new Date().toISOString(),
      lastError: null,
    }));
    toast.success('Certificado A1 enviado para a Nuvem Fiscal.');
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
          Cadastro fiscal da loja para NFC-e em Sao Paulo, com homologacao interna ou transmissao pela Nuvem Fiscal.
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
                      disabled={form.fiscalMode === 'receipt_only'}
                      onCheckedChange={checked => updateForm('nfceEnabled', checked)}
                    />
                  </div>
                </div>

                <div className="grid gap-4 md:grid-cols-3">
                  <div className="space-y-1">
                    <Label>Modo fiscal</Label>
                    <Select
                      value={form.fiscalMode}
                      onValueChange={value => {
                        const nextMode = value as FiscalMode;
                        updateForm('fiscalMode', nextMode);
                        if (nextMode === 'receipt_only') {
                          updateForm('nfceEnabled', false);
                        }
                      }}
                    >
                      <SelectTrigger>
                        <SelectValue />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="receipt_only">Recibo interno</SelectItem>
                        <SelectItem value="nfce">Emitir NFC-e</SelectItem>
                      </SelectContent>
                    </Select>
                  </div>

                  <div className="space-y-1">
                    <Label>Provedor fiscal</Label>
                    <Select
                      value={form.fiscalProvider}
                      disabled={form.fiscalMode === 'receipt_only'}
                      onValueChange={value => updateForm('fiscalProvider', value as FiscalProvider)}
                    >
                      <SelectTrigger>
                        <SelectValue />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="internal">Homologacao interna</SelectItem>
                        <SelectItem value="nuvem_fiscal">Nuvem Fiscal</SelectItem>
                      </SelectContent>
                    </Select>
                  </div>

                  <div className="space-y-1">
                    <Label>Ambiente</Label>
                    <Select
                      value={form.nfceEnvironment}
                      disabled={form.fiscalMode === 'receipt_only'}
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
                    Isso prepara a loja para emitir no PDV quando o provedor fiscal estiver pronto.
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
                  Para Nuvem Fiscal, sincronize a empresa, configure o certificado A1 e complete os dados fiscais dos produtos.
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
                  <Label>Codigo IBGE do municipio</Label>
                  <Input
                    inputMode="numeric"
                    value={form.issuerCityIbgeCode}
                    onChange={event => updateForm('issuerCityIbgeCode', digitsOnly(event.target.value).slice(0, 7))}
                    placeholder="3550308"
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

                <div className="flex items-center justify-between rounded-lg border border-border/60 p-3">
                  <div className="pr-3">
                    <p className="text-sm font-medium">Arquivar DANFE no computador</p>
                    <p className="text-xs text-muted-foreground">
                      Salva HTML e metadados da nota em Documentos/HappyCash/NotasFiscais no desktop.
                    </p>
                  </div>
                  <Switch
                    checked={form.danfeStoreLocally}
                    onCheckedChange={checked => updateForm('danfeStoreLocally', checked)}
                  />
                </div>

                <div className="flex items-center justify-between rounded-lg border border-border/60 p-3">
                  <div className="pr-3">
                    <p className="text-sm font-medium">Imprimir DANFE automaticamente</p>
                    <p className="text-xs text-muted-foreground">
                      Envia o DANFE direto para a impressora selecionada quando a NFC-e for emitida.
                    </p>
                  </div>
                  <Switch
                    checked={form.danfeAutoPrint}
                    onCheckedChange={checked => updateForm('danfeAutoPrint', checked)}
                  />
                </div>

                <div className="flex items-center justify-between rounded-lg border border-border/60 p-3">
                  <div className="pr-3">
                    <p className="text-sm font-medium">Perguntar CPF/CNPJ na nota</p>
                    <p className="text-xs text-muted-foreground">
                      Mostra o campo no fechamento da venda para Nota Fiscal Paulista.
                    </p>
                  </div>
                  <Switch
                    checked={form.consumerDocumentPromptEnabled}
                    onCheckedChange={checked => updateForm('consumerDocumentPromptEnabled', checked)}
                  />
                </div>

                <div className="space-y-1 rounded-lg border border-border/60 p-3">
                  <Label>Largura do DANFE</Label>
                  <Select
                    value={form.danfePrintWidth}
                    onValueChange={value => updateForm('danfePrintWidth', value as DanfePrintWidth)}
                  >
                    <SelectTrigger>
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="80mm">Bematech 80mm</SelectItem>
                      <SelectItem value="58mm">Termica 58mm</SelectItem>
                    </SelectContent>
                  </Select>
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

            {form.fiscalProvider === 'nuvem_fiscal' && (
              <div className="space-y-4 rounded-lg border border-border/60 p-4">
                <div>
                  <p className="flex items-center gap-2 text-sm font-medium">
                    <Cloud className="h-4 w-4 text-primary" />
                    Nuvem Fiscal
                  </p>
                  <p className="text-xs text-muted-foreground">
                    Use credenciais em secrets do Supabase. O certificado e a senha sao enviados direto para a Nuvem Fiscal e nao ficam salvos no HappyCash.
                  </p>
                </div>

                {nuvemFiscalSync.lastError && (
                  <Alert variant="destructive">
                    <AlertTitle>Ultima falha da Nuvem Fiscal</AlertTitle>
                    <AlertDescription>{nuvemFiscalSync.lastError}</AlertDescription>
                  </Alert>
                )}

                <div className="grid gap-3 text-sm md:grid-cols-3">
                  <div className="rounded-lg border border-border/60 p-3">
                    <p className="font-medium">Empresa</p>
                    <p className="text-xs text-muted-foreground">
                      {nuvemFiscalSync.companySyncedAt ? formatDateTime(nuvemFiscalSync.companySyncedAt) : 'Nao sincronizada'}
                    </p>
                  </div>
                  <div className="rounded-lg border border-border/60 p-3">
                    <p className="font-medium">Configuracao NFC-e</p>
                    <p className="text-xs text-muted-foreground">
                      {nuvemFiscalSync.nfceConfigSyncedAt ? formatDateTime(nuvemFiscalSync.nfceConfigSyncedAt) : 'Nao sincronizada'}
                    </p>
                  </div>
                  <div className="rounded-lg border border-border/60 p-3">
                    <p className="font-medium">Certificado A1</p>
                    <p className="text-xs text-muted-foreground">
                      {nuvemFiscalSync.certificateSyncedAt ? formatDateTime(nuvemFiscalSync.certificateSyncedAt) : 'Nao enviado por aqui'}
                    </p>
                  </div>
                </div>

                <div className="flex flex-wrap gap-2">
                  <Button type="button" variant="outline" onClick={() => void handleSyncNuvemFiscalSettings()} disabled={syncingNuvemFiscal || saving}>
                    {syncingNuvemFiscal ? (
                      <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                    ) : (
                      <Cloud className="mr-2 h-4 w-4" />
                    )}
                    Sincronizar empresa e NFC-e
                  </Button>
                </div>

                <div className="grid gap-4 md:grid-cols-[1fr_1fr_auto]">
                  <div className="space-y-1">
                    <Label>Certificado A1 (.pfx/.p12)</Label>
                    <Input
                      type="file"
                      accept=".pfx,.p12,application/x-pkcs12"
                      onChange={event => handleCertificateFileChange(event.target.files?.[0] ?? null)}
                    />
                    {certificateFileName && <p className="text-xs text-muted-foreground">{certificateFileName}</p>}
                  </div>
                  <div className="space-y-1">
                    <Label>Senha do certificado</Label>
                    <PasswordInput
                      value={certificatePassword}
                      onChange={event => setCertificatePassword(event.target.value)}
                      placeholder="Senha do A1"
                    />
                  </div>
                  <div className="flex items-end">
                    <Button type="button" variant="outline" onClick={() => void handleUploadCertificate()} disabled={uploadingCertificate || !certificateBase64 || !certificatePassword.trim()}>
                      {uploadingCertificate ? (
                        <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                      ) : (
                        <Upload className="mr-2 h-4 w-4" />
                      )}
                      Enviar
                    </Button>
                  </div>
                </div>
              </div>
            )}

            <div className="flex flex-wrap items-center justify-between gap-3 rounded-lg border border-border/60 p-4">
              <div className="text-sm text-muted-foreground">
                {lastSavedAt
                  ? `Ultima gravacao: ${formatDateTime(lastSavedAt)}`
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
