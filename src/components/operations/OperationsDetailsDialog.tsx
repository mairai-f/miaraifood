import { AlertTriangle } from 'lucide-react';

import { Badge } from '@/components/ui/badge';
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import type { Client, Expense, Product, Sale, SaleItem } from '@/types';
import type {
  FinancialAccount,
  OperationsDetail,
  OpenDebtClient,
  ProductBatch,
  ProductPromotion,
  PurchaseOrder,
  PurchaseOrderItem,
  SupplierSummary,
} from '@/types/operations';

type OperationsDetailsDialogProps = {
  detail: OperationsDetail | null;
  onOpenChange: (open: boolean) => void;
  purchases: PurchaseOrder[];
  purchaseItems: PurchaseOrderItem[];
  pendingAccounts: FinancialAccount[];
  suppliers: SupplierSummary[];
  activePromotions: ProductPromotion[];
  todaySales: Sale[];
  todaySaleItems: SaleItem[];
  monthExpenses: Expense[];
  openDebtClients: OpenDebtClient[];
  expiringBatches: ProductBatch[];
  products: Product[];
  clients: Client[];
};

const money = (value: number | string | null | undefined) =>
  new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL' }).format(Number(value ?? 0));

const formatDate = (value: string | null | undefined) => {
  if (!value) return '-';
  return new Intl.DateTimeFormat('pt-BR').format(new Date(`${value.slice(0, 10)}T12:00:00`));
};

const formatDateTime = (value: string | null | undefined) => {
  if (!value) return '-';
  return new Intl.DateTimeFormat('pt-BR', { dateStyle: 'short', timeStyle: 'short' }).format(new Date(value));
};

const emptyRow = (columns: number, message: string) => (
  <TableRow><TableCell colSpan={columns} className="py-8 text-center text-muted-foreground">{message}</TableCell></TableRow>
);

