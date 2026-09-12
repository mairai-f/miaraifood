# Instructions

- Following Playwright test failed.
- Explain why, be concise, respect Playwright best practices.
- Provide a snippet of code with the fix, if possible.

# Test info

- Name: product-packaging.spec.ts >> configures a commercial package in the responsive product dialog
- Location: tests/e2e/product-packaging.spec.ts:28:1

# Error details

```
Test timeout of 30000ms exceeded.
```

```
Error: locator.click: Test timeout of 30000ms exceeded.
Call log:
  - waiting for getByRole('button', { name: 'Embalagem' })

```

# Page snapshot

```yaml
- generic:
  - generic:
    - list
    - region "Notifications alt+T"
    - generic [aria-hidden]:
      - complementary:
        - generic:
          - generic:
            - button
        - generic:
          - navigation:
            - link:
              - /url: /
              - generic: Painel
            - link:
              - /url: /pdv
              - generic: PDV
            - link:
              - /url: /mesas
              - generic: Mesas
            - link:
              - /url: /conversas
              - generic: Conversas
            - link:
              - /url: /kds
              - generic: Cozinha (KDS)
            - link:
              - /url: /clientes
              - generic: Clientes
            - link:
              - /url: /produtos
              - generic: Produtos
            - link:
              - /url: /estoque
              - generic: Estoque
            - link:
              - /url: /configuracoes
              - generic: Configurações
        - generic:
          - button:
            - generic: Sair
      - generic:
        - banner:
          - button
          - generic:
            - button
            - button
            - button
        - main:
          - generic:
            - generic:
              - generic:
                - heading [level=1]: Produtos
              - button [expanded]: Novo
            - generic:
              - generic:
                - generic:
                  - generic:
                    - paragraph: Travar venda sem saldo
                    - paragraph: "Ligado: qualquer produto com controle de estoque trava no PDV e no fiado quando zerar. Desligado: a venda pode levar o saldo para negativo."
                  - switch [checked]
            - generic:
              - textbox:
                - /placeholder: Buscar produto...
            - paragraph: Nenhum produto encontrado.
      - button:
        - generic:
          - generic: MIAR Gestora IA
          - generic: Sua analista da loja
  - dialog [ref=e2]:
    - heading "Cadastrar Produto" [level=2] [ref=e4]
    - generic [ref=e5]:
      - tablist [ref=e6]:
        - tab "Geral" [active] [selected] [ref=e7] [cursor=pointer]
        - tab "Estoque" [ref=e8] [cursor=pointer]
        - tab "Embalagens" [ref=e9] [cursor=pointer]
        - tab "Comercial" [ref=e10] [cursor=pointer]
        - tab "Fiscal (NFC-e)" [ref=e11] [cursor=pointer]
      - generic [ref=e12]:
        - tabpanel "Geral" [ref=e13]:
          - generic [ref=e14]:
            - text: Nome / Marca
            - 'textbox "Ex: Skol 600ml" [ref=e15]'
          - generic [ref=e17]:
            - checkbox "Produto simples" [checked] [ref=e18] [cursor=pointer]
            - generic [ref=e19]:
              - text: Produto simples
              - paragraph [ref=e20]: Use simples para venda direta. Desmarque somente quando for composto ou materia-prima.
          - generic [ref=e21]:
            - generic [ref=e22]:
              - text: Preço Venda (R$)
              - textbox "0,00" [ref=e23]
            - generic [ref=e24]:
              - text: Custo Real (R$)
              - textbox "0,00" [ref=e25]
          - generic [ref=e26]:
            - generic [ref=e27]:
              - text: Código de Barras
              - textbox "EAN/UPC/ITF" [ref=e28]
            - generic [ref=e29]:
              - text: Referência
              - textbox "Código interno/fabricante" [ref=e30]
          - generic [ref=e31]:
            - generic [ref=e32]:
              - paragraph [ref=e33]: Classificação
              - paragraph [ref=e34]: Setores, marcas, grupos e unidades são administrados nas Configurações Web.
            - generic [ref=e35]:
              - generic [ref=e36]:
                - text: Setor
                - combobox [ref=e37] [cursor=pointer]:
                  - generic: Sem setor
              - generic [ref=e40]:
                - text: Marca
                - combobox [ref=e41] [cursor=pointer]:
                  - generic: Sem marca
              - generic [ref=e44]:
                - text: Grupo
                - combobox [ref=e45] [cursor=pointer]:
                  - generic: Sem grupo
              - generic [ref=e48]:
                - text: Subgrupo
                - combobox [disabled] [ref=e49]:
                  - generic: Sem subgrupo
              - generic [ref=e52]:
                - text: Unidade comercial
                - combobox [ref=e53] [cursor=pointer]:
                  - generic: Selecione
              - generic [ref=e56]:
                - text: Categoria legada
                - textbox "Compatibilidade" [ref=e57]
          - generic [ref=e58]:
            - text: Fornecedor principal
            - combobox "Escolha um fornecedor cadastrado" [ref=e59]
        - generic [ref=e60]:
          - generic [ref=e61]:
            - paragraph [ref=e62]: Validade opcional
            - paragraph [ref=e63]: Preencha somente quando o produto tiver lote com vencimento.
          - generic [ref=e64]:
            - generic [ref=e65]:
              - text: Lote
              - 'textbox "Ex: LOTE-01" [ref=e66]'
            - generic [ref=e67]:
              - text: Quantidade do lote
              - spinbutton "0" [ref=e68]
            - generic [ref=e69]:
              - text: Data de validade
              - textbox [ref=e70]
            - generic [ref=e71]:
              - text: Alertar com antecedência
              - spinbutton [ref=e72]: "30"
    - button "Cadastrar" [ref=e74] [cursor=pointer]
    - button "Close" [ref=e75] [cursor=pointer]
```

