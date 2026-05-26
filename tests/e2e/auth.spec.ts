import { expect, type Page, test } from '@playwright/test';

const skipSplashAndAuth = async (page: Page) => {
  await page.addInitScript(() => {
    window.sessionStorage.setItem('happycash:system:app-splash-seen', '1');
    window.localStorage.setItem('happycash-locale', 'pt-BR');
    window.localStorage.removeItem('happycash:system:auth');
    window.localStorage.removeItem('happycash:system:temporary-session');
    window.sessionStorage.removeItem('happycash:system:temporary-session-active');
  });
};

test.beforeEach(async ({ page }) => {
  await skipSplashAndAuth(page);
});

test('shows the admin login form by default', async ({ page }) => {
  await page.goto('/login');

  await expect(page.getByRole('heading', { name: 'Entrar' })).toBeVisible();
  await expect(page.getByRole('tab', { name: 'Administrador' })).toHaveAttribute('aria-selected', 'true');
  await expect(page.getByPlaceholder('usuario@happycash.com').first()).toBeVisible();
  await expect(page.getByPlaceholder('••••••••').first()).toBeVisible();
  await expect(page.getByRole('button', { name: 'Entrar' })).toBeVisible();
});

test('switches to operator login and toggles password visibility', async ({ page }) => {
  await page.goto('/login');

  await page.getByRole('tab', { name: 'Operador' }).click();
  await expect(page.getByRole('tab', { name: 'Operador' })).toHaveAttribute('aria-selected', 'true');

  await page.getByPlaceholder('Ex: operador.caixa').fill('caixa.teste');
  const passwordInput = page.getByPlaceholder('••••••••').first();
  await passwordInput.fill('senha123');
  await expect(passwordInput).toHaveAttribute('type', 'password');

  await page.getByRole('button', { name: 'Mostrar senha' }).click();
  await expect(passwordInput).toHaveAttribute('type', 'text');
});

test('keeps remembered login mode without pre-filling auth fields', async ({ page }) => {
  await page.addInitScript(() => {
    window.localStorage.setItem('happycash:system:last-login-mode', 'operator');
    window.localStorage.setItem('happycash:system:remember-account', '1');
    window.localStorage.setItem('happycash:system:keep-connected', '1');
    window.localStorage.setItem('happycash:system:remembered-operator-username', 'operador.memoria');
  });

  await page.goto('/login');

  await expect(page.getByRole('tab', { name: 'Operador' })).toHaveAttribute('aria-selected', 'true');
  await expect(page.getByPlaceholder('Ex: operador.caixa')).toHaveValue('');
  await expect(page.getByLabel('Lembrar minha conta')).not.toBeChecked();
  await expect(page.getByLabel('Manter conectado')).not.toBeChecked();
});

test('redirects protected routes to login when unauthenticated', async ({ page }) => {
  await page.goto('/pdv');

  await expect(page).toHaveURL(/\/login$/);
  await expect(page.getByRole('heading', { name: 'Entrar' })).toBeVisible();
});
