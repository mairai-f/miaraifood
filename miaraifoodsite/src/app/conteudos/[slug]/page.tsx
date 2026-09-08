import Image from 'next/image';
import Link from 'next/link';
import { notFound } from 'next/navigation';
import { portfolioData } from '@/data/portfolio';
import { supabase } from '@/lib/supabase';
import { cn } from '@/lib/utils';
import { ArticleControls } from './ArticleControls';
import { Metadata } from 'next';

export const revalidate = 3600;

export async function generateMetadata({ params }: { params: Promise<{ slug: string }> }): Promise<Metadata> {
    const { slug } = await params;
    
    const { data: post } = await supabase
        .from('blog_posts')
        .select('*')
        .eq('slug', slug)
        .single();
        
    const localPost = portfolioData.blogs.find((p) => p.slug === slug);
    const title = post?.title || localPost?.title || 'Conteúdo MIAR AI/FOOD';
    const description = post?.excerpt || localPost?.excerpt || '';
    
    return {
        title: `${title} | MIAR AI/FOOD`,
        description,
        keywords: [title, 'Gestão', 'MIAR AI/FOOD', 'Restaurantes'],
    };
}

export default async function BlogPostPage({ params }: { params: Promise<{ slug: string }> }) {
    const { slug } = await params;
    
    // Busca do Supabase
    const { data: post, error } = await supabase
        .from('blog_posts')
        .select('*')
        .eq('slug', slug)
        .single();

    const localPost = portfolioData.blogs.find((p) => p.slug === slug);

    if (!post && !localPost) {
        notFound();
    }

    // Normaliza os dados (usa Supabase, se não achar usa o localData para não quebrar nada)
    const article = post ? {
        title: post.title,
        excerpt: post.excerpt,
        content: post.content,
        image: post.cover_image,
        author: { name: post.author || 'Equipe MIAR AI/FOOD' },
        date: post.published_at,
        tags: [] as string[],
        toc: [] as any[]
    } : localPost!;

    return (
        <main className="min-h-screen bg-background pb-24 pt-32">
            <div className="container max-w-7xl mx-auto px-6 mb-12">
                <div className="max-w-4xl">
                    <h1 className="text-4xl md:text-5xl lg:text-7xl font-black tracking-tight text-foreground mb-6 leading-[1.1]">
                        {article.title}
                    </h1>
                    <p className="text-xl text-muted-foreground leading-relaxed max-w-2xl font-light">
                        {article.excerpt}
                    </p>
                </div>
            </div>

            <div className="container max-w-7xl mx-auto px-6 mb-12">
                <div className="relative w-full aspect-[21/9] md:aspect-[2/1] rounded-3xl overflow-hidden border border-border/40 shadow-2xl">
                    <Image
                        src={article.image || '/telasdosistema/tutorialinicial.webp'}
                        alt={article.title}
                        fill
                        sizes="100vw"
                        className="object-cover"
                        priority
                    />
                    <div className="absolute inset-0 bg-gradient-to-t from-black/20 to-transparent" />
                </div>
            </div>

            <div className="container max-w-7xl mx-auto px-6 mb-16">
                <div className="flex flex-col md:flex-row items-center justify-between border-y border-border/40 py-6 gap-6">
                    <div className="flex items-center gap-12 w-full md:w-auto justify-between md:justify-start">
                        <div className="flex flex-col gap-1">
                            <span className="text-[10px] uppercase tracking-widest text-muted-foreground font-bold">Escrito por</span>
                            <div className="flex items-center gap-2">
                                <span className="font-bold text-foreground">{article.author.name}</span>
                            </div>
                        </div>
                        <div className="flex flex-col gap-1">
                            <span className="text-[10px] uppercase tracking-widest text-muted-foreground font-bold">Publicado em</span>
                            <span className="font-bold text-foreground">{new Date(article.date).toLocaleDateString('pt-BR')}</span>
                        </div>
                    </div>

                    <ArticleControls />
                </div>
            </div>

            <div className="container max-w-7xl mx-auto px-6">
                <div className="grid grid-cols-1 lg:grid-cols-12 gap-12">
                    <div className="lg:col-span-8">
                        <div 
                            className="prose prose-lg prose-invert prose-primary max-w-none prose-headings:font-black prose-headings:tracking-tight prose-p:leading-loose prose-p:text-muted-foreground prose-a:text-primary prose-blockquote:border-l-4 prose-blockquote:border-primary prose-blockquote:pl-6 prose-blockquote:italic prose-blockquote:text-xl prose-blockquote:text-foreground prose-img:rounded-2xl prose-img:border prose-img:border-border/40 prose-ul:text-muted-foreground"
                            dangerouslySetInnerHTML={{ __html: article.content }}
                        />

                        {article.tags && article.tags.length > 0 && (
                            <div className="mt-12 pt-12 border-t border-border/40">
                                <h3 className="text-lg font-bold mb-6">Tópicos Relacionados</h3>
                                <div className="flex flex-wrap gap-3">
                                    {article.tags.map(tag => (
                                        <Link key={tag} href={`/conteudos?q=${tag}`} className="px-4 py-2 bg-secondary/10 hover:bg-primary/10 text-muted-foreground hover:text-primary border border-transparent hover:border-primary/20 rounded-lg text-sm transition-all font-medium">
                                            #{tag}
                                        </Link>
                                    ))}
                                </div>
                            </div>
                        )}
                    </div>

                    {article.toc && article.toc.length > 0 && (
                        <div className="lg:col-span-4 space-y-8">
                            <div className="sticky top-12 space-y-8">
                                <div>
                                    <h3 className="text-sm font-bold uppercase tracking-widest text-muted-foreground mb-6 pb-4 border-b border-border/40">
                                        Índice do Conteúdo
                                    </h3>
                                    <div className="flex flex-col gap-4">
                                        {article.toc.map((item: any, index: number) => (
                                            <a
                                                key={item.id}
                                                href={`#${item.id}`}
                                                className={cn(
                                                    "group flex items-center gap-3 text-sm font-medium transition-colors",
                                                    index === 0 ? "text-primary pl-0" : "text-muted-foreground hover:text-foreground"
                                                )}
                                            >
                                                <span className={cn(
                                                    "h-px w-4 transition-all",
                                                    index === 0 ? "bg-primary" : "bg-transparent group-hover:bg-border"
                                                )} />
                                                {item.label}
                                            </a>
                                        ))}
                                    </div>
                                </div>
                            </div>
                        </div>
                    )}
                </div>
            </div>
        </main>
    );
}
