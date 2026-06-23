import { AlertTriangle } from "lucide-react";
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
import { cn } from "@/lib/utils";

interface FiscalResponsibilityNoticeProps {
  compact?: boolean;
  className?: string;
}

export function FiscalResponsibilityNotice({ compact = false, className }: FiscalResponsibilityNoticeProps) {
  return (
    <Alert className={cn("border-amber-300/60 bg-amber-50 text-amber-950", className)}>
      <AlertTriangle className="h-4 w-4 text-amber-700" />
      <AlertTitle>{compact ? "NFC-e exige configuracao do estabelecimento" : "Responsabilidade fiscal do estabelecimento"}</AlertTitle>
      <AlertDescription className="space-y-2 text-sm text-amber-950/85">
        <p>
          O HappyCash pode oferecer recibo interno e modulo de NFC-e, mas a emissao fiscal real depende de dados e providencias do proprio estabelecimento.
        </p>
        {!compact && (
          <p>
            Para emitir NFC-e, o cliente deve confirmar obrigatoriedade com o contador, possuir CNPJ/IE aptos, certificado A1, CSC/credenciamento na SEFAZ, dados fiscais dos produtos e, quando usado, conta propria em provedor fiscal.
          </p>
        )}
      </AlertDescription>
    </Alert>
  );
}
