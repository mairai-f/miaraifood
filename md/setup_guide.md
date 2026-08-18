# Guia de Configuração do HappyCash (Docker, CI/CD, Testes e Docs)

> **Objetivo** – Centralizar, passo a passo, como preparar o ambiente de desenvolvimento, rodar os containers, executar testes, gerar documentação e publicar a aplicação.

---

## 1️⃣ Estrutura de diretórios criada
```
HappyCash/
├─ docker/                # Dockerfile + docker‑compose
│   ├─ Dockerfile
│   └─ docker-compose.yml
├─ tests/
│   ├─ unit/              # Vitest – testes de unidade
│   │   └─ sample.test.ts
│   └─ e2e/               # Playwright – testes end‑to‑end
│       └─ pdv-tef.spec.ts
├─ api/
│   └─ openapi.yaml       # Spec OpenAPI para o TEF Adapter
├─ docs/
│   └─ standards/
│       ├─ ISO_27001.md
│       ├─ ISO_25010.md
│       └─ ISO_20022_TEf.md
├─ scripts/
│   └─ backup/
│       └─ export-supabase.sh
├─ .github/
│   └─ workflows/
│       └─ ci-cd.yml      # Pipeline CI/CD
├─ md/                    # Documentação markdown central
│   ├─ happycash_all_diagrams.md
│   ├─ happycash_uml_ptbr.md
│   ├─ happycash_pdv_tef_integration.md
│   ├─ happycash_folder_structure_ptbr.md
│   └─ setup_guide.md     # <‑ **este arquivo**
└─ package.json           # scripts npm adicionados
```

---

## 2️⃣ Docker – Build e execução local
### 2.1 Dockerfile (frontend + Nginx)
```dockerfile
# ----- Stage 1 – Build -----
FROM node:20-alpine AS builder
WORKDIR /app
COPY package.json package-lock.json* .
RUN npm ci
COPY . .
RUN npm run build   # gera /app/dist

# ----- Stage 2 – Runtime -----
FROM nginx:alpine
RUN rm -rf /usr/share/nginx/html/*
COPY --from=builder /app/dist /usr/share/nginx/html
EXPOSE 80
CMD ["nginx", "-g", "daemon off;"]
```
*Esse Dockerfile está em `docker/Dockerfile`.*

### 2.2 docker‑compose.yml
```yaml
version: "3.9"

services:
  # Frontend (nginx) – disponibiliza a UI na porta 8080
  frontend:
    build:
      context: ./docker
      dockerfile: Dockerfile
    ports:
      - "8080:80"
    environment:
      - VITE_SUPABASE_URL=${SUPABASE_URL}
      - VITE_SUPABASE_KEY=${SUPABASE_KEY}
    volumes:
      - ./md/images:/usr/share/nginx/html/images   # garante que os diagramas estejam disponíveis
    restart: unless-stopped

  # Mock Supabase – PostgreSQL local para desenvolvimento/testes
  supabase:
    image: supabase/postgres:14
    environment:
      POSTGRES_PASSWORD: secret
      POSTGRES_DB: happycash
    ports:
      - "5432:5432"
    restart: unless-stopped

  # Mock TEF – server Node simples que simula a API do provedor
  tef-mock:
    image: node:20-alpine
    working_dir: /app
    volumes:
      - ./tef-mock:/app
    command: "node server.js"
    ports:
      - "3001:3001"
    restart: unless-stopped

  # Electron (opcional – roda no host) – incluído para referência
  electron:
    image: node:20-alpine
    working_dir: /app
    volumes:
      - ./:/app
    command: "npm run electron:dev"
    environment:
      - ELECTRON_ENABLE_LOGGING=1
    stdin_open: true
    tty: true

networks:
  default:
    driver: bridge
```
*Arquivo: `docker/docker-compose.yml`.*

### 2.3 Comandos úteis
```bash
# Build da imagem Docker
npm run docker:build

# Subir o ambiente completo
npm run docker:up

# Parar e remover containers
npm run docker:down
```
Esses scripts já foram adicionados ao `package.json`.

---

## 3️⃣ CI/CD – Pipeline GitHub Actions
O workflow está em `.github/workflows/ci-cd.yml`.
### Principais jobs
| Job | O que faz |
|-----|----------|
| **lint** | `npm run lint` – verifica estilo e possíveis erros. |
| **test** | `npm run test` – executa testes unitários (Vitest). |
| **test:e2e** | `npm run test:e2e` – roda Playwright contra o container Docker. |
| **build** | Gera o bundle frontend (`npm run build`) e o executável Electron. |
| **pdf** | Converte o markdown com diagramas em PDF (`npm run generate:pdf`). |
| **docker** | Build da imagem Docker e push para o registro configurado (GitHub Packages ou Docker Hub). |
| **release** | Publica binários Electron na seção *Releases* do GitHub. |

**Como acionar** – basta fazer push ou abrir Pull Request na branch `main` ou `develop`.

---

## 4️⃣ Testes
### 4.1 Testes de unidade (Vitest)
Arquivo exemplo: `tests/unit/sample.test.ts`
```ts
import { describe, expect, it } from 'vitest';
import { useCreateOrder } from '@/hooks/useCreateOrder';

describe('useCreateOrder', () => {
  it('deve retornar objeto com função createOrder', () => {
    const { createOrder } = useCreateOrder();
    expect(typeof createOrder).toBe('function');
  });
});
```
Execute:
```bash
npm run test
```

