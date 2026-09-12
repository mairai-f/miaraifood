# Instructions

- Following Playwright test failed.
- Explain why, be concise, respect Playwright best practices.
- Provide a snippet of code with the fix, if possible.

# Test info

- Name: auth.spec.ts >> switches to operator login and toggles password visibility
- Location: tests/e2e/auth.spec.ts:27:1

# Error details

```
Test timeout of 30000ms exceeded.
```

```
Error: locator.click: Test timeout of 30000ms exceeded.
Call log:
  - waiting for getByRole('tab', { name: 'Operacional' })

```

# Page snapshot

```yaml
- generic [ref=e2]:
  - region "Notifications (F8)":
    - list
  - region "Notifications alt+T"
  - dialog "Selecione seu idioma" [ref=e3]:
    - generic [ref=e4]:
      - generic [ref=e5]:
        - img "MIAR AI/FOOD" [ref=e6]
        - heading "Selecione seu idioma" [level=1] [ref=e7]
        - paragraph [ref=e8]: MIAR AI/FOOD
      - generic [ref=e9]:
        - button "Português Português (Brasil)" [pressed] [ref=e10] [cursor=pointer]:
          - generic [aria-hidden] [ref=e11]: 🇧🇷
          - generic [ref=e12]:
            - generic [ref=e13]: Português
            - generic [ref=e14]: Português (Brasil)
        - button "English Inglês" [ref=e16] [cursor=pointer]:
          - generic [aria-hidden] [ref=e17]: 🇺🇸
          - generic [ref=e18]:
            - generic [ref=e19]: English
            - generic [ref=e20]: Inglês
        - button "Español Espanhol" [ref=e22] [cursor=pointer]:
          - generic [aria-hidden] [ref=e23]: 🇪🇸
          - generic [ref=e24]:
            - generic [ref=e25]: Español
            - generic [ref=e26]: Espanhol
        - button "Avañe'ẽ Guarani" [ref=e28] [cursor=pointer]:
          - generic [aria-hidden] [ref=e29]: 🇵🇾
          - generic [ref=e30]:
            - generic [ref=e31]: Avañe'ẽ
            - generic [ref=e32]: Guarani
      - button "Continuar" [ref=e34] [cursor=pointer]
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
> 30 |   await page.getByRole('tab', { name: 'Operacional' }).click();
     |                                                        ^ Error: locator.click: Test timeout of 30000ms exceeded.
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
  61 |   await expect(page).toHaveURL(/\/login$/);
  62 |   await expect(page.getByRole('heading', { name: 'Entrar' })).toBeVisible();
  63 | });
  64 | 
```