import { useCallback, useEffect, useMemo, useState, type ReactNode } from 'react';
import { useAuth } from '@/contexts/AuthContext';
import { OperationalScopeContext, type OperationalScopeContextValue } from '@/contexts/operational-scope-context';
import { useDesktopRuntime } from '@/contexts/DesktopRuntimeContext';
import { supabase } from '@/integrations/supabase/client';
import { readDesktopActivation } from '@/lib/desktopActivation';
import {
  readOperationalScopeCache,
  writeOperationalScopeCache,
  type OperationalLocation,
  type OperationalScope,
  type OperationalTerminal,
  type PosTerminalType,
  type StoreLocationType,
} from '@/lib/storeScope';
import { getRedactedLogValue } from '../../shared/security/redaction';

interface LocationRow {
  id: string;
  code: string;
  name: string;
  location_type: StoreLocationType;
  is_headquarters: boolean;
}
interface TerminalRow {
  id: string;
  location_id: string;
  code: string;
  name: string;
  terminal_type: PosTerminalType;
}

interface DesktopScopeRow {
  location_id: string;
  location_code: string;
  location_name: string;
  location_type: StoreLocationType;
  is_headquarters: boolean;
  terminal_id: string;
  terminal_code: string;
  terminal_name: string;
  terminal_type: PosTerminalType;
}

const mapLocation = (row: LocationRow): OperationalLocation => ({
  id: row.id,
  code: row.code,
  name: row.name,
  locationType: row.location_type,
  isHeadquarters: row.is_headquarters,
});

const mapTerminal = (row: TerminalRow): OperationalTerminal => ({
  id: row.id,
  locationId: row.location_id,
  code: row.code,
  name: row.name,
  terminalType: row.terminal_type,
});

export function OperationalScopeProvider({ children }: { children: ReactNode }) {
  const { user, ownerUserId, isLocalOfflineSession } = useAuth();
  const { isDesktop } = useDesktopRuntime();
  const [loading, setLoading] = useState(true);
  const [scope, setScope] = useState<OperationalScope | null>(null);
  const [locations, setLocations] = useState<OperationalLocation[]>([]);
  const [terminals, setTerminals] = useState<OperationalTerminal[]>([]);

  const refreshOperationalScope = useCallback(async () => {
    if (!user?.id || !ownerUserId) {
      setScope(null);
      setLocations([]);
      setTerminals([]);
      setLoading(false);
      return;
    }

    const runtime = isDesktop ? 'desktop' : 'web';
    const cachedScope = readOperationalScopeCache(ownerUserId, user.id, runtime);
    if (cachedScope) {
      setScope(cachedScope);
      setLocations([cachedScope.location]);
      setTerminals(cachedScope.terminal ? [cachedScope.terminal] : []);
      setLoading(false);
    } else {
      setScope(null);
      setLocations([]);
      setTerminals([]);
    }

    if (isLocalOfflineSession) {
      setLoading(false);
      return;
    }

    if (!cachedScope) setLoading(true);
    try {
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      const db = supabase as any;

      if (isDesktop) {
        const activation = readDesktopActivation();
        if (!activation?.installationId) {
          setLoading(false);
          return;
        }

        const { data, error } = await db.rpc('get_current_desktop_operational_scope', {
          target_installation_id: activation.installationId,
        });
        if (error) throw error;
        const row = ((data ?? []) as DesktopScopeRow[])[0];
        if (!row) throw new Error('Terminal Desktop ainda nao foi vinculado.');

        const nextScope: OperationalScope = {
          location: {
            id: row.location_id,
            code: row.location_code,
            name: row.location_name,
            locationType: row.location_type,
            isHeadquarters: row.is_headquarters,
          },
          terminal: {
            id: row.terminal_id,
            locationId: row.location_id,
            code: row.terminal_code,
            name: row.terminal_name,
            terminalType: row.terminal_type,
          },
        };
        setScope(nextScope);
        setLocations([nextScope.location]);
        setTerminals(nextScope.terminal ? [nextScope.terminal] : []);
        writeOperationalScopeCache(ownerUserId, user.id, runtime, nextScope);
        return;
      }

      const [locationsResult, terminalsResult] = await Promise.all([
        db.from('store_locations').select('id, code, name, location_type, is_headquarters').eq('active', true).order('is_headquarters', { ascending: false }).order('name'),
        db.from('pos_terminals').select('id, location_id, code, name, terminal_type').eq('active', true).order('name'),
      ]);
      if (locationsResult.error) throw locationsResult.error;
      if (terminalsResult.error) throw terminalsResult.error;

      const nextLocations = ((locationsResult.data ?? []) as LocationRow[]).map(mapLocation);
      const nextTerminals = ((terminalsResult.data ?? []) as TerminalRow[]).map(mapTerminal);
      const selectedLocation = nextLocations.find((location) => location.id === cachedScope?.location.id)
        ?? nextLocations.find((location) => location.isHeadquarters)
        ?? nextLocations[0];
      const locationTerminals = nextTerminals.filter((terminal) => terminal.locationId === selectedLocation?.id);
      const selectedTerminal = locationTerminals.find((terminal) => terminal.id === cachedScope?.terminal?.id)
        ?? locationTerminals.find((terminal) => terminal.terminalType === 'web')
        ?? locationTerminals[0]
        ?? null;

      setLocations(nextLocations);
      setTerminals(nextTerminals);
      if (selectedLocation) {
        const nextScope = { location: selectedLocation, terminal: selectedTerminal };
        setScope(nextScope);
        writeOperationalScopeCache(ownerUserId, user.id, runtime, nextScope);
      }
    } catch (error) {
      // A aplicacao continua operacional com o trigger Matriz/LEGACY quando a
      // migracao ainda nao foi aplicada ou a rede estiver indisponivel.
      console.warn('Nao foi possivel resolver filial e terminal; mantendo o escopo em cache:', getRedactedLogValue(error));
      setScope(cachedScope);
    } finally {
      setLoading(false);
    }
  }, [isDesktop, isLocalOfflineSession, ownerUserId, user?.id]);

  useEffect(() => {
    void refreshOperationalScope();
  }, [refreshOperationalScope]);

  const selectWebScope = useCallback((locationId: string, terminalId?: string | null) => {
    if (isDesktop || !user?.id || !ownerUserId) return;
    const location = locations.find((item) => item.id === locationId);
    if (!location) return;
    const locationTerminals = terminals.filter((terminal) => terminal.locationId === locationId);
    const terminal = locationTerminals.find((item) => item.id === terminalId)
      ?? locationTerminals.find((item) => item.terminalType === 'web')
      ?? locationTerminals[0]
      ?? null;
    const nextScope = { location, terminal };
    setScope(nextScope);
    writeOperationalScopeCache(ownerUserId, user.id, 'web', nextScope);
  }, [isDesktop, locations, ownerUserId, terminals, user?.id]);

  const value = useMemo<OperationalScopeContextValue>(() => ({
    loading,
    scope,
    locations,
    terminals,
    selectWebScope,
    refreshOperationalScope,
  }), [loading, locations, refreshOperationalScope, scope, selectWebScope, terminals]);

  return <OperationalScopeContext.Provider value={value}>{children}</OperationalScopeContext.Provider>;
}
