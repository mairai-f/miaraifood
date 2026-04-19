# HappyCash Site

Esta pasta agora faz parte do repositório principal `HappyCash`.

Pontos importantes:
- O build oficial usa os scripts da raiz do projeto.
- O deploy da landing no Vercel deve usar `Root Directory = happycashsite`.
- A configuracao de deploy da landing fica em [`happycashsite/vercel.json`](/home/celio/Downloads/happycash/happycashsite/vercel.json:1).
- O `vite.config.ts` desta pasta usa `envDir: ".."`, então o ambiente canônico fica em `/.env`.
- O Supabase canônico do projeto fica em `/supabase`.
- A pasta `happycashsite/supabase` foi mantida apenas por compatibilidade, alinhada ao projeto principal para evitar divergências acidentais.

Comandos oficiais:
- `npm run dev:site`
- `npm run build:site`
- `npm run preview:site`