# Test source

```ts
  1  | import { expect, test } from '@playwright/test';
  2  | import { installAuthenticatedSession } from './helpers/auth';
  3  | 
  4  | const catalogTables = [
  5  |   'suppliers',
  6  |   'product_departments',
  7  |   'product_brands',
  8  |   'product_groups',
  9  |   'product_subgroups',
  10 |   'measurement_units',
  11 |   'product_price_tables',
  12 |   'transport_companies',
  13 |   'product_packagings',
  14 | ];
  15 | 
  16 | test.beforeEach(async ({ page }) => {
  17 |   await installAuthenticatedSession(page);
  18 |   await page.route('**/rest/v1/rpc/get_current_store_account_id_for_context**', async route => {
  19 |     await route.fulfill({ status: 200, contentType: 'application/json', body: JSON.stringify('00000000-0000-4000-8000-000000000010') });
  20 |   });
  21 |   for (const table of catalogTables) {
  22 |     await page.route(`**/rest/v1/${table}**`, async route => {
  23 |       await route.fulfill({ status: 200, contentType: 'application/json', body: '[]' });
  24 |     });
  25 |   }
  26 | });
  27 | 
  28 | test('configures a commercial package in the responsive product dialog', async ({ page }) => {
  29 |   await page.setViewportSize({ width: 390, height: 844 });
  30 |   await page.goto('/produtos');
  31 |   await page.getByRole('button', { name: 'Novo' }).click();
  32 | 
  33 |   await expect(page.getByRole('heading', { name: 'Cadastrar Produto' })).toBeVisible();
> 34 |   await page.getByRole('button', { name: 'Embalagem' }).click();
     |                                                         ^ Error: locator.click: Test timeout of 30000ms exceeded.
  35 | 
  36 |   await expect(page.getByText('Embalagens comerciais')).toBeVisible();
  37 |   await expect(page.getByPlaceholder('FARDO COM 6')).toBeVisible();
  38 |   await expect(page.getByText('Aplicar ao atingir a quantidade')).toBeVisible();
  39 |   await expect(page.getByText('Somente embalagem fechada')).toBeVisible();
  40 | 
  41 |   const horizontalOverflow = await page.evaluate(() => document.documentElement.scrollWidth > document.documentElement.clientWidth);
  42 |   expect(horizontalOverflow).toBe(false);
  43 | });
  44 | 
  45 | test('uses the available desktop width without horizontal dialog scrolling', async ({ page }) => {
  46 |   await page.setViewportSize({ width: 1366, height: 768 });
  47 |   await page.goto('/produtos');
  48 |   await page.getByRole('button', { name: 'Novo' }).click();
  49 |   await page.getByRole('button', { name: 'Embalagem' }).click();
  50 | 
  51 |   const dialog = page.getByRole('dialog');
  52 |   await expect(dialog).toBeVisible();
  53 |   const bounds = await dialog.boundingBox();
  54 |   expect(bounds?.width).toBeGreaterThan(800);
  55 | 
  56 |   const hasHorizontalOverflow = await dialog.evaluate(element => element.scrollWidth > element.clientWidth);
  57 |   expect(hasHorizontalOverflow).toBe(false);
  58 | });
  59 | 
```