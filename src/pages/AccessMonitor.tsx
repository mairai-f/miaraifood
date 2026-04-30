import { useCallback, useEffect, useMemo, useState } from 'react';
import { Monitor, Smartphone, Tablet, RefreshCw, Shield } from 'lucide-react';
import { supabase } from '@/integrations/supabase/client';
import { ACCESS_ACTIVE_WINDOW_MS } from '@/lib/accessTracking';
import { formatDateTime } from '../../shared/locale/format';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Alert, AlertDescription, AlertTitle } from '@/components/ui/alert';

type QueryError = { message: string } | null;

type AccessSessionRow = {
  id: string;
  username: string | null;
  email: string | null;
  role: 'admin' | 'operator';
  source: 'system' | 'site';
  device_type: 'desktop' | 'mobile' | 'tablet' | 'unknown';
  os_name: string | null;
  browser_name: string | null;
  ip_address: string | null;
  country_code: string | null;
  login_at: string;
  last_seen_at: string;
  ended_at: string | null;
};

type AccessLogRow = {
  id: string;
  username: string | null;
  email: string | null;
  role: 'admin' | 'operator';
  source: 'system' | 'site';
  event_type: 'login' | 'logout';
  device_type: 'desktop' | 'mobile' | 'tablet' | 'unknown';
  os_name: string | null;
  browser_name: string | null;
  ip_address: string | null;
  country_code: string | null;
  occurred_at: string;
};

type AccessQueryClient = {
  from(table: 'access_sessions'): {
    select(columns: string): {
      order(column: string, options: { ascending: boolean }): Promise<{
        data: AccessSessionRow[] | null;
        error: QueryError;
      }>;
    };
  };
  from(table: 'access_logs'): {
    select(columns: string): {
      order(column: string, options: { ascending: boolean }): Promise<{
        data: AccessLogRow[] | null;
        error: QueryError;
      }>;
    };
  };
};

const deviceLabel: Record<AccessSessionRow['device_type'], string> = {
  desktop: 'Computador',
  mobile: 'Celular',
  tablet: 'Tablet',
  unknown: 'Desconhecido',
};

const roleLabel: Record<AccessSessionRow['role'], string> = {
  admin: 'Administrador',
  operator: 'Operador',
};

const sourceLabel: Record<AccessSessionRow['source'], string> = {
  system: 'Sistema',
  site: 'Site',
};

const accessDb = supabase as unknown as AccessQueryClient;

const DeviceIcon = ({ type }: { type: AccessSessionRow['device_type'] }) => {
  if (type === 'mobile') return <Smartphone className="h-4 w-4" />;
  if (type === 'tablet') return <Tablet className="h-4 w-4" />;
  return <Monitor className="h-4 w-4" />;
};

const isSessionActive = (session: AccessSessionRow) => {
  if (session.ended_at) return false;
  const lastSeenAt = new Date(session.last_seen_at).getTime();
  return Date.now() - lastSeenAt <= ACCESS_ACTIVE_WINDOW_MS;
};

