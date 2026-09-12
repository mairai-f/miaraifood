# Instructions

- Following Playwright test failed.
- Explain why, be concise, respect Playwright best practices.
- Provide a snippet of code with the fix, if possible.

# Test info

- Name: app-shell.spec.ts >> opens PDV for an authenticated user and asks to open cash
- Location: tests/e2e/app-shell.spec.ts:18:1

# Error details

```
Error: expect(locator).toBeVisible() failed

Locator: getByText('Informe o valor inicial e confirme com credenciais de administrador para liberar o PDV.')
Expected: visible
Timeout: 5000ms
Error: element(s) not found

Call log:
  - Expect "toBeVisible" getByText('Informe o valor inicial e confirme com credenciais de administrador para liberar o PDV.') with timeout 5000ms
  - waiting for getByText('Informe o valor inicial e confirme com credenciais de administrador para liberar o PDV.')

```

```yaml
- region "Notifications (F8)":
  - list
- region "Notifications alt+T"
- img
- text: Carregando...
```

# Test source

```ts
  1  | import { expect, test } from '@playwright/test';
  2  | import { installAuthenticatedSession } from './helpers/auth';
  3  | 
  4  | test.beforeEach(async ({ page }) => {
  5  |   await installAuthenticatedSession(page);
  6  | });
  7  | 
  8  | test('opens the authenticated dashboard with the main navigation', async ({ page }) => {
  9  |   await page.goto('/');
  10 | 
  11 |   await expect(page.getByRole('heading', { name: 'Painel de Controle' })).toBeVisible();
  12 |   await expect(page.getByRole('link', { name: /PDV/ })).toBeVisible();
  13 |   await expect(page.getByRole('link', { name: 'Clientes' })).toBeVisible();
  14 |   await expect(page.getByRole('link', { name: 'Produtos' })).toBeVisible();
  15 |   await expect(page.getByText('Admin E2E')).toBeVisible();
  16 | });
  17 | 
  18 | test('opens PDV for an authenticated user and asks to open cash', async ({ page }) => {
  19 |   await page.goto('/pdv');
  20 | 
> 21 |   await expect(page.getByText('Informe o valor inicial e confirme com credenciais de administrador para liberar o PDV.')).toBeVisible();
     |                                                                                                                           ^ Error: expect(locator).toBeVisible() failed
  22 |   await expect(page.getByPlaceholder('0.00')).toBeVisible();
  23 |   await expect(page.getByRole('button', { name: 'Abrir caixa' })).toBeVisible();
  24 | });
  25 | 
```