import { FileText } from 'lucide-react';
import { NfceSettingsPanel } from '@/components/NfceSettingsPanel';

export default function Notes() {
  return (
    <div className="space-y-6">
      <div className="page-header">
        <h1 className="page-title flex items-center gap-3">
          <FileText className="h-6 w-6 text-primary" />
          Notas
        </h1>
        <p className="page-subtitle">
          Area fiscal da loja. Configure a Fase 1 da NFC-e em Sao Paulo apenas no painel do administrador.
        </p>
      </div>

      <NfceSettingsPanel />
    </div>
  );
}
