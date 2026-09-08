import { isProbablyOfflineError } from '@/lib/offlineConcentrator';

export const shouldUseOfflineSnapshotFallback = (errors: unknown[]) => {
  const relevantErrors = errors.filter(Boolean);

  if (relevantErrors.length === 0) {
    return false;
  }

  return relevantErrors.every((error) => isProbablyOfflineError(error));
};
