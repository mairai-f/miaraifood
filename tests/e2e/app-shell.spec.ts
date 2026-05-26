import { expect, test } from '@playwright/test';
import { installAuthenticatedSession } from './helpers/auth';

test('opens the authenticated dashboard with the main navigation', async ({ page }) => {
  await installAuthenticatedSession(page);
  await page.goto('/');

  await expect(page.getByRole('heading', { name: 'Painel de Controle' })).toBeVisible();
  await expect(page.getByRole('link', { name: /PDV/ })).toBeVisible();
  await expect(page.getByRole('link', { name: 'Clientes' })).toBeVisible();
  await expect(page.getByRole('link', { name: 'Produtos' })).toBeVisible();
  await expect(page.getByText('Admin E2E')).toBeVisible();
});

test('opens PDV for an authenticated user and asks to open cash', async ({ page }) => {
  await installAuthenticatedSession(page);
  await page.goto('/pdv');

  await expect(page.getByText('Informe o valor inicial para liberar o PDV.')).toBeVisible();
  await expect(page.getByPlaceholder('0.00')).toBeVisible();
  await expect(page.getByRole('button', { name: 'Abrir caixa' })).toBeVisible();
});

test('shows the guided tour on first pro plan access', async ({ page }) => {
  await installAuthenticatedSession(page, { planId: 'pro' });
  await page.goto('/');

  await expect(page.getByRole('dialog', { name: 'Comece pelo painel' })).toBeVisible();
  await expect(page.getByText('Tour HappyCash 1/24')).toBeVisible();

  await page.getByRole('button', { name: 'Pular' }).click();
  await expect(page.getByRole('dialog', { name: 'Comece pelo painel' })).toBeHidden();
});
