import { createContext } from 'react';
import type { OperationalLocation, OperationalScope, OperationalTerminal } from '@/lib/storeScope';

export interface OperationalScopeContextValue {
  loading: boolean;
  scope: OperationalScope | null;
  locations: OperationalLocation[];
  terminals: OperationalTerminal[];
  selectWebScope: (locationId: string, terminalId?: string | null) => void;
  refreshOperationalScope: () => Promise<void>;
}

export const OperationalScopeContext = createContext<OperationalScopeContextValue | null>(null);
