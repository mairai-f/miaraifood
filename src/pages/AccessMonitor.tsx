import { useCallback, useEffect, useMemo, useState } from 'react';
import { Link } from 'react-router-dom';
import { MonitorSmartphone, RefreshCw, ShieldCheck } from 'lucide-react';
import { supabase } from '@/integrations/supabase/client';
import { ACCESS_ACTIVE_WINDOW_MS } from '@/lib/accessTracking';
import { formatDateTime } from '../../shared/locale/format';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Alert, AlertDescription, AlertTitle } from '@/components/ui/alert';
import { getPublicErrorMessage, maskEmail } from '../../shared/security/redaction';

type QueryError = { message: string } | null;

type PosTerminalAccessRow = {
  id: string;
  location_id: string;
  code: string;
  name: string;
  terminal_type: 'desktop' | 'web' | 'mobile' | 'totem';
  installation_id: string | null;
  active: boolean;
  last_seen_at: string | null;
  current_user_id: string | null;
  current_username: string | null;
  current_email: string | null;
  current_user_role: string | null;
  current_session_started_at: string | null;
  current_session_seen_at: string | null;
};

type StoreLocationAccessRow = {
  id: string;
  name: string;
};

type QueryResult<T> = Promise<{
  data: T[] | null;
  error: QueryError;
}>;

type AccessQueryClient = {
  rpc(name: 'get_current_store_account_id_for_context', args: { target_context: 'happycash' }): Promise<{
    data: string | null;
    error: QueryError;
  }>;
  from(table: 'pos_terminals'): {
    select(columns: string): {
      eq(column: 'store_account_id', value: string): {
        order(column: 'name', options?: { ascending?: boolean }): {
          limit(count: number): QueryResult<PosTerminalAccessRow>;
        };
      };
    };
  };
  from(table: 'store_locations'): {
    select(columns: string): {
      eq(column: 'store_account_id', value: string): {
        order(column: 'name', options?: { ascending?: boolean }): {
          limit(count: number): QueryResult<StoreLocationAccessRow>;
        };
      };
    };
  };
};

const accessDb = supabase as unknown as AccessQueryClient;

const terminalTypeLabel: Record<PosTerminalAccessRow['terminal_type'], string> = {
  desktop: 'Desktop',
  web: 'Web',
  mobile: 'Mobile',
  totem: 'Totem',
};

const roleLabel: Record<string, string> = {
  admin: 'Administrador',
  operator: 'Operador',
  waiter: 'Garcom',
  hr: 'RH',
};

const parseTimestamp = (value?: string | null) => {
  if (!value) return null;
  const parsed = new Date(value).getTime();
  return Number.isFinite(parsed) ? parsed : null;
};

const getTerminalSeenAt = (terminal: PosTerminalAccessRow) =>
  terminal.current_session_seen_at || terminal.last_seen_at;

const isTerminalOnline = (terminal: PosTerminalAccessRow) => {
  if (!terminal.active) return false;
  const seenAt = parseTimestamp(getTerminalSeenAt(terminal));
  return Boolean(seenAt && Date.now() - seenAt <= ACCESS_ACTIVE_WINDOW_MS);
};

const getTerminalUserName = (terminal: PosTerminalAccessRow) =>
  terminal.current_username || maskEmail(terminal.current_email) || (terminal.current_user_id ? 'Usuario identificado' : null);

