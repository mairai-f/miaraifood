import { expect, test } from '@playwright/test';
import { installAuthenticatedSession } from './helpers/auth';

const catalogTables = [
  'suppliers',
  'product_departments',
  'product_brands',
  'product_groups',
  'product_subgroups',
  'measurement_units',
  'product_price_tables',
  'transport_companies',
  'product_packagings',
];

test.beforeEach(async ({ page }) => {
  await installAuthenticatedSession(page);
  await page.route('**/rest/v1/rpc/get_current_store_account_id_for_context**', async route => {
    await route.fulfill({ status: 200, contentType: 'application/json', body: JSON.stringify('00000000-0000-4000-8000-000000000010') });
  });
  for (const table of catalogTables) {
    await page.route(`**/rest/v1/${table}**`, async route => {
      await route.fulfill({ status: 200, contentType: 'application/json', body: '[]' });
    });
  }
});

test('configures a commercial package in the responsive product dialog', async ({ page }) => {
  await page.setViewportSize({ width: 390, height: 844 });
  await page.goto('/produtos');
  await page.getByRole('button', { name: 'Novo' }).click();

  await expect(page.getByRole('heading', { name: 'Cadastrar Produto' })).toBeVisible();
  await page.getByRole('button', { name: 'Embalagem' }).click();

  await expect(page.getByText('Embalagens comerciais')).toBeVisible();
  await expect(page.getByPlaceholder('FARDO COM 6')).toBeVisible();
  await expect(page.getByText('Aplicar ao atingir a quantidade')).toBeVisible();
  await expect(page.getByText('Somente embalagem fechada')).toBeVisible();

  const horizontalOverflow = await page.evaluate(() => document.documentElement.scrollWidth > document.documentElement.clientWidth);
  expect(horizontalOverflow).toBe(false);
});

test('uses the available desktop width without horizontal dialog scrolling', async ({ page }) => {
  await page.setViewportSize({ width: 1366, height: 768 });
  await page.goto('/produtos');
  await page.getByRole('button', { name: 'Novo' }).click();
  await page.getByRole('button', { name: 'Embalagem' }).click();

  const dialog = page.getByRole('dialog');
  await expect(dialog).toBeVisible();
  const bounds = await dialog.boundingBox();
  expect(bounds?.width).toBeGreaterThan(800);

  const hasHorizontalOverflow = await dialog.evaluate(element => element.scrollWidth > element.clientWidth);
  expect(hasHorizontalOverflow).toBe(false);
});
