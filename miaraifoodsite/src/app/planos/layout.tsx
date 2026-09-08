import type { Metadata } from 'next';

export const metadata: Metadata = {
    title: 'Planos e Preços | MIAR AI/FOOD',
    description: 'Conheça os planos do MIAR AI/FOOD. Mensalidades justas para um ecossistema completo de gestão de restaurantes, mesas, KDS, estoque e IA.',
    keywords: [
        'preços sistema restaurante',
        'planos MIAR AI/FOOD',
        'mensalidade sistema PDV food',
        'software gestão restaurante',
        'assinatura sistema caixa restaurante',
        'sistema sem taxa de adesão',
        'quanto custa um PDV restaurante'
    ],
};

export default function PlanosLayout({
    children,
}: {
    children: React.ReactNode;
}) {
    return children;
}
