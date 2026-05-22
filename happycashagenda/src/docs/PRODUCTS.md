# 🛍️ Sistema de Produtos

## Visão Geral

O sistema de produtos permite gerenciar e exibir produtos vendidos na barbearia, como gel, pomadas, tintas, pentes e acessórios.

---

## Componentes

### 1. Vitrine Pública

**Rota:** `/products`
**Arquivo:** `src/pages/Products.tsx`

Funcionalidades:
- Exibição de todos os produtos ativos
- Filtro por categoria
- Layout responsivo em grid
- Indicador de estoque baixo (≤5 unidades)
- Badge de "Esgotado" quando estoque = 0

### 2. Gestão Administrativa

**Rota:** `/admin` → Aba "Produtos"
**Arquivo:** `src/pages/AdminDashboard.tsx`

Funcionalidades:
- Criar novos produtos
- Editar produtos existentes
- Upload de imagem do produto
- Ativar/desativar produtos
- Excluir produtos
- Gerenciar estoque

---

## Estrutura do Produto

| Campo | Tipo | Obrigatório | Descrição |
|-------|------|-------------|-----------|
| name | texto | Sim | Nome do produto |
| description | texto | Não | Descrição detalhada |
| price | número | Sim | Preço em reais |
| stock_quantity | número | Não | Quantidade em estoque |
| category | texto | Não | Categoria (ex: Gel, Tintas) |
| image_url | texto | Não | URL da imagem |
| is_active | boolean | - | Se aparece na vitrine |

---

## Gestão de Imagens

### Storage Bucket

- **Nome:** `product-images`
- **Público:** Sim (imagens acessíveis diretamente)
- **Formato aceito:** Imagens (jpg, png, webp, etc.)

### Upload de Imagem

1. No formulário de produto, clique em "Adicionar Foto"
2. Selecione a imagem do dispositivo
3. A prévia será exibida
4. Ao salvar, a imagem é enviada para o storage

### Políticas de Storage

```sql
-- Administradores podem gerenciar imagens
CREATE POLICY "Admins can manage product images"
ON storage.objects FOR ALL
USING (bucket_id = 'product-images' AND has_role(auth.uid(), 'admin'));

-- Público pode visualizar imagens
CREATE POLICY "Public can view product images"
ON storage.objects FOR SELECT
USING (bucket_id = 'product-images');
```

---

## Categorias Sugeridas

- **Pomadas e Gel**: Produtos para estilização
- **Tintas**: Coloração capilar e de barba
- **Cuidados**: Shampoos, condicionadores, óleos
- **Ferramentas**: Pentes, escovas, tesouras
- **Acessórios**: Capas, toalhas, kits

---

## Controle de Estoque

### Indicadores Visuais

- **Estoque normal**: Exibe apenas preço
- **Estoque baixo (≤5)**: Exibe "Últimas X unidades"
- **Sem estoque (0)**: Overlay "Esgotado"

### Atualização de Estoque

Via painel admin:
1. Clique em "Editar" no produto
2. Altere o campo "Estoque"
3. Salve

---

## API de Dados

### Buscar produtos ativos (vitrine)

```typescript
const { data } = await supabase
  .from('agenda_products')
  .select('*')
  .eq('is_active', true)
  .order('name');
```

### Buscar todos (admin)

```typescript
const { data } = await supabase
  .from('agenda_products')
  .select('*')
  .order('name');
```

---

## Personalização

### Ajustar layout da vitrine

O grid de produtos pode ser configurado em `Products.tsx`:

```tsx
// Atual: 2 colunas mobile, 3 tablet, 4 desktop, 5 grande
<div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-4 xl:grid-cols-5 gap-3">
```

### Adicionar novas categorias

Simplesmente cadastre produtos com a categoria desejada - o filtro detecta automaticamente categorias únicas.

---

## Políticas de Segurança

```sql
-- Público pode ver produtos ativos
CREATE POLICY "Public can view active products"
ON public.agenda_products FOR SELECT
USING (is_active = true);

-- Administradores podem gerenciar tudo
CREATE POLICY "Admins can manage products"
ON public.agenda_products FOR ALL
USING (has_role(auth.uid(), 'admin'));
```
