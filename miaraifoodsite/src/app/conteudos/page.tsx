import { Suspense } from 'react';
import { BlogContent } from './BlogContent';
import { supabase } from '@/lib/supabase';
import { portfolioData } from '@/data/portfolio';

// ISR (Incremental Static Regeneration): Revalida o cache a cada 1 hora (3600 segundos)
export const revalidate = 3600;

export const metadata = {
  title: 'MIAR AI/FOOD | Conteúdos & Gastronomia',
  description: 'Dicas práticas de gestão de restaurantes, controle de estoque, KDS e IA para potencializar o seu negócio.',
};

export default async function BlogPage() {
    // Busca os posts no Supabase
    const { data: posts, error } = await supabase
        .from('blog_posts')
        .select('*')
        .order('published_at', { ascending: false });

    // Em caso de erro na conexão ou se a tabela não existir ainda,
    // usamos os dados estáticos antigos do arquivo de portfolio como fallback para não quebrar a tela.
    const initialPosts = posts && posts.length > 0 
        ? posts.map(p => ({
            id: p.id,
            title: p.title,
            slug: p.slug,
            excerpt: p.excerpt,
            content: p.content,
            image: p.cover_image,
            category: p.category || 'gestao', // Default category se não existir
            date: p.published_at,
            readTime: '5 min',
            tags: []
        }))
        : portfolioData.blogs;

    return (
        <Suspense fallback={<div className="min-h-screen bg-background animate-pulse" />}>
            <BlogContent initialPosts={initialPosts} />
        </Suspense>
    );
}
