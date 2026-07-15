# HappyCash security hardening

## Public endpoint rate limits

Public and sensitive Edge Functions support optional Redis-backed rate limiting through Upstash REST.
This protects public menu traffic, account registration, billing checkout, operator login, desktop/mobile downloads, license validation, administrative approvals, fiscal actions, access tracking, and message/email sending endpoints.
Without the Redis secrets, the functions keep working and skip the Redis check.

Configure these as Supabase secrets:

```bash
supabase secrets set UPSTASH_REDIS_REST_URL="https://your-upstash-db.upstash.io"
supabase secrets set UPSTASH_REDIS_REST_TOKEN="your-upstash-rest-token"
supabase secrets set PUBLIC_MENU_RATE_LIMIT_PER_MINUTE="120"
supabase secrets set PUBLIC_MENU_ORDER_RATE_LIMIT_PER_MINUTE="30"
supabase secrets set PUBLIC_MENU_TABLE_ACTION_RATE_LIMIT_PER_MINUTE="12"
supabase secrets set DESKTOP_ACTIVATE_RATE_LIMIT_PER_MINUTE="8"
supabase secrets set REGISTER_ACCOUNT_RATE_LIMIT_PER_MINUTE="12"
supabase secrets set FINALIZE_SITE_REGISTRATION_RATE_LIMIT_PER_MINUTE="20"
supabase secrets set CREATE_PLAN_CHARGE_RATE_LIMIT_PER_MINUTE="10"
supabase secrets set OPERATOR_LOGIN_RATE_LIMIT_PER_MINUTE="30"
supabase secrets set TRACK_ACCESS_RATE_LIMIT_PER_MINUTE="300"
supabase secrets set DESKTOP_LICENSE_RATE_LIMIT_PER_MINUTE="120"
supabase secrets set DESKTOP_LICENSE_KEY_RATE_LIMIT_PER_MINUTE="30"
supabase secrets set DESKTOP_DOWNLOAD_RATE_LIMIT_PER_MINUTE="20"
supabase secrets set MOBILE_DOWNLOAD_RATE_LIMIT_PER_MINUTE="20"
supabase secrets set AUTHORIZE_STORE_ADMIN_RATE_LIMIT_PER_MINUTE="30"
supabase secrets set AUTHORIZE_PRICING_MANAGER_RATE_LIMIT_PER_MINUTE="30"
supabase secrets set MANAGE_OPERATORS_RATE_LIMIT_PER_MINUTE="120"
supabase secrets set MANAGE_FISCAL_DOCUMENTS_RATE_LIMIT_PER_MINUTE="120"
supabase secrets set SEND_CASH_CLOSE_REPORT_RATE_LIMIT_PER_MINUTE="8"
supabase secrets set SEND_AGENDA_REMINDERS_RATE_LIMIT_PER_MINUTE="20"
```

Then redeploy:

```bash
supabase functions deploy public-menu
supabase functions deploy create-public-menu-order
supabase functions deploy desktop-activate
supabase functions deploy register-account
supabase functions deploy finalize-site-registration
supabase functions deploy create-plan-charge
supabase functions deploy operator-login
supabase functions deploy track-access
supabase functions deploy desktop-license
supabase functions deploy desktop-license-key
supabase functions deploy desktop-download
supabase functions deploy mobile-download
supabase functions deploy authorize-store-admin
supabase functions deploy authorize-pricing-manager
supabase functions deploy manage-operators
supabase functions deploy manage-fiscal-documents
supabase functions deploy send-cash-close-report
supabase functions deploy send-agenda-reminders
```

Do not rate-limit the Asaas webhook with a small public-IP rule; it already requires `ASAAS_WEBHOOK_AUTH_TOKEN` and provider retries should not be blocked by normal app traffic rules.

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
