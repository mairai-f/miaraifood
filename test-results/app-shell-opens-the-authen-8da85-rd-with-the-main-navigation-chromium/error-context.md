# Instructions

- Following Playwright test failed.
- Explain why, be concise, respect Playwright best practices.
- Provide a snippet of code with the fix, if possible.

# Test info

- Name: app-shell.spec.ts >> opens the authenticated dashboard with the main navigation
- Location: tests/e2e/app-shell.spec.ts:8:1

# Error details

```
Error: expect(locator).toBeVisible() failed

Locator: getByText('Admin E2E')
Expected: visible
Timeout: 5000ms
Error: element(s) not found

Call log:
  - Expect "toBeVisible" getByText('Admin E2E') with timeout 5000ms
  - waiting for getByText('Admin E2E')

```

```yaml
- region "Notifications (F8)":
  - list
- region "Notifications alt+T"
- complementary:
  - img "MIAR AI/FOOD"
  - navigation:
    - link "Painel 1":
      - /url: /
      - img
      - text: Painel 1
    - link "PDV 2":
      - /url: /pdv
      - img
      - text: PDV 2
    - link "Mesas":
      - /url: /mesas
      - img
      - text: Mesas
    - link "Conversas":
      - /url: /conversas
      - img
      - text: Conversas
    - link "Cozinha (KDS)":
      - /url: /kds
      - img
      - text: Cozinha (KDS)
    - link "Clientes 4":
      - /url: /clientes
      - img
      - text: Clientes 4
    - link "Produtos 5":
      - /url: /produtos
      - img
      - text: Produtos 5
    - link "Estoque 6":
      - /url: /estoque
      - img
      - text: Estoque 6
    - link "Configurações 7":
      - /url: /configuracoes
      - img
      - text: Configurações 7
  - button "Sair":
    - img
    - text: Sair
- banner:
  - button "Esconder menu lateral":
    - img
  - button "Alternar para tema escuro":
    - img
    - text: Claro
  - button "Sincronizar Alt+Shift+S":
    - img
    - text: Sincronizar Alt+Shift+S
  - button "Administrador Administrador":
    - img
    - text: Administrador Administrador
- main:
  - heading "PAINEL DE CONTROLE MIAR AI/FOOD" [level=1]
  - paragraph: Visão em tempo real da operação da filial.
  - button "Ir para o PDV":
    - img
    - text: Ir para o PDV
  - button "KDS Cozinha":
    - img
    - text: KDS Cozinha
  - paragraph: Pedidos Hoje
  - paragraph: "0"
  - paragraph: Pedidos recebidos hoje
  - img
  - paragraph: Mesas Ocupadas
  - paragraph: "0"
  - paragraph: De 0 mesas ativas
  - img
  - paragraph: Em Preparo
  - paragraph: "0"
  - paragraph: Pedidos na fila do KDS
  - img
  - paragraph: Vendas Hoje
  - paragraph: R$ 0,00
  - paragraph: Vendas registradas hoje
  - img
  - heading "OPERAÇÃO AGORA" [level=3]:
    - img
    - text: OPERAÇÃO AGORA
  - paragraph: Últimos pedidos transitando pela cozinha e salão
  - button "Ver todas":
    - text: Ver todas
    - img
  - text: Nenhum pedido em andamento nesta filial.
  - heading "COZINHA (KDS)" [level=3]:
    - img
    - text: COZINHA (KDS)
  - button "Abrir KDS":
    - text: Abrir KDS
    - img
  - img
  - text: Pedidos na fila 0
  - img
  - text: Atrasados 0
  - img
  - text: Tempo médio de preparo —
  - heading "MESAS" [level=3]:
    - img
    - text: MESAS
  - button "Mapa Mesas":
    - text: Mapa Mesas
    - img
  - paragraph: Total
  - paragraph: "0"
  - paragraph: Ocupadas
  - paragraph: "0"
  - paragraph: Livres
  - paragraph: "0"
  - paragraph: Atendimento
  - paragraph: "0"
- button "Abrir MIAR Gestora IA":
  - img
  - text: MIAR Gestora IA Sua analista da loja
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
> 15 |   await expect(page.getByText('Admin E2E')).toBeVisible();
     |                                             ^ Error: expect(locator).toBeVisible() failed
  16 | });
  17 | 
  18 | test('opens PDV for an authenticated user and asks to open cash', async ({ page }) => {
  19 |   await page.goto('/pdv');
  20 | 
  21 |   await expect(page.getByText('Informe o valor inicial e confirme com credenciais de administrador para liberar o PDV.')).toBeVisible();
  22 |   await expect(page.getByPlaceholder('0.00')).toBeVisible();
  23 |   await expect(page.getByRole('button', { name: 'Abrir caixa' })).toBeVisible();
  24 | });
  25 | 
```