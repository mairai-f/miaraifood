import { useEffect, useState } from 'react';
import { KeyRound, ShieldCheck } from 'lucide-react';

import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { PasswordInput } from '@/components/ui/password-input';
import {
  isValidOfflineAdminPin,
  isValidOfflineAdminUsername,
  offlineAdminPinHelpText,
  offlineAdminUsernameHelpText,
  normalizeOfflineAdminUsername,
} from '@/lib/offlineAdminAccess';

interface DesktopOfflineAdminSetupDialogProps {
  open: boolean;
  defaultUsername: string;
  companyName: string | null;
  deviceLabel?: 'maquina' | 'aparelho';
  submitting: boolean;
  onSubmit: (payload: { username: string; pin: string }) => Promise<void>;
}

export function DesktopOfflineAdminSetupDialog({
  open,
  defaultUsername,
  companyName,
  deviceLabel = 'maquina',
  submitting,
  onSubmit,
}: DesktopOfflineAdminSetupDialogProps) {
  const [username, setUsername] = useState(defaultUsername);
  const [pin, setPin] = useState('');
  const [confirmPin, setConfirmPin] = useState('');
  const [error, setError] = useState<string | null>(null);
  const deviceSetupReference = deviceLabel === 'aparelho' ? 'deste aparelho' : 'desta maquina';
  const deviceActivatedReference = deviceLabel === 'aparelho' ? 'neste aparelho' : 'nesta maquina';
  const deviceOnlyReference = deviceLabel === 'aparelho' ? 'neste aparelho' : 'neste computador';

  useEffect(() => {
    if (!open) return;
    setUsername(defaultUsername);
    setPin('');
    setConfirmPin('');
    setError(null);
  }, [defaultUsername, open]);

  const handleSubmit = async () => {
    const normalizedUsername = normalizeOfflineAdminUsername(username);
    const normalizedPin = pin.trim();

    if (!isValidOfflineAdminUsername(normalizedUsername)) {
      setError(offlineAdminUsernameHelpText);
      return;
    }

    if (!isValidOfflineAdminPin(normalizedPin)) {
      setError(offlineAdminPinHelpText);
      return;
    }

    if (normalizedPin !== confirmPin.trim()) {
      setError('Confirme o mesmo PIN para liberar o acesso offline.');
      return;
    }

    setError(null);
    await onSubmit({
      username: normalizedUsername,
      pin: normalizedPin,
    });
  };

  return (
    <Dialog open={open}>
      <DialogContent
        className="max-w-lg border-border/70 bg-card/95 backdrop-blur"
        onEscapeKeyDown={(event) => event.preventDefault()}
        onInteractOutside={(event) => event.preventDefault()}
      >
        <DialogHeader className="space-y-3">
          <div className="mx-auto flex h-12 w-12 items-center justify-center rounded-full bg-primary/10 text-primary">
            <ShieldCheck className="h-5 w-5" />
          </div>
          <DialogTitle className="text-center">Configure o admin offline {deviceSetupReference}</DialogTitle>
          <DialogDescription className="text-center">
            Depois do primeiro login com email e senha, cadastre um usuario admin e um PIN local. Em seguida o MIAR AI/FOOD baixa os dados da loja e deixa o acesso offline pronto {deviceActivatedReference}.
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-4">
          <div className="rounded-xl border border-primary/20 bg-primary/5 p-4 text-sm text-muted-foreground">
            <p className="font-medium text-foreground">{companyName || `Empresa ativada ${deviceActivatedReference}`}</p>
            <p className="mt-2">
              Esse usuario admin e PIN vao valer apenas {deviceOnlyReference} e ficam vinculados ao administrador desta empresa.
            </p>
          </div>

          <div className="space-y-2">
            <Label htmlFor="offline-admin-username">Usuario admin local</Label>
            <Input
              id="offline-admin-username"
              value={username}
              onChange={(event) => setUsername(event.target.value)}
              placeholder="Ex: admin.loja"
              autoCapitalize="none"
              autoCorrect="off"
              spellCheck={false}
              disabled={submitting}
            />
            <p className="text-xs text-muted-foreground">{offlineAdminUsernameHelpText}</p>
          </div>

          <div className="space-y-2">
            <Label htmlFor="offline-admin-pin">PIN offline</Label>
            <PasswordInput
              id="offline-admin-pin"
              value={pin}
              onChange={(event) => setPin(event.target.value)}
              placeholder="Digite 4 a 8 digitos"
              inputMode="numeric"
              autoComplete="new-password"
              disabled={submitting}
            />
            <p className="flex items-center gap-2 text-xs text-muted-foreground">
              <KeyRound className="h-3.5 w-3.5" />
              {offlineAdminPinHelpText}
            </p>
          </div>

          <div className="space-y-2">
            <Label htmlFor="offline-admin-pin-confirm">Confirmar PIN</Label>
            <PasswordInput
              id="offline-admin-pin-confirm"
              value={confirmPin}
              onChange={(event) => setConfirmPin(event.target.value)}
              placeholder="Repita o PIN"
              inputMode="numeric"
              autoComplete="new-password"
              disabled={submitting}
            />
          </div>

          {error && (
            <div className="rounded-xl border border-destructive/30 bg-destructive/5 p-3 text-sm text-destructive">
              {error}
            </div>
          )}
        </div>

        <DialogFooter>
          <Button type="button" onClick={() => void handleSubmit()} disabled={submitting} className="w-full sm:w-auto">
            {submitting ? 'Salvando acesso offline...' : 'Salvar usuario admin e PIN'}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
