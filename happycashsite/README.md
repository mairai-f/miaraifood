# HappyCash Site

Esta pasta agora faz parte do repositório principal `HappyCash`.

Pontos importantes:
- O build oficial usa os scripts da raiz do projeto.
- O deploy da landing no Vercel usa o [`/vercel.json`](/home/celio/Downloads/happycash/vercel.json:1) da raiz com `npm run build:site` gerando `dist-site`.
- O `vite.config.ts` desta pasta usa `envDir: ".."`, então o ambiente canônico fica em `/.env`.
- O Supabase canônico do projeto fica em `/supabase`.
- A pasta `happycashsite/supabase` foi mantida apenas por compatibilidade, alinhada ao projeto principal para evitar divergências acidentais.

Comandos oficiais:
- `npm run dev:site`
- `npm run build:site`
- `npm run preview:site`
