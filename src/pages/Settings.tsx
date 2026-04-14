import { useCallback, useState } from 'react';
import { Settings as SettingsIcon, ShieldAlert } from 'lucide-react';
import { useSearchParams } from 'react-router-dom';
import { NfceSettingsPanel } from '@/components/NfceSettingsPanel';
import { OperatorManagementPanel } from '@/components/OperatorManagementPanel';
import { useAuth } from '@/contexts/AuthContext';
import { useData } from '@/contexts/DataContext';
import { supabase } from '@/integrations/supabase/client';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import {
  Dialog,
  DialogContent,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from '@/components/ui/dialog';
import { toast } from 'sonner';

const CREATE_OPERATOR_MODAL = 'cadastrar-operador';
const RESET_CONFIRM_TEXT = 'ZERAR';
type ResetTarget = 'financial' | 'reports';

interface ResetActionResponse {
  success?: boolean;
  deleted?: {
    sales?: number;
    saleItems?: number;
    expenses?: number;
    payments?: number;
    debtEntries?: number;
  };
  error?: string;
}

export default function Settings() {
  const { session } = useAuth();
  const { refetch } = useData();
  const [searchParams, setSearchParams] = useSearchParams();
  const isCreateOperatorModalOpen = searchParams.get('modal') === CREATE_OPERATOR_MODAL;
  const [resetTarget, setResetTarget] = useState<ResetTarget | null>(null);
  const [resetDialogOpen, setResetDialogOpen] = useState(false);
  const [adminEmail, setAdminEmail] = useState('');
  const [adminPassword, setAdminPassword] = useState('');
  const [confirmationText, setConfirmationText] = useState('');
  const [resetError, setResetError] = useState('');
  const [resettingData, setResettingData] = useState(false);

  const handleCreateDialogOpenChange = (open: boolean) => {
    const nextSearchParams = new URLSearchParams(searchParams);

    if (open) {
      nextSearchParams.set('modal', CREATE_OPERATOR_MODAL);
    } else {
      nextSearchParams.delete('modal');
    }

    setSearchParams(nextSearchParams, { replace: true });
  };

  const resolveFunctionErrorMessage = useCallback(async (
    error: unknown,
    fallbackMessage: string,
    data?: ResetActionResponse
  ) => {
    let functionErrorMessage = data?.error || fallbackMessage;

    if (error && typeof error === 'object' && 'context' in error && error.context instanceof Response) {
      try {
        const errorPayload = await error.context.clone().json() as { error?: string; message?: string };
        functionErrorMessage = errorPayload.error || errorPayload.message || functionErrorMessage;
      } catch {
        functionErrorMessage = error.context.status === 401
          ? 'Sua sessão expirou. Entre novamente para continuar.'
          : functionErrorMessage;
      }
    }

    return functionErrorMessage;
  }, []);

  const resetResetDialogState = useCallback(() => {
    setAdminEmail('');
    setAdminPassword('');
    setConfirmationText('');
    setResetError('');
    setResetTarget(null);
  }, []);

  const handleResetDialogOpenChange = useCallback((open: boolean) => {
    setResetDialogOpen(open);
    if (!open) {
      resetResetDialogState();
    }
  }, [resetResetDialogState]);

  const handleResetFinancialAndReports = async () => {
    if (!resetTarget) {
      setResetError('Selecione o tipo de limpeza que deseja executar.');
      return;
    }

    if (!session?.access_token) {
      setResetError('Sua sessão expirou. Faça login novamente.');
      return;
    }

    if (!adminEmail.trim() || !adminPassword.trim()) {
      setResetError('Informe login e senha do administrador.');
      return;
    }

    if (confirmationText.trim().toUpperCase() !== RESET_CONFIRM_TEXT) {
      setResetError('Digite ZERAR para confirmar a limpeza.');
      return;
    }

    setResetError('');
    setResettingData(true);

    try {
      const action = resetTarget === 'financial' ? 'reset_financial' : 'reset_reports';

      const { data, error } = await supabase.functions.invoke<ResetActionResponse>('manage-operators', {
        headers: {
          Authorization: `Bearer ${session.access_token}`,
        },
        body: {
          action,
          adminEmail: adminEmail.trim(),
          adminPassword: adminPassword.trim(),
        },
      });

      if (error || !data?.success) {
        const fallbackMessage = resetTarget === 'financial'
          ? 'Não foi possível zerar o financeiro.'
          : 'Não foi possível zerar os relatórios.';
        const message = await resolveFunctionErrorMessage(error, fallbackMessage, data);
        setResetError(message);
        toast.error(message);
        return;
      }

      await refetch();

      const deleted = data.deleted ?? {};
      if (resetTarget === 'financial') {
        toast.success(
          `Financeiro zerado: ${deleted.expenses ?? 0} despesa(s), ${deleted.debtEntries ?? 0} fiado(s), ${deleted.payments ?? 0} pagamento(s).`
        );
      } else {
        toast.success(
          `Relatórios zerados: ${deleted.sales ?? 0} venda(s) e ${deleted.saleItems ?? 0} item(ns) de venda.`
        );
      }
      handleResetDialogOpenChange(false);
    } catch {
      const fallbackMessage = 'Não foi possível concluir a limpeza agora. Tente novamente.';
      setResetError(fallbackMessage);
      toast.error(fallbackMessage);
    } finally {
      setResettingData(false);
    }
  };

  const openResetDialog = useCallback((target: ResetTarget) => {
    setResetTarget(target);
    setResetError('');
    setResetDialogOpen(true);
  }, []);

  const resetTitle = resetTarget === 'financial'
    ? 'Confirmar limpeza de financeiro'
    : 'Confirmar limpeza de relatórios';

  const resetDescription = resetTarget === 'financial'
    ? 'Serão removidos despesas, fiados e pagamentos da loja.'
    : 'Serão removidas vendas e itens vendidos usados nos relatórios.';

  return (
    <div className="space-y-6">
      <div className="page-header">
        <h1 className="page-title flex items-center gap-3">
          <SettingsIcon className="h-6 w-6 text-primary" />
          Configuracoes
        </h1>
        <p className="page-subtitle">
          Gerencie acessos da loja e abra o cadastro de operadores pelo seu nome no menu lateral.
        </p>
      </div>

      <OperatorManagementPanel
        createDialogOpen={isCreateOperatorModalOpen}
        onCreateDialogOpenChange={handleCreateDialogOpenChange}
      />

      <NfceSettingsPanel />

      <Card className="border-destructive/30">
        <CardHeader className="space-y-2">
          <CardTitle className="flex items-center gap-2 text-base text-destructive">
            <ShieldAlert className="h-4 w-4" />
            Zona de risco
          </CardTitle>
          <p className="text-sm text-muted-foreground">
            Escolha exatamente o que deseja zerar. Cada ação pede confirmação e credencial de administrador.
          </p>
        </CardHeader>
        <CardContent className="space-y-3">
          <p className="text-sm text-muted-foreground">
            Os clientes, produtos e operadores continuam cadastrados.
          </p>

          <Dialog open={resetDialogOpen} onOpenChange={handleResetDialogOpenChange}>
            <div className="flex flex-wrap gap-2">
              <DialogTrigger asChild>
                <Button variant="destructive" onClick={() => openResetDialog('financial')}>
                  Zerar financeiro
                </Button>
              </DialogTrigger>
              <DialogTrigger asChild>
                <Button variant="destructive" onClick={() => openResetDialog('reports')}>
                  Zerar relatórios
                </Button>
              </DialogTrigger>
            </div>
            <DialogContent>
              <DialogHeader>
                <DialogTitle>{resetTitle}</DialogTitle>
              </DialogHeader>

              <div className="space-y-3">
                <div className="rounded-md border border-destructive/30 bg-destructive/10 p-3 text-sm text-destructive">
                  Ação irreversível: os dados apagados não poderão ser recuperados. {resetDescription}
                </div>

                <div className="space-y-1">
                  <Label>Login do administrador (email)</Label>
                  <Input
                    type="email"
                    value={adminEmail}
                    onChange={event => setAdminEmail(event.target.value)}
                    placeholder="admin@empresa.com"
                    autoComplete="username"
                  />
                </div>

                <div className="space-y-1">
                  <Label>Senha do administrador</Label>
                  <Input
                    type="password"
                    value={adminPassword}
                    onChange={event => setAdminPassword(event.target.value)}
                    placeholder="Digite a senha"
                    autoComplete="current-password"
                  />
                </div>

                <div className="space-y-1">
                  <Label>Confirmação final</Label>
                  <Input
                    value={confirmationText}
                    onChange={event => setConfirmationText(event.target.value)}
                    placeholder='Digite "ZERAR" para confirmar'
                  />
                </div>

                {resetError && (
                  <p className="text-sm font-medium text-destructive">{resetError}</p>
                )}
              </div>

              <DialogFooter>
                <Button
                  variant="outline"
                  onClick={() => handleResetDialogOpenChange(false)}
                  disabled={resettingData}
                >
                  Cancelar
                </Button>
                <Button
                  variant="destructive"
                  onClick={() => void handleResetFinancialAndReports()}
                  disabled={resettingData}
                >
                  {resettingData ? 'Zerando...' : 'Confirmar e zerar'}
                </Button>
              </DialogFooter>
            </DialogContent>
          </Dialog>
        </CardContent>
      </Card>
    </div>
  );
}
