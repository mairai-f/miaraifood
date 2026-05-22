import { useMemo } from "react";
import { Copy, Loader2, QrCode } from "lucide-react";
import { QRCodeSVG } from "qrcode.react";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { useToast } from "@/hooks/use-toast";
import { buildAgendaPixCopyPaste } from "@/lib/agendaPix";

type PixPaymentDialogProps = {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  pixKey: string;
  merchantName: string;
  amount: number;
  loading?: boolean;
  onConfirmSent: () => void;
};

export function PixPaymentDialog({
  open,
  onOpenChange,
  pixKey,
  merchantName,
  amount,
  loading = false,
  onConfirmSent,
}: PixPaymentDialogProps) {
  const { toast } = useToast();
  const copyPaste = useMemo(
    () =>
      buildAgendaPixCopyPaste({
        pixKey,
        amount,
        merchantName,
      }),
    [amount, merchantName, pixKey],
  );

  const handleCopy = async () => {
    if (!copyPaste) return;
    try {
      await navigator.clipboard.writeText(copyPaste);
      toast({ title: "Codigo Pix copiado" });
    } catch {
      toast({
        title: "Nao foi possivel copiar",
        variant: "destructive",
      });
    }
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-md">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <QrCode className="h-5 w-5" />
            Pague com Pix
          </DialogTitle>
          <DialogDescription>
            Escaneie o QR Code ou copie o codigo. Depois de pagar, confirme abaixo. O administrador validara o pagamento no painel.
          </DialogDescription>
        </DialogHeader>

        {!copyPaste ? (
          <p className="text-sm text-destructive">
            A chave Pix da empresa ainda nao foi configurada. Escolha pagar no local ou avise o administrador.
          </p>
        ) : (
          <div className="space-y-4">
            <div className="flex justify-center rounded-xl border bg-white p-4">
              <QRCodeSVG value={copyPaste} size={220} level="M" includeMargin />
            </div>
            <p className="text-center text-lg font-bold text-primary">
              R$ {amount.toFixed(2)}
            </p>
            <Button type="button" variant="outline" className="w-full gap-2" onClick={handleCopy}>
              <Copy className="h-4 w-4" />
              Copiar codigo Pix
            </Button>
          </div>
        )}

        <Button
          type="button"
          className="w-full"
          disabled={loading || !copyPaste}
          onClick={onConfirmSent}
        >
          {loading ? (
            <>
              <Loader2 className="mr-2 h-4 w-4 animate-spin" />
              Registrando...
            </>
          ) : (
            "Ja paguei — aguardar confirmacao"
          )}
        </Button>
      </DialogContent>
    </Dialog>
  );
}
