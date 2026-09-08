import "dotenv/config";

import { createClient } from "@supabase/supabase-js";

const supabaseUrl = process.env.SUPABASE_URL || process.env.VITE_SUPABASE_URL;
const serviceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY;
const defaultDemoPassword = "happycash@123";
const demoPassword = process.env.DEMO_ACCOUNT_PASSWORD || defaultDemoPassword;
const demoEmailDomain = process.env.DEMO_EMAIL_DOMAIN || "happycashsite.com.br";
const placeholderServiceRoleValues = new Set([
  "sua-service-role",
  "your-service-role",
  "your-service-role-key",
  "service-role",
]);

if (!supabaseUrl || !serviceRoleKey) {
  if (!supabaseUrl) console.error("Missing SUPABASE_URL or VITE_SUPABASE_URL.");
  if (!serviceRoleKey) console.error("Missing SUPABASE_SERVICE_ROLE_KEY.");
  console.error("Example:");
  console.error("  SUPABASE_SERVICE_ROLE_KEY=... npm run demo:create-accounts");
  process.exit(1);
}

if (placeholderServiceRoleValues.has(serviceRoleKey.trim().toLowerCase())) {
  console.error("SUPABASE_SERVICE_ROLE_KEY is still a placeholder.");
  console.error("Use the real service_role key from Supabase Dashboard > Project Settings > API > Project API keys.");
  process.exit(1);
}

if (!serviceRoleKey.startsWith("eyJ")) {
  console.error("SUPABASE_SERVICE_ROLE_KEY does not look like a Supabase JWT key.");
  console.error("It usually starts with 'eyJ'. Copy the service_role key, not the anon/publishable key.");
  process.exit(1);
}

const supabase = createClient(supabaseUrl, serviceRoleKey, {
  auth: {
    autoRefreshToken: false,
    persistSession: false,
  },
});

const plans = [
  {
    planId: "demo",
    email: `teste-demo@${demoEmailDomain}`,
    nomeCliente: "Cliente Teste Demo",
    nomeEstabelecimento: "Bistrô Miar Demo",
    cnpj: "91000000000100",
    tipoEstabelecimento: "Loja de bairro",
    telefone: "11991000000",
  },
  {
    planId: "fiado",
    email: `teste-fiado@${demoEmailDomain}`,
    nomeCliente: "Cliente Teste Fiado",
    nomeEstabelecimento: "Mercadinho Fiado Demo",
    cnpj: "91000000000101",
    tipoEstabelecimento: "Mercado de bairro",
    telefone: "11991000001",
  },
  {
    planId: "completo",
    email: `teste-completo@${demoEmailDomain}`,
    nomeCliente: "Cliente Teste Completo",
    nomeEstabelecimento: "Padaria Completa Demo",
    cnpj: "91000000000102",
    tipoEstabelecimento: "Padaria",
    telefone: "11991000002",
  },
  {
    planId: "pro",
    email: `teste-pro@${demoEmailDomain}`,
    nomeCliente: "Cliente Teste Pro",
    nomeEstabelecimento: "Emporio Pro Demo",
    cnpj: "91000000000103",
    tipoEstabelecimento: "Emporio",
    telefone: "11991000003",
  },
];

const products = [
  { name: "Arroz 5kg", price: 28.9, cost_price: 21.4, category: "Mercearia", stock: 18, min_stock: 8, barcode: "7891000000011" },
  { name: "Cafe 500g", price: 18.5, cost_price: 12.2, category: "Mercearia", stock: 6, min_stock: 10, barcode: "7891000000028" },
  { name: "Leite 1L", price: 5.99, cost_price: 4.1, category: "Bebidas", stock: 24, min_stock: 12, barcode: "7891000000035" },
  { name: "Pao Frances kg", price: 17.9, cost_price: 8.4, category: "Padaria", stock: 12, min_stock: 5, barcode: "7891000000042" },
];

const clients = [
  { name: "Maria Oliveira", phone: "11988001111", credit_limit: 350 },
  { name: "Joao Santos", phone: "11988002222", credit_limit: 220 },
  { name: "Ana Costa", phone: "11988003333", credit_limit: 180 },
];

const toIsoDaysAgo = (days) => new Date(Date.now() - days * 24 * 60 * 60 * 1000).toISOString();

async function findUserByEmail(email) {
  let page = 1;

  while (true) {
    const { data, error } = await supabase.auth.admin.listUsers({ page, perPage: 1000 });
    if (error) throw error;

    const found = data.users.find((user) => user.email?.toLowerCase() === email.toLowerCase());
    if (found) return found;
    if (data.users.length < 1000) return null;

    page += 1;
  }
}

