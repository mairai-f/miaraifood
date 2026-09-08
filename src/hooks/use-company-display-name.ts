import { useEffect, useState } from 'react';

import { useAuth } from '@/contexts/AuthContext';
import { DEFAULT_COMPANY_NAME, fetchCompanyDisplayName } from '@/lib/company';

export function useCompanyDisplayName() {
  const { ownerUserId } = useAuth();
  const [companyDisplayName, setCompanyDisplayName] = useState(DEFAULT_COMPANY_NAME);

  useEffect(() => {
    let active = true;

    if (!ownerUserId) {
      setCompanyDisplayName(DEFAULT_COMPANY_NAME);
      return () => {
        active = false;
      };
    }

    void fetchCompanyDisplayName(ownerUserId).then(name => {
      if (active) {
        setCompanyDisplayName(name);
      }
    });

    return () => {
      active = false;
    };
  }, [ownerUserId]);

  return companyDisplayName;
}