export default function AccessMonitor() {
  const [sessions, setSessions] = useState<AccessSessionRow[]>([]);
  const [logs, setLogs] = useState<AccessLogRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const loadAccessData = useCallback(async () => {
    setRefreshing(true);
    setError(null);

    const [
      { data: sessionsData, error: sessionsError },
      { data: logsData, error: logsError },
    ] = await Promise.all([
      accessDb.from('access_sessions')
        .select('id, username, email, role, source, device_type, os_name, browser_name, ip_address, country_code, login_at, last_seen_at, ended_at')
        .order('last_seen_at', { ascending: false }),
      accessDb.from('access_logs')
        .select('id, username, email, role, source, event_type, device_type, os_name, browser_name, ip_address, country_code, occurred_at')
        .order('occurred_at', { ascending: false }),
    ]);

    if (sessionsError || logsError) {
      setError(sessionsError?.message || logsError?.message || 'Não foi possível carregar os acessos.');
      setRefreshing(false);
      setLoading(false);
      return;
    }

    setSessions((sessionsData || []).slice(0, 100));
    setLogs((logsData || []).slice(0, 120));
    setRefreshing(false);
    setLoading(false);
  }, []);

  useEffect(() => {
    void loadAccessData();

    const intervalId = window.setInterval(() => {
      void loadAccessData();
    }, 30_000);

    return () => window.clearInterval(intervalId);
  }, [loadAccessData]);

  const activeSessions = useMemo(
    () => sessions.filter(isSessionActive),
    [sessions],
  );

  const endedSessions = useMemo(
    () => sessions.filter(session => !isSessionActive(session)).slice(0, 20),
    [sessions],
  );

  return (
    <div className="space-y-6">
      <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <h1 className="text-3xl font-bold tracking-tight">Monitor de acessos</h1>
          <p className="text-sm text-muted-foreground">
            Veja quem entrou no sistema, de qual dispositivo e quais sessões ainda estão ativas.
          </p>
        </div>
        <Button type="button" variant="outline" className="gap-2" onClick={() => void loadAccessData()} disabled={refreshing}>
          <RefreshCw className={`h-4 w-4 ${refreshing ? 'animate-spin' : ''}`} />
          Atualizar
        </Button>
      </div>

      {error && (
        <Alert variant="destructive">
          <AlertTitle>Falha ao carregar acessos</AlertTitle>
          <AlertDescription>{error}</AlertDescription>
        </Alert>
      )}

      <div className="grid gap-4 md:grid-cols-3">
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-medium text-muted-foreground">Sessões ativas agora</CardTitle>
          </CardHeader>
          <CardContent>
            <p className="text-3xl font-bold">{activeSessions.length}</p>
          </CardContent>
        </Card>
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-medium text-muted-foreground">Total de sessões recentes</CardTitle>
          </CardHeader>
          <CardContent>
            <p className="text-3xl font-bold">{sessions.length}</p>
          </CardContent>
        </Card>
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-medium text-muted-foreground">Eventos registrados</CardTitle>
          </CardHeader>
          <CardContent>
            <p className="text-3xl font-bold">{logs.length}</p>
          </CardContent>
        </Card>
      </div>

      <Card>
        <CardHeader>
          <CardTitle>Sessões ativas</CardTitle>
        </CardHeader>
        <CardContent className="space-y-3">
          {loading ? (
            <p className="text-sm text-muted-foreground">Carregando acessos...</p>
          ) : activeSessions.length === 0 ? (
            <p className="text-sm text-muted-foreground">Nenhuma sessão ativa no momento.</p>
          ) : activeSessions.map(session => (
            <div key={session.id} className="rounded-xl border border-border/60 p-4">
              <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
                <div className="space-y-2">
                  <div className="flex flex-wrap items-center gap-2">
                    <Badge>{roleLabel[session.role]}</Badge>
                    <Badge variant="outline">{sourceLabel[session.source]}</Badge>
                    <Badge variant="secondary" className="gap-1">
                      <DeviceIcon type={session.device_type} />
                      {deviceLabel[session.device_type]}
                    </Badge>
                  </div>
                  <div>
                    <p className="font-semibold">{session.username || session.email || 'Usuário sem nome'}</p>
                    <p className="text-sm text-muted-foreground">{session.email || 'Sem email'}</p>
                  </div>
                </div>
                <div className="text-sm text-muted-foreground sm:text-right">
                  <p>Entrou: {formatDateTime(session.login_at)}</p>
                  <p>Última atividade: {formatDateTime(session.last_seen_at)}</p>
                </div>
              </div>
              <div className="mt-3 grid gap-2 text-sm text-muted-foreground md:grid-cols-3">
                <p>Dispositivo: {session.browser_name || 'N/D'} • {session.os_name || 'N/D'}</p>
                <p>IP: {session.ip_address || 'Não disponível'}</p>
                <p>País: {session.country_code || 'Não disponível'}</p>
              </div>
            </div>
          ))}
        </CardContent>
      </Card>

      <div className="grid gap-6 xl:grid-cols-2">
        <Card>
          <CardHeader>
            <CardTitle>Últimas sessões encerradas</CardTitle>
          </CardHeader>
          <CardContent className="space-y-3">
            {endedSessions.length === 0 ? (
              <p className="text-sm text-muted-foreground">Nenhuma sessão encerrada recente.</p>
            ) : endedSessions.map(session => (
              <div key={session.id} className="rounded-xl border border-border/60 p-4">
                <div className="flex flex-wrap items-center gap-2">
                  <Badge variant="outline">{roleLabel[session.role]}</Badge>
                  <Badge variant="secondary">{deviceLabel[session.device_type]}</Badge>
                  <Badge variant="outline">{sourceLabel[session.source]}</Badge>
                </div>
                <p className="mt-2 font-medium">{session.username || session.email || 'Usuário sem nome'}</p>
                <div className="mt-2 space-y-1 text-sm text-muted-foreground">
                  <p>Última atividade: {formatDateTime(session.last_seen_at)}</p>
                  <p>Encerrada em: {session.ended_at ? formatDateTime(session.ended_at) : 'Sem logout registrado'}</p>
                  <p>{session.browser_name || 'N/D'} • {session.os_name || 'N/D'} • {session.ip_address || 'IP indisponível'}</p>
                </div>
              </div>
            ))}
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle>Histórico recente</CardTitle>
          </CardHeader>
          <CardContent className="space-y-3">
            {logs.length === 0 ? (
              <p className="text-sm text-muted-foreground">Nenhum evento de acesso registrado ainda.</p>
            ) : logs.slice(0, 30).map(log => (
              <div key={log.id} className="flex items-start gap-3 rounded-xl border border-border/60 p-4">
                <div className="mt-0.5 rounded-full bg-primary/10 p-2 text-primary">
                  <Shield className="h-4 w-4" />
                </div>
                <div className="min-w-0 flex-1">
                  <div className="flex flex-wrap items-center gap-2">
                    <p className="font-medium">{log.username || log.email || 'Usuário sem nome'}</p>
                    <Badge variant={log.event_type === 'login' ? 'default' : 'outline'}>
                      {log.event_type === 'login' ? 'Login' : 'Logout'}
                    </Badge>
                  </div>
                  <p className="text-sm text-muted-foreground">
                    {roleLabel[log.role]} • {sourceLabel[log.source]} • {deviceLabel[log.device_type]}
                  </p>
                  <p className="text-sm text-muted-foreground">
                    {log.browser_name || 'N/D'} • {log.os_name || 'N/D'} • {log.ip_address || 'IP indisponível'}
                  </p>
                </div>
                <p className="text-xs text-muted-foreground">{formatDateTime(log.occurred_at)}</p>
              </div>
            ))}
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
