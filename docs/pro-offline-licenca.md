# HappyCash PRO Offline - Licenca, planos e SEO

## Objetivo desta fase

Implementar a primeira base do PRO Offline e atualizar a comunicacao da landing page:

- Plano Basico: R$ 100 / 30 dias e R$ 997 / ano.
- Plano Completo: R$ 230 / 30 dias e R$ 2.097 / ano.
- Plano PRO: R$ 347 / 30 dias e R$ 2.997 / ano.
- Impressora termica apenas nos planos Completo e PRO.
- Maquininha apenas nos planos anuais Completo e PRO.
- PRO Offline apenas no plano PRO.
- Sem desconto antecipado nesta fase.

## Fluxo PRO Offline

1. Cliente compra o Plano PRO no site.
2. Pagamento aprovado no Asaas.
3. Webhook do Asaas ativa o PRO e registra a chave de licenca.
4. Area logada libera a chave de licenca e o download do executavel.
5. Cliente baixa o instalador junto da chave.
6. Cliente instala o desktop.
7. Desktop valida a licenca uma vez com internet.
8. Licenca fica em cache local para uso offline.
9. Sistema usa SQLite local para snapshot e fila de sincronizacao.
10. Quando a internet voltar, o desktop sincroniza com Supabase.

## Regra de licenca

- Ciclo do plano: 30 dias.
- Tolerancia offline: 7 dias.
- Download do executavel: apenas com PRO ativo.
- Chave de licenca: liberada apenas com PRO ativo.
- Uso offline: permitido apenas quando a ultima licenca PRO foi validada e ainda esta dentro da tolerancia.
- Depois da tolerancia, o desktop exige internet para validar novamente.

Mensagem esperada quando expirar:

> Seu periodo offline expirou. Conecte-se a internet para validar sua assinatura e continuar usando todos os recursos do HappyCash PRO.

## Onde esta no codigo

- `supabase/functions/_shared/desktopAccess.ts`
  - Valida se o usuario ou dono da loja tem assinatura PRO ativa.
  - Exige as features `desktop.app` e `offline.access`.
  - Retorna `licenseKey`, `offlineGraceDays` e `offlineGraceUntil` para o desktop.

- `supabase/functions/_shared/desktopLicenseKey.ts`
  - Gera chave deterministica por HMAC para assinatura PRO.
  - Salva apenas hash, prefixo e final da chave em `desktop_license_keys`.
  - Nao salva a chave completa pura no banco.

- `supabase/functions/desktop-license-key/index.ts`
  - Edge Function usada pelo site para mostrar/copiar a chave ao cliente.
  - So responde para usuario autenticado com PRO ativo.

- `supabase/functions/desktop-license/index.ts`
  - Edge Function chamada pelo executavel para validar licenca.
  - Retorna licenca valida, chave, plano, validade e tolerancia offline.

- `supabase/functions/desktop-download/index.ts`
  - Libera o instalador apenas para PRO ativo.
  - Inclui a chave de licenca na resposta do download protegido.

- `supabase/functions/asaas-webhook/index.ts`
  - Ao receber pagamento confirmado do PRO, ativa a assinatura e registra a chave.

- `src/contexts/DesktopRuntimeContext.tsx`
  - Chama a Edge Function.
  - Salva cache local da licenca e chave retornada.
  - Em erro de rede, libera o desktop somente ate `offlineGraceUntil`.

- `electron/main.cjs`
  - Mantem o SQLite local `happycash-concentrator.sqlite`.
  - Guarda snapshot, fila de sync e conflitos offline.

- `supabase/migrations/20260505120000_pro_offline_license_and_annual_plans.sql`
  - Adiciona `annual_price`.
  - Documenta as tabelas/colunas com `COMMENT`.
  - Adiciona `thermal.printer` somente para Completo e PRO.

- `supabase/migrations/20260505123000_create_desktop_license_keys.sql`
  - Cria `desktop_license_keys`.
  - Guarda hash da chave, prefixo, final e vinculo com a assinatura.
  - Documenta a regra de nao salvar a chave pura.

- `happycashsite/src/components/landing/Pricing.tsx`
  - Atualiza textos comerciais, planos mensais/anuais e aviso de impressora.

- `happycashsite/src/pages/Dashboard.tsx`
  - Mostra a chave no painel apenas quando o PRO esta ativo.

- `happycashsite/src/pages/DownloadRedirect.tsx`
  - Mostra a chave junto do download do instalador.
  - Permite baixar um `.txt` com a chave para acompanhar o instalador.

- `happycashsite/src/pages/Index.tsx`
  - Atualiza SEO, keywords e JSON-LD da landing page.

## Impressora termica

Texto comercial correto:

> Compatível com impressoras térmicas instaladas no computador. A impressora não está inclusa no plano.

Regra:

- Basico: nao inclui impressora.
- Completo: inclui compatibilidade com impressora.
- PRO: inclui compatibilidade com impressora.

## Maquininha

Regra comercial:

- Basico mensal/anual: nao inclui maquininha.
- Completo mensal: nao inclui maquininha.
- PRO mensal: nao inclui maquininha.
- Completo anual: pode incluir maquininha, conforme disponibilidade comercial.
- PRO anual: pode incluir maquininha, conforme disponibilidade comercial.

Feature tecnica documentada:

- `card.terminal.annual`: marca a regra de maquininha apenas para anuais Completo e PRO.

## Importante sobre PIN

Quando a tela de criacao de usuario/PIN local for implementada, nunca salvar PIN puro.

Fluxo correto:

```text
PIN digitado
gera hash
compara com hash salvo
```

O PIN local ainda nao foi implementado nesta primeira entrega.
