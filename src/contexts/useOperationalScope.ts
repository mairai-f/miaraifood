import { useContext } from 'react';
import { OperationalScopeContext } from '@/contexts/operational-scope-context';

export const useOperationalScope = () => {
  const context = useContext(OperationalScopeContext);
  if (!context) throw new Error('useOperationalScope deve ser usado dentro de OperationalScopeProvider.');
  return context;
};
