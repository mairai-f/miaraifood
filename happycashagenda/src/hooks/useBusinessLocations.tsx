import { useState, useEffect } from 'react';
import { supabase } from '@/integrations/supabase/client';

interface BusinessLocation {
  id: string;
  name: string;
  address: string;
  phone: string | null;
  google_maps_embed_url: string | null;
}

export function useBusinessLocations(storeAccountId?: string) {
  const [locations, setLocations] = useState<BusinessLocation[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const fetch = async () => {
      if (!storeAccountId) {
        setLocations([]);
        setLoading(false);
        return;
      }

      const { data } = await supabase
        .from('business_locations')
        .select('*')
        .eq('store_account_id', storeAccountId)
        .eq('is_active', true)
        .order('created_at');
      if (data) setLocations(data);
      setLoading(false);
    };
    fetch();
  }, [storeAccountId]);

  return { locations, loading };
}
