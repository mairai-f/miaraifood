const fs = require('fs');
const inserts = fs.readFileSync('blog_inserts.sql', 'utf8');
const sql = `-- 1. Cria a tabela principal de posts do blog
CREATE TABLE public.blog_posts (
    id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
    title TEXT NOT NULL,
    slug TEXT NOT NULL UNIQUE,
    excerpt TEXT NOT NULL,
    content TEXT NOT NULL,
    cover_image TEXT,
    author TEXT DEFAULT 'Equipe HappyCash',
    published_at TIMESTAMP WITH TIME ZONE DEFAULT timezone('utc'::text, now()) NOT NULL,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT timezone('utc'::text, now()) NOT NULL
);

-- 2. Habilita o RLS (Row Level Security) para segurança
ALTER TABLE public.blog_posts ENABLE ROW LEVEL SECURITY;

-- 3. Cria uma política permitindo que qualquer visitante do site leia os posts
CREATE POLICY "Permitir leitura pública dos posts" ON public.blog_posts FOR SELECT USING (true);
CREATE POLICY "Permitir inserção" ON public.blog_posts FOR INSERT TO authenticated WITH CHECK (true);
CREATE POLICY "Permitir edição" ON public.blog_posts FOR UPDATE TO authenticated USING (true);
CREATE POLICY "Permitir deleção" ON public.blog_posts FOR DELETE TO authenticated USING (true);

-- 4. INSERINDO OS SEUS 13 ARTIGOS ORIGINAIS DO BLOG
${inserts}
`;

const markdown = '```sql\n' + sql + '\n```';
fs.writeFileSync('/home/celio/.gemini/antigravity/brain/1a8be0ba-f0f8-4a4b-a6a2-58af7a83c1c8/supabase_blog_sql.md', markdown);
console.log('Artifact updated');
