import type { Metadata } from 'next';

export const metadata: Metadata = {
    title: 'Planos e Preços | HappyCash ERP',
    description: 'Conheça os planos do HappyCash ERP. Mensalidades justas para um sistema PDV completo de gestão, controle de estoque e relatórios.',
    keywords: [
        'preços sistema ERP',
        'planos HappyCash',
        'mensalidade sistema PDV',
        'software gestão barato',
        'assinatura sistema caixa',
        'sistema sem taxa de adesão',
        'quanto custa um PDV'
    ],
};

export default function PlanosLayout({
    children,
}: {
    children: React.ReactNode;
}) {
    return children;
}
