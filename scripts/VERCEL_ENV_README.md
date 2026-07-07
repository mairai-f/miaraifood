Como usar o script `set-vercel-env.sh` para adicionar/atualizar variáveis de ambiente no Vercel

Passos rápidos:

1. Gere um token em https://vercel.com/account/tokens (Team/Personal token) com permissões de Projeto.
2. Exporte o token no seu shell:

```bash
export VERCEL_TOKEN=your_vercel_token_here
```

3. Execute o script para adicionar a variável (exemplo para produção):

```bash
./scripts/set-vercel-env.sh my-vercel-project production VITE_TURNSTILE_SITE_KEY my-site-key
```

Observações:
- O script tenta resolver `project-id` a partir do nome do projeto. Se não encontrar, passe o `project-id` diretamente.
- Você também pode definir `development` ou `preview` como `environment`.
- O script usa a API oficial do Vercel para criar ou atualizar variáveis do projeto.

Segurança:
- Não comite tokens nem valores de secrets no repositório.
- Para produção, prefira definir a variável pelo dashboard do Vercel ou CI seguro.