export default function AccessMonitor() {
  const [terminals, setTerminals] = useState<PosTerminalAccessRow[]>([]);
  const [locations, setLocations] = useState<StoreLocationAccessRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const loadAccessData = useCallback(async () => {
    setRefreshing(true);
    setError(null);

    try {
      const { data: accountId, error: accountError } = await accessDb.rpc(
        'get_current_store_account_id_for_context',
        { target_context: 'happycash' },
      );

      if (accountError || !accountId) {
        throw accountError ?? new Error('Empresa HappyCash nao encontrada.');
      }

      const [terminalsResult, locationsResult] = await Promise.all([
        accessDb.from('pos_terminals')
          .select('id, location_id, code, name, terminal_type, installation_id, active, last_seen_at, current_user_id, current_username, current_email, current_user_role, current_session_started_at, current_session_seen_at')
          .eq('store_account_id', accountId)
          .order('name', { ascending: true })
          .limit(200),
        accessDb.from('store_locations')
          .select('id, name')
          .eq('store_account_id', accountId)
          .order('name', { ascending: true })
          .limit(100),
      ]);

      if (terminalsResult.error || locationsResult.error) {
        throw terminalsResult.error ?? locationsResult.error;
      }

      setTerminals(terminalsResult.data || []);
      setLocations(locationsResult.data || []);
    } catch (loadError) {
      setError(getPublicErrorMessage(loadError, 'Nao foi possivel carregar os terminais.'));
      setTerminals([]);
      setLocations([]);
    } finally {
      setRefreshing(false);
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    void loadAccessData();
  }, [loadAccessData]);

  const locationNameById = useMemo(
    () => new Map(locations.map((location) => [location.id, location.name])),
    [locations],
  );
  const onlineTerminals = useMemo(() => terminals.filter(isTerminalOnline), [terminals]);
  const linkedDesktopTerminals = useMemo(
    () => terminals.filter((terminal) => terminal.installation_id && terminal.terminal_type === 'desktop'),
    [terminals],
  );
  const identifiedUsersCount = useMemo(
    () => new Set(terminals.map((terminal) => terminal.current_user_id).filter(Boolean)).size,
    [terminals],
  );

  return (
    <div className="space-y-6">
      <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <h1 className="text-3xl font-bold tracking-tight">Monitor de terminais</h1>
          <p className="text-sm text-muted-foreground">
            Acompanhamento leve por maquina desktop ativada, sem historico de login por web ou mobile.
          </p>
        </div>
        <div className="flex flex-wrap items-center gap-2">
          <Button type="button" variant="outline" className="gap-2" onClick={() => void loadAccessData()} disabled={refreshing}>
            <RefreshCw className={`h-4 w-4 ${refreshing ? 'animate-spin' : ''}`} />
            Atualizar
          </Button>
          <Button asChild type="button" variant="secondary">
            <Link to="/configuracoes/filiais">Gerenciar terminais</Link>
          </Button>
        </div>
      </div>

      <Alert>
        <ShieldCheck className="h-4 w-4" />
        <AlertTitle>Historico de acesso desativado</AlertTitle>
        <AlertDescription>
          Novos acessos web e mobile nao criam registros. O desktop ativado atualiza somente o usuario atual e a ultima atividade do terminal.
        </AlertDescription>
      </Alert>

      {error && (
        <Alert variant="destructive">
          <AlertTitle>Falha ao carregar terminais</AlertTitle>
          <AlertDescription>{error}</AlertDescription>
        </Alert>
      )}

      <div className="grid gap-4 md:grid-cols-3">
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-medium text-muted-foreground">Terminais online</CardTitle>
          </CardHeader>
          <CardContent>
            <p className="text-3xl font-bold">{onlineTerminals.length}</p>
          </CardContent>
        </Card>
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-medium text-muted-foreground">Desktop vinculados</CardTitle>
          </CardHeader>
          <CardContent>
            <p className="text-3xl font-bold">{linkedDesktopTerminals.length}</p>
          </CardContent>
        </Card>
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-medium text-muted-foreground">Usuarios identificados</CardTitle>
          </CardHeader>
          <CardContent>
            <p className="text-3xl font-bold">{identifiedUsersCount}</p>
          </CardContent>
        </Card>
      </div>

      <Card>
        <CardHeader>
          <CardTitle>Terminais reconhecidos</CardTitle>
        </CardHeader>
        <CardContent className="space-y-3">
          {loading ? (
            <p className="text-sm text-muted-foreground">Carregando terminais...</p>
          ) : terminals.length === 0 ? (
            <p className="text-sm text-muted-foreground">Nenhum terminal cadastrado ainda.</p>
          ) : terminals.map((terminal) => {
            const userName = getTerminalUserName(terminal);
            const seenAt = getTerminalSeenAt(terminal);

            return (
              <div key={terminal.id} className="rounded-lg border border-border/60 p-4">
                <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
                  <div className="space-y-2">
                    <div className="flex flex-wrap items-center gap-2">
                      <Badge variant={isTerminalOnline(terminal) ? 'default' : 'outline'}>
                        {isTerminalOnline(terminal) ? 'Online' : 'Offline'}
                      </Badge>
                      <Badge variant="secondary" className="gap-1">
                        <MonitorSmartphone className="h-4 w-4" />
                        {terminalTypeLabel[terminal.terminal_type]}
                      </Badge>
                      {terminal.installation_id ? <Badge variant="outline">Desktop vinculado</Badge> : null}
                    </div>
                    <div>
                      <p className="font-semibold">{terminal.name}</p>
                      <p className="font-mono text-xs text-muted-foreground">{terminal.code}</p>
                    </div>
                  </div>
                  <div className="text-sm text-muted-foreground sm:text-right">
                    <p>{locationNameById.get(terminal.location_id) ?? 'Filial removida'}</p>
                    <p>{seenAt ? formatDateTime(seenAt) : 'Sem atividade registrada'}</p>
                  </div>
                </div>
                <div className="mt-3 text-sm">
                  {userName ? (
                    <>
                      <p className="font-medium">{userName}</p>
                      <p className="text-muted-foreground">
                        {terminal.current_user_role ? roleLabel[terminal.current_user_role] ?? terminal.current_user_role : 'Perfil nao informado'}
                        {terminal.current_session_started_at ? ` desde ${formatDateTime(terminal.current_session_started_at)}` : ''}
                      </p>
                    </>
                  ) : (
                    <p className="text-muted-foreground">Sem usuario conectado neste terminal.</p>
                  )}
                </div>
              </div>
            );
          })}
        </CardContent>
      </Card>
    </div>
  );
}
