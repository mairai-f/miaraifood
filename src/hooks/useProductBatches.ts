import { useCallback, useEffect, useState } from 'react';

import { useAuth } from '@/contexts/AuthContext';
import { supabase } from '@/integrations/supabase/client';
import { getRedactedLogValue } from '../../shared/security/redaction';

export type ProductBatchSummary = {
  id: string;
  product_id: string | null;
  product_name: string;
  batch_code: string;
  quantity: number;
  expiration_date: string;
  alert_days: number;
};

export function useProductBatches() {
  const { user, ownerUserId } = useAuth();
  const effectiveOwnerId = ownerUserId ?? user?.id ?? '';
  const [batches, setBatches] = useState<ProductBatchSummary[]>([]);

  const loadBatches = useCallback(async () => {
    if (!effectiveOwnerId) {
      setBatches([]);
      return;
    }

    const { data, error } = await supabase
      .from('product_batches' as never)
      .select('id, product_id, product_name, batch_code, quantity, expiration_date, alert_days')
      .eq('owner_user_id', effectiveOwnerId)
      .order('expiration_date', { ascending: true });

    if (error) {
      console.error('Erro ao carregar validades dos produtos:', getRedactedLogValue(error));
      return;
    }

    setBatches((data ?? []) as ProductBatchSummary[]);
  }, [effectiveOwnerId]);

  useEffect(() => {
    void loadBatches();
  }, [loadBatches]);

  return { batches, loadBatches };
}