async function ensureUser(account) {
  const existingUser = await findUserByEmail(account.email);

  if (existingUser) {
    const { data, error } = await supabase.auth.admin.updateUserById(existingUser.id, {
      password: demoPassword,
      email_confirm: true,
      user_metadata: {
        role: "admin",
        username: account.email,
      },
    });

    if (error) throw error;
    return data.user;
  }

  const { data, error } = await supabase.auth.admin.createUser({
    email: account.email,
    password: demoPassword,
    email_confirm: true,
    user_metadata: {
      role: "admin",
      username: account.email,
    },
  });

  if (error) throw error;
  return data.user;
}

async function ensureStoreAccount(user, account) {
  const base = {
    owner_user_id: user.id,
    nome_cliente: account.nomeCliente,
    email: account.email,
    telefone: account.telefone,
    cnpj: account.cnpj,
    nome_estabelecimento: account.nomeEstabelecimento,
    tipo_estabelecimento: account.tipoEstabelecimento,
    cep: "01001000",
    endereco: "Praca da Se, Centro, Sao Paulo - SP",
    nome_rua: "Praca da Se",
    numero: "100",
    complemento: "Conta de demonstracao",
    bairro: "Centro",
    cidade: "Sao Paulo",
    estado: "SP",
    product_context: "happycash",
  };

  const { data, error } = await supabase
    .from("store_accounts")
    .upsert(base, { onConflict: "owner_user_id" })
    .select("id")
    .single();

  if (error) throw error;
  return data;
}

async function ensureProfile(user, account) {
  const { error } = await supabase
    .from("profiles")
    .upsert(
      {
        user_id: user.id,
        username: account.email,
        email: account.email,
        role: "admin",
        owner_user_id: user.id,
      },
      { onConflict: "user_id" },
    );

  if (error) throw error;
}

async function ensureSubscription(user, storeAccount, account) {
  const { data: plan, error: planError } = await supabase
    .from("subscription_plans")
    .select("price, currency")
    .eq("id", account.planId)
    .single();

  if (planError) throw planError;

  const now = new Date();
  const endsAt = new Date(now.getTime() + 90 * 24 * 60 * 60 * 1000).toISOString();

  const { error: cancelError } = await supabase
    .from("store_subscriptions")
    .update({
      status: "canceled",
      cancel_at_period_end: false,
      metadata: {
        demo_replaced_at: now.toISOString(),
      },
    })
    .eq("owner_user_id", user.id)
    .eq("product_context", "happycash")
    .in("status", ["trialing", "active", "past_due", "pending"]);

  if (cancelError) throw cancelError;

  const isTrialDemo = account.planId === "demo";

  const { error } = await supabase.from("store_subscriptions").insert({
    store_account_id: storeAccount.id,
    owner_user_id: user.id,
    plan_id: account.planId,
    provider: "manual",
    status: isTrialDemo ? "trialing" : "active",
    billing_type: "PIX",
    price: isTrialDemo ? 0 : plan.price,
    currency: plan.currency || "BRL",
    product_context: "happycash",
    trial_started_at: isTrialDemo ? now.toISOString() : null,
    trial_ends_at: isTrialDemo ? endsAt : null,
    current_period_starts_at: now.toISOString(),
    current_period_ends_at: endsAt,
    external_reference: `demo-${account.planId}-${user.id}`,
    metadata: {
      created_via: "scripts/create-demo-accounts.mjs",
      purpose: "demo_login",
    },
  });

  if (error) throw error;
}

async function clearDemoData(userId) {
  const { data: clientRows, error: clientError } = await supabase
    .from("clients")
    .select("id")
    .eq("user_id", userId);

  if (clientError) throw clientError;

  const clientIds = clientRows.map((client) => client.id);

  if (clientIds.length > 0) {
    const { error: paymentsError } = await supabase.from("payments").delete().in("client_id", clientIds);
    if (paymentsError) throw paymentsError;
  }

  const ownedTables = ["sale_items", "stock_movements", "expenses", "sales", "cash_sessions", "clients", "products"];
  for (const table of ownedTables) {
    const column = table === "cash_sessions" ? "owner_user_id" : table === "sale_items" ? null : "user_id";
    if (!column) continue;

    const { error } = await supabase.from(table).delete().eq(column, userId);
    if (error && error.code !== "42P01") throw error;
  }
}

