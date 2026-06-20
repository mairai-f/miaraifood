import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import type { Client, DebtEntry, Sale, SaleItem } from '@/types';

export type ReportDetail = 'sales' | 'revenue' | 'cost' | 'profit' | 'ticket' | 'margin' | 'debts' | 'items';

type ReportDetailsDialogProps = {
  detail: ReportDetail | null;
  sales: Sale[];
  saleItems: SaleItem[];
  debts: DebtEntry[];
  clients: Client[];
  onOpenChange: (open: boolean) => void;
};

const money = (value: number) => new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL' }).format(value);
const dateTime = (value: string) => new Intl.DateTimeFormat('pt-BR', { dateStyle: 'short', timeStyle: 'short' }).format(new Date(value));

export function ReportDetailsDialog({ detail, sales, saleItems, debts, clients, onOpenChange }: ReportDetailsDialogProps) {
  const clientById = new Map(clients.map((client) => [client.id, client.name]));
  const title: Record<ReportDetail, string> = {
    sales: 'Vendas válidas',
    revenue: 'Composição do faturamento',
    cost: 'Composição do custo',
    profit: 'Composição do lucro',
    ticket: 'Composição do ticket médio',
    margin: 'Composição da margem',
    debts: 'Fiado em aberto',
    items: 'Itens por venda',
  };
  const showsSales = detail === 'sales' || detail === 'revenue' || detail === 'ticket' || detail === 'items';
  const showsItems = detail === 'cost' || detail === 'profit' || detail === 'margin';

  return (
    <Dialog open={detail !== null} onOpenChange={onOpenChange}>
      <DialogContent className="max-h-[85vh] max-w-5xl overflow-hidden">
        <DialogHeader>
          <DialogTitle>{detail ? title[detail] : 'Detalhes do relatório'}</DialogTitle>
          <DialogDescription>Registros do período selecionado que formam este indicador.</DialogDescription>
        </DialogHeader>
        <div className="max-h-[68vh] overflow-auto rounded-md border">
          {showsSales && (
            <Table>
              <TableHeader><TableRow><TableHead>Data</TableHead><TableHead>Cliente</TableHead><TableHead>Pagamento</TableHead><TableHead>Itens</TableHead><TableHead className="text-right">Total</TableHead></TableRow></TableHeader>
              <TableBody>
                {sales.map((sale) => {
                  const items = saleItems.filter((item) => item.sale_id === sale.id);
                  return <TableRow key={sale.id}><TableCell>{dateTime(sale.date)}</TableCell><TableCell>{sale.client_id ? clientById.get(sale.client_id) || 'Cliente removido' : 'Venda de balcão'}</TableCell><TableCell>{sale.payment_method}</TableCell><TableCell>{items.reduce((sum, item) => sum + item.quantity, 0)} un. · {items.map((item) => item.product_name).join(', ') || 'Sem itens'}</TableCell><TableCell className="text-right font-semibold">{money(sale.total)}</TableCell></TableRow>;
                })}
                {sales.length === 0 && <TableRow><TableCell colSpan={5} className="py-8 text-center text-muted-foreground">Nenhuma venda válida no período.</TableCell></TableRow>}
              </TableBody>
            </Table>
          )}
          {showsItems && (
            <Table>
              <TableHeader><TableRow><TableHead>Produto</TableHead><TableHead>Qtd.</TableHead><TableHead className="text-right">Receita</TableHead><TableHead className="text-right">Custo</TableHead><TableHead className="text-right">Lucro</TableHead><TableHead className="text-right">Margem</TableHead></TableRow></TableHeader>
              <TableBody>
                {saleItems.map((item) => {
                  const revenue = Number(item.net_total ?? item.total ?? 0);
                  const cost = Number(item.cost_price ?? 0) * Number(item.quantity ?? 0);
                  const profit = Number(item.total_profit ?? revenue - cost);
                  const margin = revenue > 0 ? profit / revenue * 100 : 0;
                  return <TableRow key={item.id}><TableCell className="font-medium">{item.product_name}</TableCell><TableCell>{item.quantity}</TableCell><TableCell className="text-right">{money(revenue)}</TableCell><TableCell className="text-right">{money(cost)}</TableCell><TableCell className="text-right">{money(profit)}</TableCell><TableCell className="text-right">{margin.toFixed(1)}%</TableCell></TableRow>;
                })}
                {saleItems.length === 0 && <TableRow><TableCell colSpan={6} className="py-8 text-center text-muted-foreground">Nenhum item vendido no período.</TableCell></TableRow>}
              </TableBody>
            </Table>
          )}
          {detail === 'debts' && (
            <Table>
              <TableHeader><TableRow><TableHead>Data</TableHead><TableHead>Cliente</TableHead><TableHead>Produto</TableHead><TableHead>Qtd.</TableHead><TableHead className="text-right">Valor</TableHead></TableRow></TableHeader>
              <TableBody>
                {debts.map((entry) => <TableRow key={entry.id}><TableCell>{dateTime(entry.date_added)}</TableCell><TableCell>{clientById.get(entry.client_id) || 'Cliente removido'}</TableCell><TableCell>{entry.product_name}</TableCell><TableCell>{entry.quantity}</TableCell><TableCell className="text-right font-semibold">{money(entry.total)}</TableCell></TableRow>)}
                {debts.length === 0 && <TableRow><TableCell colSpan={5} className="py-8 text-center text-muted-foreground">Nenhum fiado em aberto.</TableCell></TableRow>}
              </TableBody>
            </Table>
          )}
        </div>
      </DialogContent>
    </Dialog>
  );
}
