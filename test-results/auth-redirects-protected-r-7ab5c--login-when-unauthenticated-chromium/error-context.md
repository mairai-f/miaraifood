# Instructions

- Following Playwright test failed.
- Explain why, be concise, respect Playwright best practices.
- Provide a snippet of code with the fix, if possible.

# Test info

- Name: auth.spec.ts >> redirects protected routes to login when unauthenticated
- Location: tests/e2e/auth.spec.ts:58:1

# Error details

```
Error: expect(page).toHaveURL(expected) failed

Expected pattern: /\/login$/
Received string:  "http://127.0.0.1:8080/pdv"
Timeout: 5000ms

Call log:
  - Expect "toHaveURL" with timeout 5000ms
    13 × locator resolved to <html dir="ltr" lang="pt-BR" class="light" data-locale="pt-BR">…</html>
       - unexpected value "http://127.0.0.1:8080/pdv"

```

```yaml
- region "Notifications (F8)":
  - list
- region "Notifications alt+T"
- dialog "Selecione seu idioma":
  - img "MIAR AI/FOOD"
  - heading "Selecione seu idioma" [level=1]
  - paragraph: MIAR AI/FOOD
  - button "Português Português (Brasil)" [pressed]
  - button "English Inglês"
  - button "Español Espanhol"
  - button "Avañe'ẽ Guarani"
  - button "Continuar"
```

# Test source

```ts
  1  | import { expect, type Page, test } from '@playwright/test';
  2  | 
  3  | const skipSplashAndAuth = async (page: Page) => {
  4  |   await page.addInitScript(() => {
  5  |     window.sessionStorage.setItem('happycash:system:app-splash-seen', '1');
  6  |     window.localStorage.setItem('happycash-locale', 'pt-BR');
  7  |     window.localStorage.removeItem('happycash:system:auth');
  8  |     window.localStorage.removeItem('happycash:system:temporary-session');
  9  |     window.sessionStorage.removeItem('happycash:system:temporary-session-active');
  10 |   });
  11 | };
  12 | 
  13 | test.beforeEach(async ({ page }) => {
  14 |   await skipSplashAndAuth(page);
  15 | });
  16 | 
  17 | test('shows the admin login form by default', async ({ page }) => {
  18 |   await page.goto('/login');
  19 | 
  20 |   await expect(page.getByRole('heading', { name: 'Entrar' })).toBeVisible();
  21 |   await expect(page.getByRole('tab', { name: 'Administrador' })).toHaveAttribute('aria-selected', 'true');
  22 |   await expect(page.getByPlaceholder('usuario@happycash.com').first()).toBeVisible();
  23 |   await expect(page.getByPlaceholder('••••••••').first()).toBeVisible();
  24 |   await expect(page.getByRole('button', { name: 'Entrar' })).toBeVisible();
  25 | });
  26 | 
  27 | test('switches to operator login and toggles password visibility', async ({ page }) => {
  28 |   await page.goto('/login');
  29 | 
  30 |   await page.getByRole('tab', { name: 'Operacional' }).click();
  31 |   await expect(page.getByRole('tab', { name: 'Operacional' })).toHaveAttribute('aria-selected', 'true');
  32 | 
  33 |   await page.getByPlaceholder('Ex: operador.caixa').fill('caixa.teste');
  34 |   const passwordInput = page.getByPlaceholder('••••••••').first();
  35 |   await passwordInput.fill('senha123');
  36 |   await expect(passwordInput).toHaveAttribute('type', 'password');
  37 | 
  38 |   await page.getByRole('button', { name: 'Mostrar senha' }).click();
  39 |   await expect(passwordInput).toHaveAttribute('type', 'text');
  40 | });
  41 | 
  42 | test('keeps remembered login mode without pre-filling auth fields', async ({ page }) => {
  43 |   await page.addInitScript(() => {
  44 |     window.localStorage.setItem('happycash:system:last-login-mode', 'operator');
  45 |     window.localStorage.setItem('happycash:system:remember-account', '1');
  46 |     window.localStorage.setItem('happycash:system:keep-connected', '1');
  47 |     window.localStorage.setItem('happycash:system:remembered-operator-username', 'operador.memoria');
  48 |   });
  49 | 
  50 |   await page.goto('/login');
  51 | 
  52 |   await expect(page.getByRole('tab', { name: 'Operacional' })).toHaveAttribute('aria-selected', 'true');
  53 |   await expect(page.getByPlaceholder('Ex: operador.caixa')).toHaveValue('');
  54 |   await expect(page.getByLabel('Lembrar minha conta')).toBeChecked();
  55 |   await expect(page.getByLabel('Manter conectado')).toBeChecked();
  56 | });
  57 | 
  58 | test('redirects protected routes to login when unauthenticated', async ({ page }) => {
  59 |   await page.goto('/pdv');
  60 | 
> 61 |   await expect(page).toHaveURL(/\/login$/);
     |                      ^ Error: expect(page).toHaveURL(expected) failed
  62 |   await expect(page.getByRole('heading', { name: 'Entrar' })).toBeVisible();
  63 | });
  64 | 
```