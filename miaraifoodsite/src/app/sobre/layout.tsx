import type { Metadata } from 'next';

export const metadata: Metadata = {
    title: 'Evolução do MIAR AI/FOOD',
    description: 'Conheça a evolução do ecossistema MIAR AI/FOOD, suas melhorias, desenvolvimento e avanços tecnológicos para restaurantes e food service.',
};

export default function ExperienceLayout({
    children,
}: {
    children: React.ReactNode;
}) {
    return children;
}
