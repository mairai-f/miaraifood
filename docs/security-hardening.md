# HappyCash security hardening

## Public endpoint rate limits

`public-menu` and `create-public-menu-order` support optional Redis-backed rate limiting through Upstash REST.
`desktop-activate` uses the same helper to reduce license-key brute-force attempts.
Without the Redis secrets, the functions keep working and skip the Redis check.

Configure these as Supabase secrets:

```bash
supabase secrets set UPSTASH_REDIS_REST_URL="https://your-upstash-db.upstash.io"
supabase secrets set UPSTASH_REDIS_REST_TOKEN="your-upstash-rest-token"
supabase secrets set PUBLIC_MENU_RATE_LIMIT_PER_MINUTE="120"
supabase secrets set PUBLIC_MENU_ORDER_RATE_LIMIT_PER_MINUTE="30"
supabase secrets set PUBLIC_MENU_TABLE_ACTION_RATE_LIMIT_PER_MINUTE="12"
supabase secrets set DESKTOP_ACTIVATE_RATE_LIMIT_PER_MINUTE="8"
```

Then redeploy:

```bash
supabase functions deploy public-menu
supabase functions deploy create-public-menu-order
supabase functions deploy desktop-activate
```

## Local audit

Run this before deploys that touch auth, RLS, Edge Functions, or environment variables:

```bash
npm run security:audit
```

The audit checks for tracked `.env` files, service role usage in client code, suspicious `VITE_` secrets, public Edge Functions, CORS wildcard usage, and local RLS migration coverage.

## Supabase dashboard checks

Use MFA on the Supabase account/organization, keep `SUPABASE_SERVICE_ROLE_KEY` only in Supabase secrets, and restrict direct Postgres connections with Network Restrictions when the deployment IPs are known.

Use this SQL in Supabase SQL Editor to audit RLS on the live database:

```sql
select
  schemaname,
  tablename,
  rowsecurity,
  force_rowsecurity
from pg_tables
where schemaname = 'public'
order by rowsecurity, force_rowsecurity, tablename;
```

Sensitive app tables should have `rowsecurity = true`. Tables that should only be touched through service-role functions can have no permissive policies for `anon` or `authenticated`.
