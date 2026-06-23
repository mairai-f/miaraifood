import { useCallback, useEffect, useState } from 'react';
import { FileText, Loader2, Printer, RefreshCw } from 'lucide-react';
import { supabase } from '@/integrations/supabase/client';
import { useDesktopRuntime } from '@/contexts/DesktopRuntimeContext';
import {
  FiscalDocumentRecord,
  fiscalStatusLabel,
  fiscalStatusVariant,
  formatMoney,
  normalizeFiscalDocumentRecord,
  openFiscalDocumentPrintWindow,
} from '@/lib/fiscal';
import { readDesktopActivation } from '@/lib/desktopActivation';
import { canUseDesktopFiscalModule, getDesktopFiscalBlockedMessage } from '@/lib/fiscalAccess';
import { NfceSettingsPanel } from '@/components/NfceSettingsPanel';
import { Alert, AlertDescription, AlertTitle } from '@/components/ui/alert';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { formatDateTime } from '../../shared/locale/format';

// Generated Supabase types are behind the current fiscal schema.
// eslint-disable-next-line @typescript-eslint/no-explicit-any
const db = supabase as any;

export default function Notes() {
  const { isDesktop, licensed, planId } = useDesktopRuntime();
  const desktopActivation = readDesktopActivation();
  const canUseFiscalModule = canUseDesktopFiscalModule({
    isDesktop,
    licensed,
    planId,
    activation: desktopActivation,
  });
  const fiscalBlockedMessage = getDesktopFiscalBlockedMessage({
    isDesktop,
    licensed,
    planId,
    activation: desktopActivation,
  });
  const [documents, setDocuments] = useState<FiscalDocumentRecord[]>([]);
  const [loadingDocuments, setLoadingDocuments] = useState(true);
  const [documentsError, setDocumentsError] = useState('');

  const loadDocuments = useCallback(async () => {
    if (!canUseFiscalModule) {
      setDocuments([]);
      setDocumentsError('');
      setLoadingDocuments(false);
      return;
    }

    setLoadingDocuments(true);
    setDocumentsError('');

    const { data, error } = await db
      .from('fiscal_documents')
      .select('*')
      .eq('document_model', '65')
      .order('emitted_at', { ascending: false })
      .limit(20);

    if (error) {
      const message = String(error.message ?? '').toLowerCase().includes('fiscal_documents')
        ? 'A migration dos documentos fiscais ainda nao foi aplicada no banco.'
        : 'Nao foi possivel carregar os documentos fiscais da loja.';
      setDocumentsError(message);
      setDocuments([]);
      setLoadingDocuments(false);
      return;
    }

    setDocuments(((data as Record<string, unknown>[] | null) ?? []).map(normalizeFiscalDocumentRecord));
    setLoadingDocuments(false);
  }, [canUseFiscalModule]);

  useEffect(() => {
    void loadDocuments();
  }, [loadDocuments]);

  return (
    <div className="space-y-6">
      <div className="page-header">
        <h1 className="page-title flex items-center gap-3">
          <FileText className="h-6 w-6 text-primary" />
          Notas
        </h1>
        <p className="page-subtitle">
          No web, o HappyCash emite somente cupom/recibo nao fiscal. A NFC-e fica restrita ao HappyCash Desktop PRO.
        </p>
      </div>

      {!canUseFiscalModule ? (
        <Card>
          <CardHeader className="space-y-2">
            <CardTitle className="text-base">NFC-e somente no Desktop PRO</CardTitle>
            <p className="text-sm text-muted-foreground">
              {fiscalBlockedMessage}
            </p>
          </CardHeader>
          <CardContent>
            <Alert>
              <AlertTitle>Web sem emissao fiscal</AlertTitle>
              <AlertDescription>
                Continue usando o PDV web para vender e imprimir cupom nao fiscal. Para NFC-e, use uma maquina ativada no HappyCash Desktop PRO.
              </AlertDescription>
            </Alert>
          </CardContent>
        </Card>
      ) : (
        <>
          <NfceSettingsPanel />

          <Card>
            <CardHeader className="space-y-3">
              <div className="flex flex-wrap items-center justify-between gap-3">
                <CardTitle className="text-base">NFC-e emitidas em homologacao</CardTitle>
                <Button variant="outline" onClick={() => void loadDocuments()} disabled={loadingDocuments}>
                  {loadingDocuments ? (
                    <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                  ) : (
                    <RefreshCw className="mr-2 h-4 w-4" />
                  )}
                  Atualizar
                </Button>
              </div>
              <p className="text-sm text-muted-foreground">
                Esta lista mostra documentos gerados pelo Desktop PRO enquanto a emissao direta SEFAZ/ACBr nao estiver finalizada.
              </p>
            </CardHeader>
            <CardContent className="space-y-4">
              {documentsError && (
                <Alert variant="destructive">
                  <AlertTitle>Falha ao carregar documentos fiscais</AlertTitle>
                  <AlertDescription>{documentsError}</AlertDescription>
                </Alert>
              )}

              {loadingDocuments ? (
                <div className="flex items-center gap-2 text-sm text-muted-foreground">
                  <Loader2 className="h-4 w-4 animate-spin" />
                  Carregando documentos de homologacao...
                </div>
              ) : documents.length === 0 ? (
                <div className="rounded-lg border border-dashed border-border/70 p-6 text-sm text-muted-foreground">
                  Nenhum documento de homologacao emitido ainda. Finalize uma venda no PDV Desktop PRO com a NFC-e habilitada para gerar o primeiro DANFE simplificado.
                </div>
              ) : (
                <div className="space-y-3">
                  {documents.map(document => {
                    const sale = document.payload?.sale ?? {};
                    const sellerName = sale.sellerName || 'Operador nao informado';
                    const total = Number(sale.total ?? 0);
                    const emittedAt = document.emittedAt
                      ? formatDateTime(document.emittedAt)
                      : '-';

                    return (
                      <div
                        key={document.id}
                        className="rounded-lg border border-border/70 p-4"
                      >
                        <div className="flex flex-wrap items-start justify-between gap-3">
                          <div className="space-y-2">
                            <div className="flex flex-wrap items-center gap-2">
                              <p className="text-sm font-semibold">
                                NFC-e {document.number}/{document.series}
                              </p>
                              <Badge variant={fiscalStatusVariant(document.status)}>
                                {fiscalStatusLabel(document.status)}
                              </Badge>
                              <Badge variant="outline">{document.environment}</Badge>
                            </div>

                            <p className="text-sm text-muted-foreground">
                              Operador: {sellerName}
                            </p>
                            <p className="text-sm text-muted-foreground">
                              Total: {formatMoney(total)}
                            </p>
                            <p className="text-xs text-muted-foreground">
                              Emissao: {emittedAt}
                            </p>
                            <p className="text-xs break-all text-muted-foreground">
                              Chave: {document.accessKey}
                            </p>
                          </div>

                          <Button variant="outline" onClick={() => openFiscalDocumentPrintWindow(document)}>
                            <Printer className="mr-2 h-4 w-4" />
                            Abrir DANFE
                          </Button>
                        </div>
                      </div>
                    );
                  })}
                </div>
              )}
            </CardContent>
          </Card>
        </>
      )}
    </div>
  );
}
