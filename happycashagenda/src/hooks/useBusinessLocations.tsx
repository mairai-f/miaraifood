import { useState, useEffect } from 'react';
import { supabase } from '@/integrations/supabase/client';

interface BusinessLocation {
  id: string;
  name: string;
  address: string;
  phone: string | null;
  google_maps_embed_url: string | null;
}

export function useBusinessLocations() {
  const [locations, setLocations] = useState<BusinessLocation[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const fetch = async () => {
      const { data } = await supabase
        .from('business_locations')
        .select('*')
        .eq('is_active', true)
        .order('created_at');
      if (data) setLocations(data);
      setLoading(false);
    };
    fetch();
  }, []);

  return { locations, loading };
}
