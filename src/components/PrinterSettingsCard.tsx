import { useCallback, useEffect, useState } from 'react';
import { Loader2, Printer, RefreshCw } from 'lucide-react';
import { toast } from 'sonner';

import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Label } from '@/components/ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';

const SYSTEM_DEFAULT = '__system_default__';

type PrinterEntry = {
  name: string;
  displayName: string;
  description: string;
  isDefault: boolean;
};

export function PrinterSettingsCard() {
  const printerApi = typeof window !== 'undefined' ? window.electronAPI?.printer : undefined;
  const [printers, setPrinters] = useState<PrinterEntry[]>([]);
  const [selectedName, setSelectedName] = useState(SYSTEM_DEFAULT);
  const [defaultName, setDefaultName] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  const [testing, setTesting] = useState(false);

  const loadPrinters = useCallback(async () => {
    if (!printerApi) return;
    setLoading(true);
    try {
      const result = await printerApi.list();
      setPrinters(result.printers);
      setDefaultName(result.defaultName);
      setSelectedName(result.selectedName || SYSTEM_DEFAULT);
    } catch {
      toast.error('Nao foi possivel listar as impressoras deste computador.');
    } finally {
      setLoading(false);
    }
  }, [printerApi]);

  useEffect(() => {
    void loadPrinters();
  }, [loadPrinters]);

  if (!printerApi) return null;

  const handlePrinterChange = async (value: string) => {
    const printerName = value === SYSTEM_DEFAULT ? null : value;
    setSelectedName(value);
    const result = await printerApi.select(printerName);
    if (!result.success) {
      toast.error(result.error || 'Nao foi possivel salvar a impressora.');
      await loadPrinters();
      return;
    }
    toast.success(printerName ? 'Impressora selecionada.' : 'O MIAR AI/FOOD usara a impressora padrao do sistema.');
  };

  const handleTest = async () => {
    setTesting(true);
    try {
      const result = await printerApi.test();
      if (!result.success) {
        toast.error(result.error || 'A impressora recusou o teste.');
        return;
      }
      toast.success('Teste enviado para a impressora.');
    } catch {
      toast.error('Nao foi possivel enviar o teste de impressao.');
    } finally {
      setTesting(false);
    }
  };

  return (
    <Card>
      <CardHeader className="space-y-2">
        <CardTitle className="flex items-center gap-2 text-base">
          <Printer className="h-4 w-4 text-primary" />
          Impressora
        </CardTitle>
        <p className="text-sm text-muted-foreground">
          Funciona com qualquer impressora instalada corretamente no sistema operacional.
        </p>
      </CardHeader>
      <CardContent className="space-y-4">
        <div className="space-y-2">
          <Label>Impressora dos cupons</Label>
          <Select value={selectedName} onValueChange={value => void handlePrinterChange(value)} disabled={loading}>
            <SelectTrigger>
              <SelectValue placeholder="Selecione uma impressora" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value={SYSTEM_DEFAULT}>
                Padrao do sistema{defaultName ? ` (${defaultName})` : ''}
              </SelectItem>
              {printers.map(printer => (
                <SelectItem key={printer.name} value={printer.name}>
                  {printer.displayName}{printer.isDefault ? ' (padrao)' : ''}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
          <p className="text-xs text-muted-foreground">
            {loading ? 'Procurando impressoras...' : `${printers.length} impressora(s) detectada(s).`}
          </p>
        </div>

        <div className="flex flex-wrap gap-2">
          <Button type="button" onClick={() => void handleTest()} disabled={loading || testing || printers.length === 0}>
            {testing ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : <Printer className="mr-2 h-4 w-4" />}
            Imprimir teste
          </Button>
          <Button type="button" variant="outline" onClick={() => void loadPrinters()} disabled={loading}>
            <RefreshCw className={`mr-2 h-4 w-4 ${loading ? 'animate-spin' : ''}`} />
            Atualizar lista
          </Button>
        </div>
      </CardContent>
    </Card>
  );
}
