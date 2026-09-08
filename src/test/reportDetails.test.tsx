import { render, screen } from '@testing-library/react';

import { ReportDetailsDialog } from '@/components/reports/ReportDetailsDialog';

describe('ReportDetailsDialog', () => {
  it('shows the products that compose the profit indicator', () => {
    render(
      <ReportDetailsDialog
        detail="profit"
        sales={[]}
        debts={[]}
        clients={[]}
        onOpenChange={() => undefined}
        saleItems={[{
          id: 'item-1',
          sale_id: 'sale-1',
          product_id: 'product-1',
          product_name: 'Produto Lucrativo',
          quantity: 2,
          unit_price: 10,
          cost_price: 4,
          total: 20,
          net_total: 20,
          total_profit: 12,
        }]}
      />,
    );

    expect(screen.getByText('Composição do lucro')).toBeInTheDocument();
    expect(screen.getByText('Produto Lucrativo')).toBeInTheDocument();
    expect(screen.getByText('R$ 12,00')).toBeInTheDocument();
  });
});
