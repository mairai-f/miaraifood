// Os nomes HAPPYCASH_* permanecem apenas para não invalidar secrets já
// configurados. A marca exibida e os novos secrets usam MIAR AI/FOOD.
export const HAPPYCASH_DEFAULT_FROM_EMAIL = Deno.env.get("MIAR_FROM_EMAIL")?.trim()
  || "MIAR AI/FOOD <no-reply@miaraifood.com.br>";
export const HAPPYCASH_SUPPORT_EMAIL = Deno.env.get("MIAR_SUPPORT_EMAIL")?.trim()
  || "suporte@miaraifood.com.br";
export const HAPPYCASH_BRAND_LOGO_URL = Deno.env.get("MIAR_BRAND_LOGO_URL")?.trim()
  || "https://www.miaraifood.com.br/miar-logo-white.svg";
export const HAPPYCASH_BRAND_FAVICON_URL = Deno.env.get("MIAR_BRAND_FAVICON_URL")?.trim()
  || "https://www.miaraifood.com.br/miafavico.svg";

export const escapeHtml = (value: string | number | null | undefined) =>
  String(value ?? "")
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll('"', "&quot;")
    .replaceAll("'", "&#39;");

export const normalizeEmailRecipients = (values: unknown) => {
  const rawValues = Array.isArray(values)
    ? values
    : typeof values === "string"
      ? [values]
      : [];

  return Array.from(new Set(
    rawValues
      .filter((value): value is string => typeof value === "string")
      .flatMap((value) => value.split(/[,\n;]/))
      .map((value) => value.trim())
      .filter(Boolean),
  ));
};

export const isValidEmailRecipient = (value: string) =>
  /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(value);

export const getHappyCashFromEmail = (...envNames: string[]) => {
  for (const envName of envNames) {
    const value = Deno.env.get(envName)?.trim();
    if (value) return value;
  }

  return Deno.env.get("HAPPYCASH_FROM_EMAIL")?.trim() || HAPPYCASH_DEFAULT_FROM_EMAIL;
};

type Metric = {
  label: string;
  value: string;
  tone?: "default" | "primary" | "success" | "danger";
};

type Action = {
  label: string;
  href: string;
};

type HappyCashEmailOptions = {
  eyebrow?: string;
  title: string;
  preview?: string;
  intro?: string;
  metrics?: Metric[];
  action?: Action;
  contentHtml?: string;
  footerNote?: string;
};

const metricColor = (tone: Metric["tone"] = "default") => {
  switch (tone) {
    case "primary":
      return "#1f5ca3";
    case "success":
      return "#159947";
    case "danger":
      return "#dc2626";
    default:
      return "#14213d";
  }
};

