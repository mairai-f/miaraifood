import type { Metadata } from 'next';

export const metadata: Metadata = {
    title: 'Evolução do HappyCash ERP',
    description: 'Conheça a evolução da plataforma HappyCash ERP, suas melhorias, desenvolvimento e avanços tecnológicos para gestão empresarial.',
};

export default function ExperienceLayout({
    children,
}: {
    children: React.ReactNode;
}) {
    return children;
}
