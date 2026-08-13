import { MetadataRoute } from 'next';
import { portfolioData } from '@/data/portfolio';
import { supabase } from '@/lib/supabase';

export default async function sitemap(): Promise<MetadataRoute.Sitemap> {
  const baseUrl = 'https://www.happycashsite.com.br';

  const staticRoutes = [
    '',
    '/sobre',
    '/funcionalidades',
    '/recursos',
    '/central-de-ajuda',
    '/planos',
    '/termos',
    '/conteudos',
    '/telas',
  ].map((route) => ({
    url: `${baseUrl}${route}`,
    lastModified: new Date(),
    changeFrequency: 'weekly' as const,
    priority: route === '' ? 1 : 0.8,
  }));

  const dynamicFeatures = portfolioData.projects.map((project) => ({
    url: `${baseUrl}/funcionalidades/${project.slug}`,
    lastModified: new Date(),
    changeFrequency: 'monthly' as const,
    priority: 0.9,
  }));

  // Fetch blogs from Supabase
  const { data: blogs } = await supabase
    .from('blog_posts')
    .select('slug, published_at');

  // Fallback to portfolioData if Supabase fails or is empty
  const dynamicBlogs = (blogs && blogs.length > 0 ? blogs : portfolioData.blogs).map((blog: any) => ({
    url: `${baseUrl}/conteudos/${blog.slug}`,
    lastModified: blog.published_at ? new Date(blog.published_at) : (blog.date ? new Date(blog.date) : new Date()),
    changeFrequency: 'weekly' as const,
    priority: 0.9,
  }));

  return [...staticRoutes, ...dynamicFeatures, ...dynamicBlogs];
}
