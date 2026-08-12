import { MetadataRoute } from 'next';

export default function robots(): MetadataRoute.Robots {
  const baseUrl = 'https://www.happycashsite.com.br';

  return {
    rules: {
      userAgent: '*',
      allow: '/',
      disallow: ['/api/', '/dashboard/', '/login/', '/cadastro/'],
    },
    sitemap: `${baseUrl}/sitemap.xml`,
  };
}
