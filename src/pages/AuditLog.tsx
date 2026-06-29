import { useEffect, useState } from 'react';
import { ShieldCheck } from 'lucide-react';
import { supabase } from '@/integrations/supabase/client';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { formatDateTime } from '../../shared/locale/format';
import { formatRedactedJson, maskEmail } from '../../shared/security/redaction';

type AuditLogRow = {
  id: string;
  actor_label: string | null;
  action: string;
  entity_type: string;
  entity_id: string | null;
  details: Record<string, unknown>;
  created_at: string;
};

const actionLabel: Record<string, string> = {
  'product.update': 'Produto alterado',
  'product.update.detailed': 'Produto alterado — antes e depois',
  'sale.create': 'Venda registrada',
  'product.delete': 'Produto excluído',
  'debt_entry.delete': 'Fiado estornado',
  'debt_entry.delete_restore_stock': 'Fiado estornado com estoque',
  'sale.cancel': 'Venda cancelada',
  'stock.clear_all': 'Estoque zerado',
  'cash_session.close': 'Caixa fechado e conferido',
};

const getChangedFields = (details: Record<string, unknown>) => {
  const before = details.before as Record<string, unknown> | undefined;
  const after = details.after as Record<string, unknown> | undefined;
  if (!before || !after) return [];
  return Object.keys(after)
    .filter((key) => JSON.stringify(before[key]) !== JSON.stringify(after[key]))
    .map((key) => ({ key, before: before[key], after: after[key] }));
};

export default function AuditLog() {
  const [logs, setLogs] = useState<AuditLogRow[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    let active = true;

    const loadLogs = async () => {
      setLoading(true);
      const { data, error } = await supabase
        .from('audit_logs' as never)
        .select('id, actor_label, action, entity_type, entity_id, details, created_at')
        .order('created_at', { ascending: false })
        .limit(100);

      if (!active) return;
      if (!error) setLogs((data as unknown as AuditLogRow[]) ?? []);
      setLoading(false);
    };

    void loadLogs();

    return () => {
      active = false;
    };
  }, []);

  const getSafeActorLabel = (actorLabel: string | null) => {
    if (!actorLabel) return 'Usuário';
    return actorLabel.includes('@') ? maskEmail(actorLabel) : actorLabel;
  };

  return (
    <div className="space-y-4">
      <div>
        <h1 className="text-xl font-bold">Auditoria</h1>
        <p className="text-sm text-muted-foreground">Últimas ações sensíveis registradas na loja.</p>
      </div>

      <Card className="border-border/50">
        <CardHeader>
          <CardTitle className="flex items-center gap-2 text-sm">
            <ShieldCheck className="h-4 w-4 text-primary" />
            Eventos recentes
          </CardTitle>
        </CardHeader>
        <CardContent>
          {loading ? (
            <p className="text-sm text-muted-foreground">Carregando...</p>
          ) : logs.length === 0 ? (
            <p className="text-sm text-muted-foreground">Nenhum evento registrado ainda.</p>
          ) : (
            <div className="space-y-2">
              {logs.map(log => (
                <div key={log.id} className="rounded-lg border border-border/60 bg-secondary/30 p-3 text-sm">
                  <div className="flex flex-wrap items-start justify-between gap-2">
                    <div>
                      <p className="font-medium">{actionLabel[log.action] || log.action}</p>
                      <p className="text-xs text-muted-foreground">
                        {formatDateTime(log.created_at)} • {getSafeActorLabel(log.actor_label)}
                      </p>
                    </div>
                    <Badge variant="outline">{log.entity_type}</Badge>
                  </div>
                  {getChangedFields(log.details || {}).length > 0 && (
                    <div className="mt-2 space-y-1 rounded bg-background/70 p-2 text-xs">
                      {getChangedFields(log.details).map((change) => (
                        <p key={change.key}><span className="font-medium">{change.key}</span>: {String(change.before ?? '—')} → {String(change.after ?? '—')}</p>
                      ))}
                    </div>
                  )}
                  {Object.keys(log.details || {}).length > 0 && (
                    <pre className="mt-2 max-h-28 overflow-auto rounded bg-background/70 p-2 text-[11px] text-muted-foreground">
                      {formatRedactedJson(log.details)}
                    </pre>
                  )}
                </div>
              ))}
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
