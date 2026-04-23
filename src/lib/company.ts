import { supabase } from '@/integrations/supabase/client';

export const DEFAULT_COMPANY_NAME = 'HappyCash';

const normalizeCompanyName = (value: string | null | undefined) => value?.trim() ?? '';

export const resolveCompanyDisplayName = (...candidates: Array<string | null | undefined>) => {
  for (const candidate of candidates) {
    const normalized = normalizeCompanyName(candidate);
    if (normalized) return normalized;
  }

  return DEFAULT_COMPANY_NAME;
};

export const fetchCompanyDisplayName = async (ownerUserId: string | null | undefined) => {
  if (!ownerUserId) return DEFAULT_COMPANY_NAME;

  try {
    const [
      { data: storeAccountData, error: storeAccountError },
      { data: fiscalSettingsData, error: fiscalSettingsError },
    ] = await Promise.all([
      supabase.from('store_accounts').select('nome_estabelecimento').eq('owner_user_id', ownerUserId).maybeSingle(),
      supabase.from('store_fiscal_settings').select('issuer_trade_name, issuer_legal_name').eq('owner_user_id', ownerUserId).maybeSingle(),
    ]);

    if (storeAccountError || fiscalSettingsError) {
      return DEFAULT_COMPANY_NAME;
    }

    return resolveCompanyDisplayName(
      storeAccountData?.nome_estabelecimento,
      fiscalSettingsData?.issuer_trade_name,
      fiscalSettingsData?.issuer_legal_name,
    );
  } catch {
    return DEFAULT_COMPANY_NAME;
  }
};
