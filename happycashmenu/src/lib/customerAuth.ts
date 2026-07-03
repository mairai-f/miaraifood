import { menuCustomerSupabase } from "@/lib/supabase";
import type { CustomerInfo } from "@/types";
import { getPublicErrorMessage } from "../../../shared/security/redaction";
import { requestTurnstileToken } from "../../../shared/security/turnstile";

export type MenuCustomerAccount = {
  email: string;
  customer: CustomerInfo;
};

type CustomerProfileRow = {
  email: string | null;
  name: string | null;
  phone: string | null;
  address: string | null;
  number: string | null;
  complement: string | null;
  neighborhood: string | null;
  city: string | null;
  state: string | null;
};

const normalizeEmail = (value: string) => value.trim().toLowerCase();
const isUuid = (value: string) =>
  /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(value);

const mergeCustomerProfile = (
  current: CustomerInfo,
  email: string,
  profile?: CustomerProfileRow | null,
): MenuCustomerAccount => ({
  email,
  customer: {
    ...current,
    name: profile?.name || current.name,
    phone: profile?.phone || current.phone,
    address: profile?.address || current.address,
    number: profile?.number || current.number,
    complement: profile?.complement || current.complement,
    neighborhood: profile?.neighborhood || current.neighborhood,
    city: profile?.city || current.city,
    state: profile?.state || current.state,
    loyaltyOptIn: true,
  },
});

export const getMenuCustomerSession = async (storeAccountId: string, current: CustomerInfo) => {
  const { data: sessionData } = await menuCustomerSupabase.auth.getSession();
  const email = sessionData.session?.user.email;
  if (!sessionData.session?.user || !email) return null;
  if (!isUuid(storeAccountId)) return mergeCustomerProfile(current, email, null);

  const { data: profile } = await menuCustomerSupabase
    .from("restaurant_menu_customers")
    .select("email, name, phone, address, number, complement, neighborhood, city, state")
    .eq("store_account_id", storeAccountId)
    .eq("auth_user_id", sessionData.session.user.id)
    .maybeSingle<CustomerProfileRow>();

  return mergeCustomerProfile(current, email, profile);
};

export const signInMenuCustomer = async (
  storeAccountId: string,
  email: string,
  password: string,
  current: CustomerInfo,
) => {
  const normalizedEmail = normalizeEmail(email);
  const captchaToken = await requestTurnstileToken("menu-customer-login");
  const { data, error } = await menuCustomerSupabase.auth.signInWithPassword({
    email: normalizedEmail,
    password,
    options: { captchaToken },
  });

  if (error || !data.user) {
    throw new Error(getPublicErrorMessage(error, "Email ou senha invalidos."));
  }

  return getMenuCustomerSession(storeAccountId, current);
};

export const signUpMenuCustomer = async (
  storeAccountId: string,
  email: string,
  password: string,
  customer: CustomerInfo,
) => {
  const normalizedEmail = normalizeEmail(email);
  const captchaToken = await requestTurnstileToken("menu-customer-signup");
  const { data, error } = await menuCustomerSupabase.auth.signUp({
    email: normalizedEmail,
    password,
    options: {
      captchaToken,
      data: {
        name: customer.name.trim(),
        phone: customer.phone.trim(),
        product_context: "happycashmenu",
      },
    },
  });

  if (error) {
    throw new Error(getPublicErrorMessage(error, "Nao foi possivel criar a conta."));
  }

  if (data.user && data.session) {
    await upsertMenuCustomerProfile(storeAccountId, normalizedEmail, customer);
    return getMenuCustomerSession(storeAccountId, customer);
  }

  return {
    email: normalizedEmail,
    customer: {
      ...customer,
      loyaltyOptIn: true,
    },
    needsEmailConfirmation: true,
  };
};

export const upsertMenuCustomerProfile = async (
  storeAccountId: string,
  email: string,
  customer: CustomerInfo,
) => {
  const { data: sessionData } = await menuCustomerSupabase.auth.getSession();
  if (!sessionData.session?.user) return;
  if (!isUuid(storeAccountId)) return;

  const { error } = await menuCustomerSupabase
    .from("restaurant_menu_customers")
    .upsert({
      auth_user_id: sessionData.session.user.id,
      store_account_id: storeAccountId,
      email: normalizeEmail(email || sessionData.session.user.email || ""),
      name: customer.name.trim(),
      phone: customer.phone.trim(),
      address: customer.address.trim(),
      number: customer.number.trim(),
      complement: customer.complement.trim(),
      neighborhood: customer.neighborhood.trim(),
      city: customer.city.trim(),
      state: customer.state.trim().toUpperCase().slice(0, 2),
    }, {
      onConflict: "auth_user_id,store_account_id",
    });

  if (error) {
    throw new Error(getPublicErrorMessage(error, "Nao foi possivel salvar seu cadastro."));
  }
};

export const signOutMenuCustomer = async () => {
  await menuCustomerSupabase.auth.signOut();
};
