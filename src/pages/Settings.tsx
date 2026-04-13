import { Settings as SettingsIcon } from 'lucide-react';
import { useSearchParams } from 'react-router-dom';
import { OperatorManagementPanel } from '@/components/OperatorManagementPanel';

const CREATE_OPERATOR_MODAL = 'cadastrar-operador';

export default function Settings() {
  const [searchParams, setSearchParams] = useSearchParams();
  const isCreateOperatorModalOpen = searchParams.get('modal') === CREATE_OPERATOR_MODAL;

  const handleCreateDialogOpenChange = (open: boolean) => {
    const nextSearchParams = new URLSearchParams(searchParams);

    if (open) {
      nextSearchParams.set('modal', CREATE_OPERATOR_MODAL);
    } else {
      nextSearchParams.delete('modal');
    }

    setSearchParams(nextSearchParams, { replace: true });
  };

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
    </div>
  );
}