export const renderHappyCashEmail = ({
  eyebrow = "MIAR AI/FOOD",
  title,
  preview,
  intro,
  metrics = [],
  action,
  contentHtml = "",
  footerNote = "Se você não reconhece esta mensagem, ignore este e-mail ou fale com o suporte MIAR AI/FOOD.",
}: HappyCashEmailOptions) => {
  const metricsHtml = metrics.length > 0
    ? `
      <table role="presentation" width="100%" cellspacing="0" cellpadding="0" style="margin:24px 0 4px;">
        <tr>
          ${metrics.map((metric) => `
            <td style="width:${100 / metrics.length}%;padding:6px;" valign="top">
              <div style="border:1px solid #d8e2ef;border-radius:14px;background:#f8fbff;padding:14px;">
                <p style="margin:0 0 8px;font-size:12px;line-height:18px;color:#5b6b83;">${escapeHtml(metric.label)}</p>
                <p style="margin:0;font-size:18px;line-height:24px;font-weight:800;color:${metricColor(metric.tone)};">${escapeHtml(metric.value)}</p>
              </div>
            </td>
          `).join("")}
        </tr>
      </table>
    `
    : "";

  const actionHtml = action
    ? `
      <table role="presentation" cellspacing="0" cellpadding="0" style="margin:28px 0;">
        <tr>
          <td style="border-radius:12px;background:#1f5ca3;">
            <a href="${escapeHtml(action.href)}" style="display:inline-block;padding:14px 22px;color:#ffffff;text-decoration:none;font-size:15px;line-height:20px;font-weight:800;">
              ${escapeHtml(action.label)}
            </a>
          </td>
        </tr>
      </table>
    `
    : "";

  return `
    <!doctype html>
    <html lang="pt-BR">
      <head>
        <meta charset="utf-8">
        <meta name="viewport" content="width=device-width, initial-scale=1">
        <meta name="color-scheme" content="light">
        <title>${escapeHtml(title)}</title>
      </head>
      <body style="margin:0;padding:0;background:#eef4fb;font-family:Inter,Segoe UI,Arial,sans-serif;color:#14213d;">
        ${preview ? `<div style="display:none;max-height:0;overflow:hidden;opacity:0;color:transparent;">${escapeHtml(preview)}</div>` : ""}
        <table role="presentation" width="100%" cellspacing="0" cellpadding="0" style="background:#eef4fb;">
          <tr>
            <td align="center" style="padding:28px 12px;">
              <table role="presentation" width="100%" cellspacing="0" cellpadding="0" style="max-width:680px;background:#ffffff;border:1px solid #d8e2ef;border-radius:22px;overflow:hidden;">
                <tr>
                  <td style="padding:28px 30px;background:#14213d;">
                    <table role="presentation" width="100%" cellspacing="0" cellpadding="0">
                      <tr>
                        <td>
                          <img src="${HAPPYCASH_BRAND_LOGO_URL}" width="150" alt="MIAR AI/FOOD" style="display:block;width:150px;max-width:150px;height:auto;border:0;outline:none;text-decoration:none;">
                          <p style="margin:8px 0 0;color:#ffffff;font-size:18px;line-height:24px;font-weight:900;letter-spacing:0;">MIAR <span style="color:#70e000;">AI/FOOD</span></p>
                          <p style="margin:8px 0 0;color:#b9c9df;font-size:13px;line-height:19px;font-weight:600;">Ecossistema para food service</p>
                        </td>
                        <td align="right" style="width:56px;">
                          <img src="${HAPPYCASH_BRAND_FAVICON_URL}" width="44" height="44" alt="" style="display:inline-block;width:44px;height:44px;border:0;border-radius:14px;background:#ffffff;outline:none;text-decoration:none;">
                        </td>
                      </tr>
                    </table>
                  </td>
                </tr>
                <tr>
                  <td style="padding:30px;">
                    <p style="margin:0 0 10px;color:#1f5ca3;font-size:12px;line-height:18px;font-weight:900;letter-spacing:0.12em;text-transform:uppercase;">${escapeHtml(eyebrow)}</p>
                    <h1 style="margin:0;color:#14213d;font-size:28px;line-height:34px;font-weight:900;">${escapeHtml(title)}</h1>
                    ${intro ? `<p style="margin:16px 0 0;color:#42526a;font-size:15px;line-height:24px;">${escapeHtml(intro)}</p>` : ""}
                    ${metricsHtml}
                    ${actionHtml}
                    ${contentHtml}
                  </td>
                </tr>
                <tr>
                  <td style="padding:20px 30px;background:#f8fbff;border-top:1px solid #d8e2ef;">
                    <p style="margin:0;color:#5b6b83;font-size:12px;line-height:20px;">${escapeHtml(footerNote)}</p>
                    <p style="margin:10px 0 0;color:#5b6b83;font-size:12px;line-height:20px;">Suporte: <a href="mailto:${HAPPYCASH_SUPPORT_EMAIL}" style="color:#1f5ca3;text-decoration:none;">${HAPPYCASH_SUPPORT_EMAIL}</a></p>
                  </td>
                </tr>
              </table>
            </td>
          </tr>
        </table>
      </body>
    </html>
  `;
};

type SendHappyCashEmailOptions = {
  from?: string;
  to: string[];
  subject: string;
  html: string;
  text: string;
  attachments?: Array<{
    filename: string;
    content: string;
  }>;
};

export const encodeTextAttachment = (value: string) => {
  const bytes = new TextEncoder().encode(value);
  let binary = "";

  for (const byte of bytes) {
    binary += String.fromCharCode(byte);
  }

  return btoa(binary);
};

export const sendHappyCashEmail = async ({ from, to, subject, html, text, attachments }: SendHappyCashEmailOptions) => {
  const resendApiKey = Deno.env.get("RESEND_API_KEY")?.trim();

  if (!resendApiKey) {
    throw new Error("Configure o secret RESEND_API_KEY para enviar e-mails pelo Resend.");
  }

  const response = await fetch("https://api.resend.com/emails", {
    method: "POST",
    headers: {
      Authorization: `Bearer ${resendApiKey}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify({
      from: from || getHappyCashFromEmail(),
      to,
      subject,
      html,
      text,
      ...(attachments?.length ? { attachments } : {}),
    }),
  });

  if (!response.ok) {
    const payload = await response.text().catch(() => "");
    console.error("Erro ao enviar e-mail pelo Resend:", payload);
    throw new Error("O Resend recusou o envio do e-mail.");
  }

  return await response.json().catch(() => ({}));
};
