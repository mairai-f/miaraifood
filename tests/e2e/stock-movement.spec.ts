import { expect, test } from '@playwright/test';
import { installAuthenticatedSession } from './helpers/auth';

const product = {
  id: '00000000-0000-4000-8000-000000000020',
  user_id: '00000000-0000-4000-8000-000000000001',
  code: 20,
  name: 'CAFE TESTE',
  price: 12.5,
  cost_price: 7,
  category: 'MERCEARIA',
  barcode: '7890000000020',
  stock: 8,
  min_stock: 2,
  max_stock: 20,
  control_stock: true,
  deleted: false,
};

test.beforeEach(async ({ page }) => {
  await page.route('**/rest/v1/**', async route => {
    await route.fulfill({ status: 200, contentType: 'application/json', body: '[]' });
  });
  await installAuthenticatedSession(page);
  await page.addInitScript(({ userId }) => {
    window.localStorage.setItem(`happycash:guided-tour:system-tour-v2:${userId}:${userId}:pro`, '1');
  }, { userId: product.user_id });
  await page.unroute('**/rest/v1/rpc/get_current_store_plan_id**');
  await page.route('**/rest/v1/rpc/get_current_store_plan_id**', async route => {
    await route.fulfill({ status: 200, contentType: 'application/json', body: JSON.stringify('pro') });
  });
  await page.route('**/rest/v1/products**', async route => {
    await route.fulfill({ status: 200, contentType: 'application/json', body: JSON.stringify([product]) });
  });
  await page.route('**/rest/v1/stock_movements**', async route => {
    await route.fulfill({ status: 200, contentType: 'application/json', body: '[]' });
  });
  await page.route('**/rest/v1/product_batches**', async route => {
    await route.fulfill({ status: 200, contentType: 'application/json', body: '[]' });
  });
});

test('opens stock movement by clicking anywhere on the product card', async ({ page }) => {
  await page.setViewportSize({ width: 1366, height: 768 });
  await page.goto('/estoque');

  const card = page.getByText(product.name, { exact: true }).locator('xpath=ancestor::div[contains(@class,"rounded-lg")][1]');
  const movementButton = page.getByRole('button', { name: `Movimentar estoque de ${product.name}` });
  await expect(movementButton).toBeVisible();
  await expect(page.getByText('Movimentar estoque', { exact: true })).toBeVisible();

  const cardBounds = await card.boundingBox();
  const buttonBounds = await movementButton.boundingBox();
  expect(buttonBounds?.width).toBeGreaterThanOrEqual((cardBounds?.width ?? 0) - 2);
  expect(buttonBounds?.height).toBeGreaterThanOrEqual((cardBounds?.height ?? 0) - 2);

  await movementButton.click({ position: { x: 12, y: 12 } });
  await expect(page.getByRole('heading', { name: 'Movimentação de Estoque' })).toBeVisible();
  await expect(page.getByText('Estoque atual: 8')).toBeVisible();
});