export function OperationsDetailsDialog({
  detail,
  onOpenChange,
  purchases,
  purchaseItems,
  pendingAccounts,
  suppliers,
  activePromotions,
  todaySales,
  todaySaleItems,
  monthExpenses,
  openDebtClients,
  expiringBatches,
  products,
  clients,
}: OperationsDetailsDialogProps) {
  const clientById = new Map(clients.map((client) => [client.id, client]));
  const productById = new Map(products.map((product) => [product.id, product]));
  const saleById = new Map(todaySales.map((sale) => [sale.id, sale]));
  const titleByDetail: Record<OperationsDetail, string> = {
    batches: 'Produtos com validade próxima',
    purchases: 'Compras recentes',
    accounts: 'Pendências financeiras',
    suppliers: 'Fornecedores ativos',
    promotions: 'Promoções ativas',
    sales: 'Vendas de hoje',
    profit: 'Lucro estimado de hoje',
    expenses: 'Despesas do mês',
    debts: 'Fiado em aberto',
  };

  return (
    <Dialog open={detail !== null} onOpenChange={onOpenChange}>
      <DialogContent className="max-h-[85vh] max-w-5xl overflow-hidden">
        <DialogHeader>
          <DialogTitle>{detail ? titleByDetail[detail] : 'Detalhes'}</DialogTitle>
          <DialogDescription>Registros que compõem o indicador exibido em Operações.</DialogDescription>
        </DialogHeader>

        <div className="max-h-[68vh] overflow-auto rounded-md border">
          {detail === 'purchases' && (
            <Table>
              <TableHeader><TableRow><TableHead>Data</TableHead><TableHead>Fornecedor</TableHead><TableHead>Produtos comprados</TableHead><TableHead>Documento</TableHead><TableHead className="text-right">Total</TableHead></TableRow></TableHeader>
              <TableBody>
                {purchases.map((purchase) => {
                  const items = purchaseItems.filter((item) => item.purchase_order_id === purchase.id);
                  return (
                    <TableRow key={purchase.id}>
                      <TableCell>{formatDate(purchase.purchase_date)}</TableCell>
                      <TableCell className="font-medium">{purchase.supplier_name || 'Fornecedor não informado'}</TableCell>
                      <TableCell>
                        {items.length > 0 ? items.map((item) => (
                          <p key={item.id}>{item.product_name || 'Produto removido'} · {item.quantity} un. × {money(item.unit_cost)}</p>
                        )) : <span className="text-muted-foreground">Itens não encontrados</span>}
                      </TableCell>
                      <TableCell>{purchase.invoice_number || '-'}</TableCell>
                      <TableCell className="text-right font-semibold">{money(purchase.total_amount)}</TableCell>
                    </TableRow>
                  );
                })}
                {purchases.length === 0 && emptyRow(5, 'Nenhuma compra recente.')}
              </TableBody>
            </Table>
          )}

          {detail === 'accounts' && (
            <Table>
              <TableHeader><TableRow><TableHead>Vencimento</TableHead><TableHead>Tipo</TableHead><TableHead>Descrição</TableHead><TableHead>Referente a</TableHead><TableHead className="text-right">Valor</TableHead></TableRow></TableHeader>
              <TableBody>
                {pendingAccounts.map((account) => (
                  <TableRow key={account.id}>
                    <TableCell>{formatDate(account.due_date)}</TableCell>
                    <TableCell><Badge variant={account.account_type === 'payable' ? 'destructive' : 'secondary'}>{account.account_type === 'payable' ? 'A pagar' : 'A receber'}</Badge></TableCell>
                    <TableCell>{account.description}</TableCell>
                    <TableCell>{account.party_name || 'Não informado'}</TableCell>
                    <TableCell className="text-right font-semibold">{money(account.amount)}</TableCell>
                  </TableRow>
                ))}
                {pendingAccounts.length === 0 && emptyRow(5, 'Nenhuma pendência financeira.')}
              </TableBody>
            </Table>
          )}

          {detail === 'suppliers' && (
            <Table>
              <TableHeader><TableRow><TableHead>Fornecedor</TableHead><TableHead>WhatsApp</TableHead><TableHead>Produtos</TableHead><TableHead>Estoque baixo</TableHead><TableHead>Compras</TableHead><TableHead>Última compra</TableHead><TableHead className="text-right">Total comprado</TableHead></TableRow></TableHeader>
              <TableBody>
                {suppliers.map((supplier) => (
                  <TableRow key={supplier.name}>
                    <TableCell className="font-medium">{supplier.name}</TableCell>
                    <TableCell>{supplier.whatsapp || 'Não cadastrado'}</TableCell>
                    <TableCell>{supplier.productNames.length > 0 ? supplier.productNames.join(', ') : 'Nenhum produto vinculado'}</TableCell>
                    <TableCell>{supplier.lowStockCount}</TableCell>
                    <TableCell>{supplier.purchaseCount}</TableCell>
                    <TableCell>{formatDate(supplier.lastPurchaseDate)}</TableCell>
                    <TableCell className="text-right font-semibold">{money(supplier.purchaseTotal)}</TableCell>
                  </TableRow>
                ))}
                {suppliers.length === 0 && emptyRow(7, 'Nenhum fornecedor encontrado.')}
              </TableBody>
            </Table>
          )}

          {detail === 'promotions' && (
            <Table>
              <TableHeader><TableRow><TableHead>Promoção</TableHead><TableHead>Produto</TableHead><TableHead>Desconto</TableHead><TableHead>Início</TableHead><TableHead>Fim</TableHead></TableRow></TableHeader>
              <TableBody>
                {activePromotions.map((promotion) => (
                  <TableRow key={promotion.id}>
                    <TableCell className="font-medium">{promotion.title}</TableCell>
                    <TableCell>{promotion.product_name || productById.get(promotion.product_id || '')?.name || 'Produto não informado'}</TableCell>
                    <TableCell>{promotion.discount_type === 'percent' ? `${promotion.discount_value}%` : money(promotion.discount_value)}</TableCell>
                    <TableCell>{formatDate(promotion.starts_at)}</TableCell>
                    <TableCell>{promotion.ends_at ? formatDate(promotion.ends_at) : 'Sem término'}</TableCell>
                  </TableRow>
                ))}
                {activePromotions.length === 0 && emptyRow(5, 'Nenhuma promoção ativa hoje.')}
              </TableBody>
            </Table>
          )}

          {detail === 'sales' && (
            <Table>
              <TableHeader><TableRow><TableHead>Horário</TableHead><TableHead>Cliente</TableHead><TableHead>Produtos</TableHead><TableHead>Pagamento</TableHead><TableHead className="text-right">Total</TableHead></TableRow></TableHeader>
              <TableBody>
                {todaySales.map((sale) => {
                  const items = todaySaleItems.filter((item) => item.sale_id === sale.id);
                  return (
                    <TableRow key={sale.id}>
                      <TableCell>{formatDateTime(sale.date)}</TableCell>
                      <TableCell>{sale.client_id ? clientById.get(sale.client_id)?.name || 'Cliente removido' : 'Venda de balcão'}</TableCell>
                      <TableCell>{items.length > 0 ? items.map((item) => `${item.product_name} (${item.quantity})`).join(', ') : 'Itens não encontrados'}</TableCell>
                      <TableCell>{sale.payment_method || '-'}</TableCell>
                      <TableCell className="text-right font-semibold">{money(sale.total)}</TableCell>
                    </TableRow>
                  );
                })}
                {todaySales.length === 0 && emptyRow(5, 'Nenhuma venda registrada hoje.')}
              </TableBody>
            </Table>
          )}

          {detail === 'profit' && (
            <Table>
              <TableHeader><TableRow><TableHead>Produto</TableHead><TableHead>Cliente / venda</TableHead><TableHead>Qtd.</TableHead><TableHead className="text-right">Receita</TableHead><TableHead className="text-right">Custo</TableHead><TableHead className="text-right">Lucro estimado</TableHead></TableRow></TableHeader>
              <TableBody>
                {todaySaleItems.map((item) => {
                  const sale = saleById.get(item.sale_id);
                  const revenue = Number(item.net_total ?? item.total ?? 0);
                  const cost = Number(item.cost_price ?? 0) * Number(item.quantity ?? 0);
                  const profit = Number(item.total_profit ?? revenue - cost);
                  const clientName = sale?.client_id ? clientById.get(sale.client_id)?.name || 'Cliente removido' : 'Venda de balcão';
                  return (
                    <TableRow key={item.id}>
                      <TableCell className="font-medium">{item.product_name}</TableCell>
                      <TableCell>{clientName}</TableCell>
                      <TableCell>{item.quantity}</TableCell>
                      <TableCell className="text-right">{money(revenue)}</TableCell>
                      <TableCell className="text-right">{money(cost)}</TableCell>
                      <TableCell className="text-right font-semibold">{money(profit)}</TableCell>
                    </TableRow>
                  );
                })}
                {todaySaleItems.length === 0 && emptyRow(6, 'Nenhum item vendido hoje para calcular o lucro.')}
              </TableBody>
            </Table>
          )}

          {detail === 'expenses' && (
            <Table>
              <TableHeader><TableRow><TableHead>Data</TableHead><TableHead>Despesa</TableHead><TableHead>Pago a / favorecido</TableHead><TableHead>Categoria</TableHead><TableHead className="text-right">Valor</TableHead></TableRow></TableHeader>
              <TableBody>
                {monthExpenses.map((expense) => (
                  <TableRow key={expense.id}>
                    <TableCell>{formatDate(expense.date)}</TableCell>
                    <TableCell className="font-medium">{expense.description}</TableCell>
                    <TableCell>{expense.party_name || 'Não informado'}</TableCell>
                    <TableCell>{expense.category || 'Sem categoria'}</TableCell>
                    <TableCell className="text-right font-semibold">{money(expense.amount)}</TableCell>
                  </TableRow>
                ))}
                {monthExpenses.length === 0 && emptyRow(5, 'Nenhuma despesa registrada neste mês.')}
              </TableBody>
            </Table>
          )}

          {detail === 'debts' && (
            <Table>
              <TableHeader><TableRow><TableHead>Cliente</TableHead><TableHead className="text-right">Saldo em aberto</TableHead></TableRow></TableHeader>
              <TableBody>
                {openDebtClients.map((client) => (
                  <TableRow key={client.id}>
                    <TableCell className="font-medium">{client.name}</TableCell>
                    <TableCell className="text-right font-semibold">{money(client.balance)}</TableCell>
                  </TableRow>
                ))}
                {openDebtClients.length === 0 && emptyRow(2, 'Nenhum fiado em aberto.')}
              </TableBody>
            </Table>
          )}

          {detail === 'batches' && (
            <Table>
              <TableHeader><TableRow><TableHead>Produto</TableHead><TableHead>Lote</TableHead><TableHead>Validade</TableHead><TableHead>Qtd.</TableHead><TableHead>Situação do cadastro</TableHead></TableRow></TableHeader>
              <TableBody>
                {expiringBatches.map((batch) => {
                  const product = batch.product_id ? productById.get(batch.product_id) : undefined;
                  const expired = batch.expiration_date < new Date().toISOString().slice(0, 10);
                  return (
                    <TableRow key={batch.id}>
                      <TableCell className="font-medium">{product?.name || batch.product_name || 'Produto não encontrado'}</TableCell>
                      <TableCell>{batch.batch_code || '-'}</TableCell>
                      <TableCell><span className="inline-flex items-center gap-1"><AlertTriangle className="h-4 w-4 text-destructive" />{formatDate(batch.expiration_date)} {expired ? '(vencido)' : ''}</span></TableCell>
                      <TableCell>{batch.quantity}</TableCell>
                      <TableCell><Badge variant={product?.deleted ? 'destructive' : product ? 'outline' : 'destructive'}>{product?.deleted ? 'Arquivado, ainda vinculado ao lote' : product ? 'Ativo em Produtos e Estoque' : 'Cadastro não localizado'}</Badge></TableCell>
                    </TableRow>
                  );
                })}
                {expiringBatches.length === 0 && emptyRow(5, 'Nenhum lote vencido ou próximo do vencimento.')}
              </TableBody>
            </Table>
          )}
        </div>
      </DialogContent>
    </Dialog>
  );
}
