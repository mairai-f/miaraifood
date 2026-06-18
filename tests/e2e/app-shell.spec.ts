import { expect, test } from '@playwright/test';
import { installAuthenticatedSession } from './helpers/auth';

test.beforeEach(async ({ page }) => {
  await installAuthenticatedSession(page);
});

test('opens the authenticated dashboard with the main navigation', async ({ page }) => {
  await page.goto('/');

  await expect(page.getByRole('heading', { name: 'Painel de Controle' })).toBeVisible();
  await expect(page.getByRole('link', { name: /PDV/ })).toBeVisible();
  await expect(page.getByRole('link', { name: 'Clientes' })).toBeVisible();
  await expect(page.getByRole('link', { name: 'Produtos' })).toBeVisible();
  await expect(page.getByText('Admin E2E')).toBeVisible();
});

test('opens PDV for an authenticated user and asks to open cash', async ({ page }) => {
  await page.goto('/pdv');

  await expect(page.getByText('Informe o valor inicial e confirme com credenciais de administrador para liberar o PDV.')).toBeVisible();
  await expect(page.getByPlaceholder('0.00')).toBeVisible();
  await expect(page.getByRole('button', { name: 'Abrir caixa' })).toBeVisible();
});
