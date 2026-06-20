import { useEffect, useState } from 'react';

import { useAuth } from '@/contexts/AuthContext';
import { supabase } from '@/integrations/supabase/client';
import { DEFAULT_COMPANY_NAME } from '@/lib/company';

export interface StoreReceiptProfile {
  storeName: string;
  taxId: string;
  phone: string;
  address: string;
}

const emptyProfile: StoreReceiptProfile = {
  storeName: DEFAULT_COMPANY_NAME,
  taxId: '',
  phone: '',
  address: '',
};

const cacheKey = (ownerUserId: string) => `happycash-receipt-profile:${ownerUserId}`;

const readCachedProfile = (ownerUserId: string) => {
  try {
    const value = window.localStorage.getItem(cacheKey(ownerUserId));
    return value ? { ...emptyProfile, ...JSON.parse(value) } as StoreReceiptProfile : null;
  } catch {
    return null;
  }
};

export function useStoreReceiptProfile() {
  const { ownerUserId } = useAuth();
  const [profile, setProfile] = useState<StoreReceiptProfile>(emptyProfile);

  useEffect(() => {
    let active = true;

    if (!ownerUserId) {
      setProfile(emptyProfile);
      return () => {
        active = false;
      };
    }

    const cached = readCachedProfile(ownerUserId);
    if (cached) setProfile(cached);

    // Generated Supabase types are behind this safe receipt-only RPC.
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const db = supabase as any;
    void db.rpc('get_store_receipt_profile').then(({ data, error }: {
      data?: Array<Record<string, unknown>> | null;
      error?: unknown;
    }) => {
      if (!active || error || !data?.[0]) return;

      const row = data[0];
      const nextProfile: StoreReceiptProfile = {
        storeName: String(row.store_name || DEFAULT_COMPANY_NAME),
        taxId: String(row.tax_id || ''),
        phone: String(row.phone || ''),
        address: String(row.address || ''),
      };
      setProfile(nextProfile);
      try {
        window.localStorage.setItem(cacheKey(ownerUserId), JSON.stringify(nextProfile));
      } catch {
        // The fresh value remains available for the current session.
      }
    });

    return () => {
      active = false;
    };
  }, [ownerUserId]);

  return profile;
}
