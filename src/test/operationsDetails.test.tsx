import { render, screen } from '@testing-library/react';

import { OperationsDetailsDialog } from '@/components/operations/OperationsDetailsDialog';

const baseProps = {
  onOpenChange: () => undefined,
  purchases: [],
  purchaseItems: [],
  pendingAccounts: [],
  suppliers: [],
  activePromotions: [],
  todaySales: [],
  todaySaleItems: [],
  monthExpenses: [],
  openDebtClients: [],
  expiringBatches: [],
  products: [],
  clients: [],
};

describe('OperationsDetailsDialog', () => {
  it('identifies the supplier and products in a recent purchase', () => {
    render(
      <OperationsDetailsDialog
        {...baseProps}
        detail="purchases"
        purchases={[{
          id: 'purchase-1',
          supplier_name: 'Distribuidora Central',
          invoice_number: 'NF-10',
          purchase_date: '2026-06-19',
          status: 'received',
          total_amount: 80,
          notes: '',
        }]}
        purchaseItems={[{
          id: 'item-1',
          purchase_order_id: 'purchase-1',
          product_id: 'product-1',
          product_name: 'Refrigerante',
          quantity: 4,
          unit_cost: 20,
          total_cost: 80,
        }]}
      />,
    );

    expect(screen.getByText('Distribuidora Central')).toBeInTheDocument();
    expect(screen.getByText(/Refrigerante/)).toBeInTheDocument();
    expect(screen.getByText('NF-10')).toBeInTheDocument();
  });

  it('shows the adjusted open balance under the client name', () => {
    render(
      <OperationsDetailsDialog
        {...baseProps}
        detail="debts"
        openDebtClients={[{
          id: 'client-1',
          name: 'Cliente Teste',
          balance: 25,
          entries: [{
            id: 'debt-1',
            client_id: 'client-1',
            product_id: 'product-1',
            product_name: 'Produto Fiado',
            quantity: 1,
            unit_price: 50,
            total: 50,
            date_added: '2026-06-19',
            status: 'pending',
            deleted: false,
          }],
        }]}
      />,
    );

    expect(screen.getByText('Cliente Teste')).toBeInTheDocument();
    expect(screen.getByText('R$ 25,00')).toBeInTheDocument();
    expect(screen.queryByText(/Produto Fiado/)).not.toBeInTheDocument();
  });
});
