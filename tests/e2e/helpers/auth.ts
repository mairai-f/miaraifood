import type { Page, Route } from '@playwright/test';

export const e2eUser = {
  id: '00000000-0000-4000-8000-000000000001',
  email: 'admin.e2e@happycash.test',
};

const allPlanFeatures = [
  'dashboard.view',
  'pdv.use',
  'clients.manage',
  'products.manage',
  'fiado.manage',
  'stock.manage',
  'reports.view',
  'financial.manage',
  'pricing.manage',
  'notes.manage',
  'settings.manage',
  'rewards.manage',
  'deleted.view',
];

const json = async (route: Route, body: unknown, status = 200) => {
  await route.fulfill({
    status,
    contentType: 'application/json',
    body: JSON.stringify(body),
  });
};

interface InstallAuthenticatedSessionOptions {
  planId?: string;
}

export const installAuthenticatedSession = async (
  page: Page,
  { planId = 'demo' }: InstallAuthenticatedSessionOptions = {},
) => {
  await page.addInitScript(({ user }) => {
    const expiresAt = Math.floor(Date.now() / 1000) + 60 * 60;
    const session = {
      access_token: 'e2e-access-token',
      refresh_token: 'e2e-refresh-token',
      token_type: 'bearer',
      expires_in: 3600,
      expires_at: expiresAt,
      user: {
        id: user.id,
        aud: 'authenticated',
        role: 'authenticated',
        email: user.email,
        app_metadata: {},
        user_metadata: {},
        created_at: new Date().toISOString(),
      },
    };

    window.sessionStorage.setItem('happycash:system:app-splash-seen', '1');
    window.localStorage.setItem('happycash-locale', 'pt-BR');
    window.localStorage.setItem('happycash:system:keep-connected', '1');
    window.localStorage.setItem('happycash:system:auth', JSON.stringify(session));
    window.sessionStorage.setItem('happycash:system:auth', JSON.stringify(session));
  }, { user: e2eUser });

  await page.route('**/auth/v1/user**', async route => {
    await json(route, {
      id: e2eUser.id,
      aud: 'authenticated',
      role: 'authenticated',
      email: e2eUser.email,
      app_metadata: {},
      user_metadata: {},
      created_at: new Date().toISOString(),
    });
  });

  await page.route('**/rest/v1/rpc/get_current_store_plan_id**', async route => {
    await json(route, planId);
  });

  await page.route('**/rest/v1/rpc/get_current_store_product_context**', async route => {
    await json(route, 'happycash');
  });

  await page.route('**/rest/v1/profiles**', async route => {
    await json(route, {
      username: 'Admin E2E',
      email: e2eUser.email,
      role: 'admin',
      owner_user_id: e2eUser.id,
    });
  });

  await page.route('**/rest/v1/subscription_plan_features**', async route => {
    await json(route, allPlanFeatures.map(feature_key => ({ feature_key })));
  });

  await page.route('**/functions/v1/manage-fiscal-documents**', async route => {
    await json(route, {
      success: true,
      runtime: {
        enabled: false,
        environment: 'homologacao',
        ready: false,
        missingItems: [],
      },
    });
  });

  await page.route('**/rest/v1/cash_sessions**', async route => {
    await json(route, null);
  });
};
