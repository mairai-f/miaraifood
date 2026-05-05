import { createClient } from "npm:@supabase/supabase-js@2";

interface DesktopLicenseSubscriptionRow {
  id: string;
  owner_user_id: string;
  plan_id: string;
  status: string;
  current_period_ends_at: string | null;
}

export interface DesktopLicenseKeyResult {
  licenseKey: string;
  keyHash: string;
  keyPrefix: string;
  keySuffix: string;
}

const encoder = new TextEncoder();

const bytesToHex = (bytes: ArrayBuffer) =>
  [...new Uint8Array(bytes)]
    .map((byte) => byte.toString(16).padStart(2, "0"))
    .join("");

const chunkKey = (value: string) =>
  value.match(/.{1,4}/g)?.join("-") ?? value;

const getLicenseSecret = () =>
  Deno.env.get("DESKTOP_LICENSE_SECRET")
  || Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")
  || "happycash-desktop-license-development-secret";

export const hashDesktopLicenseKey = async (licenseKey: string) => {
  const digest = await crypto.subtle.digest("SHA-256", encoder.encode(licenseKey));
  return bytesToHex(digest);
};

export const generateDesktopLicenseKey = async (
  subscription: DesktopLicenseSubscriptionRow,
): Promise<DesktopLicenseKeyResult> => {
  const secretKey = await crypto.subtle.importKey(
    "raw",
    encoder.encode(getLicenseSecret()),
    { name: "HMAC", hash: "SHA-256" },
    false,
    ["sign"],
  );

  const payload = [
    "happycash-pro-offline",
    subscription.id,
    subscription.owner_user_id,
    subscription.plan_id,
    subscription.current_period_ends_at ?? "",
  ].join(":");

  const signature = await crypto.subtle.sign("HMAC", secretKey, encoder.encode(payload));
  const token = bytesToHex(signature).slice(0, 20).toUpperCase();
  const licenseKey = `HC-PRO-${chunkKey(token)}`;
  const keyHash = await hashDesktopLicenseKey(licenseKey);

  return {
    licenseKey,
    keyHash,
    keyPrefix: "HC-PRO",
    keySuffix: licenseKey.slice(-4),
  };
};

export const upsertDesktopLicenseKey = async (
  serviceClient: ReturnType<typeof createClient>,
  subscription: DesktopLicenseSubscriptionRow,
) => {
  const generated = await generateDesktopLicenseKey(subscription);

  await serviceClient
    .from("desktop_license_keys")
    .upsert({
      owner_user_id: subscription.owner_user_id,
      subscription_id: subscription.id,
      key_hash: generated.keyHash,
      key_prefix: generated.keyPrefix,
      key_suffix: generated.keySuffix,
      status: "active",
      issued_at: new Date().toISOString(),
      revoked_at: null,
    }, {
      onConflict: "subscription_id",
    });

  return generated;
};
