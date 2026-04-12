import { motion } from 'framer-motion';
import { useData } from '@/contexts/DataContext';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { format } from 'date-fns';
import { ptBR } from 'date-fns/locale';
import { UserX } from 'lucide-react';

export default function DeletedClients() {
  const { clients, debtEntries, payments } = useData();
  const deleted = clients.filter(c => c.deleted);

  return (
    <div>
      <div className="page-header">
        <h1 className="page-title flex items-center gap-2"><UserX className="h-6 w-6 shrink-0" />Clientes Excluídos</h1>
        <p className="page-subtitle">Historico consolidado dos clientes removidos.</p>
      </div>
      {deleted.length === 0 && <p className="text-center text-muted-foreground mt-8">Nenhum cliente excluído.</p>}
      <div className="space-y-4">
        {deleted.map(c => {
          const cEntries = debtEntries.filter(d => d.client_id === c.id);
          const cPayments = payments.filter(p => p.client_id === c.id);
          const totalConsumed = cEntries.reduce((s, e) => s + e.total, 0);
          const totalPaid = cPayments.reduce((s, p) => s + p.amount, 0);
          return (
            <motion.div key={c.id} initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }}>
              <Card className="border-border/50">
                <CardHeader>
                  <CardTitle className="flex flex-col gap-1 sm:flex-row sm:items-center sm:justify-between">
                    <span className="break-words">{c.name}</span>
                    <span className="meta-text">Excluído: {c.deleted_at ? format(new Date(c.deleted_at), 'dd/MM/yyyy', { locale: ptBR }) : '-'}</span>
                  </CardTitle>
                </CardHeader>
                <CardContent>
                  <div className="mb-4 grid grid-cols-1 gap-3 sm:grid-cols-2 sm:gap-4">
                    <div><p className="meta-text">Total Consumido</p><p className="money-value font-bold">R$ {totalConsumed.toFixed(2)}</p></div>
                    <div><p className="meta-text">Total Pago</p><p className="money-value font-bold text-success">R$ {totalPaid.toFixed(2)}</p></div>
                  </div>
                  {cEntries.length > 0 && (
                    <>
                      <p className="meta-text mb-2">Produtos consumidos:</p>
                      <div className="space-y-1 max-h-40 overflow-auto">
                        {cEntries.map(e => (
                          <div key={e.id} className="item-row-responsive text-sm">
                            <span className="min-w-0 break-words">{e.product_name} <span className="whitespace-nowrap">x{e.quantity}</span> <span className="whitespace-nowrap text-muted-foreground">({format(new Date(e.date_added), 'dd/MM', { locale: ptBR })})</span></span>
                            <span className="money-value font-medium">R$ {e.total.toFixed(2)}</span>
                          </div>
                        ))}
                      </div>
                    </>
                  )}
                </CardContent>
              </Card>
            </motion.div>
          );
        })}
      </div>
    </div>
  );
}