async function seedDemoData(user, account) {
  await clearDemoData(user.id);

  const { data: productRows, error: productsError } = await supabase
    .from("products")
    .insert(products.map((product) => ({ ...product, user_id: user.id })))
    .select("id, name, price, cost_price");

  if (productsError) throw productsError;

  const productByName = Object.fromEntries(productRows.map((product) => [product.name, product]));

  const { data: clientRows, error: clientsError } = await supabase
    .from("clients")
    .insert(clients.map((client) => ({ ...client, user_id: user.id })))
    .select("id, name");

  if (clientsError) throw clientsError;

  const clientByName = Object.fromEntries(clientRows.map((client) => [client.name, client]));

  const debtRows = [
    { client: "Maria Oliveira", product: "Arroz 5kg", quantity: 1, daysAgo: 6, status: "pending" },
    { client: "Maria Oliveira", product: "Cafe 500g", quantity: 2, daysAgo: 4, status: "pending" },
    { client: "Joao Santos", product: "Leite 1L", quantity: 6, daysAgo: 3, status: "pending" },
    { client: "Ana Costa", product: "Pao Frances kg", quantity: 1, daysAgo: 8, status: "paid" },
  ].map((row) => {
    const product = productByName[row.product];
    return {
      client_id: clientByName[row.client].id,
      product_id: product.id,
      product_name: product.name,
      quantity: row.quantity,
      unit_price: product.price,
      total: Number(product.price) * row.quantity,
      status: row.status,
      date_added: toIsoDaysAgo(row.daysAgo),
      date_paid: row.status === "paid" ? toIsoDaysAgo(1) : null,
      registered_by: "Admin Demo",
    };
  });

  const { error: debtsError } = await supabase.from("debt_entries").insert(debtRows);
  if (debtsError) throw debtsError;

  const { error: paymentError } = await supabase.from("payments").insert([
    {
      client_id: clientByName["Maria Oliveira"].id,
      amount: 20,
      date: toIsoDaysAgo(2),
      type: "partial",
      details: [{ label: "Pagamento parcial para demonstracao", amount: 20 }],
    },
    {
      client_id: clientByName["Ana Costa"].id,
      amount: 17.9,
      date: toIsoDaysAgo(1),
      type: "total",
      details: [{ label: "Quitacao do fiado", amount: 17.9 }],
    },
  ]);

  if (paymentError) throw paymentError;

  if (account.planId !== "fiado") {
    const saleProduct = productByName["Leite 1L"];
    const { data: sale, error: saleError } = await supabase
      .from("sales")
      .insert({
        user_id: user.id,
        client_id: clientByName["Joao Santos"].id,
        total: 35.94,
        discount: 0,
        payment_method: "pix",
        cash_received: 35.94,
        change_amount: 0,
        date: toIsoDaysAgo(1),
        operator_user_id: user.id,
      })
      .select("id")
      .single();

    if (saleError) throw saleError;

    const { error: saleItemError } = await supabase.from("sale_items").insert({
      sale_id: sale.id,
      product_id: saleProduct.id,
      product_name: saleProduct.name,
      quantity: 6,
      unit_price: saleProduct.price,
      cost_price: saleProduct.cost_price,
      total: 35.94,
    });

    if (saleItemError) throw saleItemError;

    const { error: expenseError } = await supabase.from("expenses").insert({
      user_id: user.id,
      description: "Compra de embalagens",
      amount: 42.5,
      category: "Operacional",
      date: toIsoDaysAgo(2),
      operator_user_id: user.id,
    });

    if (expenseError) throw expenseError;
  }

  if (account.planId === "pro") {
    const { error: cashSessionError } = await supabase.from("cash_sessions").insert({
      owner_user_id: user.id,
      operator_user_id: user.id,
      operator_name: "Admin Demo",
      opened_by_name: "Admin Demo",
      opening_amount: 100,
      closed_at: new Date().toISOString(),
      closed_by_user_id: user.id,
      closed_by_name: "Admin Demo",
      closing_balance: 235.94,
      status: "closed",
    });

    if (cashSessionError) throw cashSessionError;
  }
}

for (const account of plans) {
  console.log(`Preparing ${account.planId}: ${account.email}`);
  const user = await ensureUser(account);
  await ensureProfile(user, account);
  const storeAccount = await ensureStoreAccount(user, account);
  await ensureSubscription(user, storeAccount, account);
  await seedDemoData(user, account);
}

console.log("");
console.log("Demo accounts ready:");
for (const account of plans) {
  console.log(`- ${account.planId}: ${account.email}`);
}
console.log(`Password: ${demoPassword}`);