### 4.2 Testes end‑to‑end (Playwright)
Arquivo exemplo: `tests/e2e/pdv-tef.spec.ts`
```ts
import { test, expect } from '@playwright/test';

test('fluxo login → ordem → TEF', async ({ page }) => {
  await page.goto('http://localhost:8080');
  // Login de admin (exemplo rápido)
  await page.fill('input[name="email"]', 'admin@example.com');
  await page.fill('input[name="password"]', 'senha123');
  await page.click('button:has-text("Entrar")');
  await expect(page).toHaveURL(/dashboard/);

  // Simular criação de pedido
  await page.click('button:has-text("Nova Venda")');
  await page.fill('input[name="product"]', 'Produto X');
  await page.fill('input[name="quantity"]', '2');
  await page.click('button:has-text("Confirmar")');

  // Verificar que a chamada ao TEF mock retornou "APPROVED"
  await expect(page.locator('text=Pagamento aprovado')).toBeVisible();
});
```
Execute:
```bash
npm run test:e2e
```
O CI executa esse job automaticamente.

---

## 5️⃣ Documentação OpenAPI (TEF Adapter)
Local: `api/openapi.yaml`
```yaml
openapi: 3.0.0
info:
  title: HappyCash – TEF Adapter
  version: 1.0.0
paths:
  /auth:
    post:
      summary: Inicia autorização de pagamento
      requestBody:
        required: true
        content:
          application/json:
            schema:
              type: object
              properties:
                amount:
                  type: number
                cardNumber:
                  type: string
                expiry:
                  type: string
                cvv:
                  type: string
      responses:
        '200':
          description: Transaction ID e status "PENDING"
          content:
            application/json:
              schema:
                type: object
                properties:
                  transactionId:
                    type: string
                  status:
                    type: string
  /capture:
    post:
      summary: Captura pagamento autorizado
      requestBody:
        required: true
        content:
          application/json:
            schema:
              type: object
              properties:
                transactionId:
                  type: string
      responses:
        '200':
          description: Resultado da captura (APPROVED / DECLINED)
```
Use ferramentas como **Swagger UI** ou **Redoc** para visualização.

---

## 6️⃣ Normas ISO (documentos markdown)
- `docs/standards/ISO_27001.md` – Segurança da informação e gestão de segredos. 
- `docs/standards/ISO_25010.md` – Qualidade de software (funcionalidade, usabilidade, confiabilidade, etc.).
- `docs/standards/ISO_20022_TEf.md` – Padrão de mensagens financeiras usado na integração TEF.

## 7️⃣ Script de backup do Supabase
Caminho: `scripts/backup/export-supabase.sh`
```bash
#!/usr/bin/env bash
set -euo pipefail

# Variáveis – configure via .env ou export antes de rodar
SUPABASE_URL=${SUPABASE_URL:-"https://YOUR-PROJECT.supabase.co"}
SUPABASE_KEY=${SUPABASE_KEY:-"YOUR_SERVICE_ROLE_KEY"}
OUTPUT_DIR=backup
mkdir -p "$OUTPUT_DIR"

# Exporta o dump (usando pg_dump dentro do container postgres)
docker exec -i $(docker ps -q -f "ancestor=supabase/postgres:14") \
  pg_dump -U postgres -d happycash -F c -f /tmp/happycash.dump

docker cp $(docker ps -q -f "ancestor=supabase/postgres:14"):/tmp/happycash.dump "$OUTPUT_DIR/happycash_$(date +%Y%m%d_%H%M%S).dump"

echo "Backup salvo em $OUTPUT_DIR"
```
Torne‑o executável: `chmod +x scripts/backup/export-supabase.sh`.

---

## 8️⃣ Como usar tudo isso
1. **Clonar o repo** e instalar dependências:
   ```bash
   git clone https://github.com/celioantonio7/HappyCash.git
   cd HappyCash
   npm ci
   ```
2. **Criar secrets** no GitHub (variáveis de ambiente) – `SUPABASE_URL`, `SUPABASE_KEY`, `TEF_API_KEY`, `VERCEL_TOKEN`, etc.
3. **Rodar ambiente local**:
   ```bash
   npm run docker:up   # sobe containers
   npm run dev         # inicia Vite (acesso via http://localhost:8080)
   ```
4. **Executar testes** (local ou via CI):
   ```bash
   npm run test          # unitários
   npm run test:e2e      # e2e (necessita containers up)
   ```
5. **Gerar documentação PDF**:
   ```bash
   npm run generate:pdf
   ```
   O arquivo `md/happycash_all_diagrams.pdf` será criado.
6. **Publicar** – faça push para `main`; o workflow CI/CD cuidará de lint, builds, Docker image e release do Electron.

---

## 📌 Dicas rápidas
- **Atualizar diagramas** – basta substituir a PNG em `md/images/` e rodar `npm run generate:pdf` novamente.
- **Adicionar novos testes** – coloque arquivos `.test.ts` em `tests/unit/` ou `.spec.ts` em `tests/e2e/`.
- **Versionamento** – use `npm version patch|minor|major` antes de merge; o workflow cria a tag e a release automática.
- **Monitoramento** – configure `sentry.config.js` em `config/monitoring/` e habilite a captura de erros em produção.

---

### 🎉 Pronto!
Com este guia você tem tudo que precisa para desenvolver, testar, documentar e publicar o HappyCash de forma padronizada e segura.
