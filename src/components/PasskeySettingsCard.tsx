import { useCallback, useEffect, useState } from 'react';
import { Fingerprint, Loader2, ShieldCheck, Trash2 } from 'lucide-react';
import { toast } from 'sonner';

import { useAuth } from '@/contexts/AuthContext';
import { getPasskeySupportErrorMessage, type PasskeyEntry } from '@/lib/passkeys';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';

const formatDateTime = (value?: string) => {
  if (!value) return 'Nunca usado';

  const parsed = new Date(value);
  if (Number.isNaN(parsed.getTime())) return 'Data invalida';
  return parsed.toLocaleString('pt-BR');
};

const formatPasskeyLabel = (passkey: PasskeyEntry) =>
  passkey.friendly_name?.trim() || `Chave de acesso ${passkey.id.slice(0, 8)}`;

export function PasskeySettingsCard() {
  const { isAdmin, registerPasskey, listPasskeys, deletePasskey } = useAuth();
  const [passkeys, setPasskeys] = useState<PasskeyEntry[]>([]);
  const [loading, setLoading] = useState(true);
  const [registering, setRegistering] = useState(false);
  const [deletingId, setDeletingId] = useState<string | null>(null);
  const supportError = getPasskeySupportErrorMessage();

  const loadPasskeys = useCallback(async () => {
    if (!isAdmin) {
      setPasskeys([]);
      setLoading(false);
      return;
    }

    if (supportError) {
      setPasskeys([]);
      setLoading(false);
      return;
    }

    setLoading(true);

    try {
      const nextPasskeys = await listPasskeys();
      setPasskeys(nextPasskeys);
    } catch (error) {
      toast.error(error instanceof Error ? error.message : 'Nao foi possivel carregar as biometrias cadastradas.');
    } finally {
      setLoading(false);
    }
  }, [isAdmin, listPasskeys, supportError]);

  useEffect(() => {
    void loadPasskeys();
  }, [loadPasskeys]);

  if (!isAdmin) return null;

  const handleRegister = async () => {
    if (registering) return;

    setRegistering(true);

    try {
      const createdPasskey = await registerPasskey();
      toast.success(`${formatPasskeyLabel(createdPasskey)} cadastrada neste navegador.`);
      await loadPasskeys();
    } catch (error) {
      toast.error(error instanceof Error ? error.message : 'Nao foi possivel cadastrar a biometria.');
    } finally {
      setRegistering(false);
    }
  };

  const handleDelete = async (passkey: PasskeyEntry) => {
    if (deletingId) return;

    if (typeof window !== 'undefined' && !window.confirm(`Remover ${formatPasskeyLabel(passkey)}?`)) {
      return;
    }

    setDeletingId(passkey.id);

    try {
      await deletePasskey(passkey.id);
      setPasskeys(current => current.filter(item => item.id !== passkey.id));
      toast.success('Biometria removida deste navegador.');
    } catch (error) {
      toast.error(error instanceof Error ? error.message : 'Nao foi possivel remover esta biometria.');
    } finally {
      setDeletingId(null);
    }
  };

  return (
    <Card>
      <CardHeader className="space-y-3">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <div className="space-y-2">
            <CardTitle className="flex items-center gap-2 text-base">
              <Fingerprint className="h-4 w-4 text-primary" />
              Biometria e passkeys
            </CardTitle>
            <p className="text-sm text-muted-foreground">
              Digital ou rosto ficam no aparelho. O HappyCash recebe apenas a validacao criptografica.
            </p>
          </div>
          <Badge variant={supportError ? 'outline' : 'default'}>
            {supportError ? 'Disponivel so no navegador seguro' : 'Pronto para uso'}
          </Badge>
        </div>
      </CardHeader>

      <CardContent className="space-y-4">
        <div className="rounded-lg border border-primary/15 bg-primary/5 p-4 text-sm text-muted-foreground">
          <div className="flex items-start gap-3">
            <ShieldCheck className="mt-0.5 h-4 w-4 shrink-0 text-primary" />
            <div className="space-y-1">
              <p className="font-medium text-foreground">Cadastre a biometria ou reconhecimento facial deste navegador.</p>
              <p>
                A passkey fica vinculada ao administrador para manter este dispositivo preparado com uma validacao segura.
              </p>
            </div>
          </div>
        </div>

        {supportError ? (
          <div className="rounded-lg border border-border/70 bg-background/60 p-4 text-sm text-muted-foreground">
            {supportError}
          </div>
        ) : (
          <>
            <div className="flex flex-wrap items-center gap-2">
              <Button type="button" onClick={() => void handleRegister()} disabled={loading || registering || Boolean(deletingId)}>
                {registering ? (
                  <>
                    <Loader2 className="animate-spin" />
                    Cadastrando...
                  </>
                ) : (
                  <>
                    <Fingerprint />
                    Cadastrar biometria neste navegador
                  </>
                )}
              </Button>
              <Button
                type="button"
                variant="outline"
                onClick={() => void loadPasskeys()}
                disabled={loading || registering || Boolean(deletingId)}
              >
                {loading ? (
                  <>
                    <Loader2 className="animate-spin" />
                    Atualizando...
                  </>
                ) : (
                  'Atualizar lista'
                )}
              </Button>
            </div>

            {loading ? (
              <div className="rounded-lg border border-border/70 bg-background/60 p-4 text-sm text-muted-foreground">
                Carregando biometrias cadastradas...
              </div>
            ) : passkeys.length === 0 ? (
              <div className="rounded-lg border border-dashed border-border/70 bg-background/60 p-4 text-sm text-muted-foreground">
                Nenhuma biometria cadastrada neste navegador ainda.
              </div>
            ) : (
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Dispositivo</TableHead>
                    <TableHead>Cadastrado em</TableHead>
                    <TableHead>Ultimo uso</TableHead>
                    <TableHead className="text-right">Acao</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {passkeys.map((passkey) => (
                    <TableRow key={passkey.id}>
                      <TableCell>
                        <div className="font-medium">{formatPasskeyLabel(passkey)}</div>
                        <div className="text-xs text-muted-foreground">{passkey.id}</div>
                      </TableCell>
                      <TableCell>{formatDateTime(passkey.created_at)}</TableCell>
                      <TableCell>{formatDateTime(passkey.last_used_at)}</TableCell>
                      <TableCell className="text-right">
                        <Button
                          type="button"
                          variant="outline"
                          size="sm"
                          onClick={() => void handleDelete(passkey)}
                          disabled={registering || deletingId === passkey.id}
                        >
                          {deletingId === passkey.id ? (
                            <>
                              <Loader2 className="animate-spin" />
                              Removendo...
                            </>
                          ) : (
                            <>
                              <Trash2 />
                              Remover
                            </>
                          )}
                        </Button>
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            )}
          </>
        )}
      </CardContent>
    </Card>
  );
}
