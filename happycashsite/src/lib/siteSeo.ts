export const SITE_ORIGIN = "https://happycashsite.vercel.app";

export interface SiteSeoConfig {
  title: string;
  description: string;
  path?: string;
  image?: string;
  keywords?: string[];
  noindex?: boolean;
  type?: "website" | "article";
  jsonLd?: Record<string, unknown> | Record<string, unknown>[];
}

export const createSiteUrl = (path = "/") => new URL(path, SITE_ORIGIN).toString();

export const resolveSeoImage = (value?: string) => {
  if (!value) return createSiteUrl("/favicon.png");
  if (/^https?:\/\//i.test(value)) return value;

  return new URL(value, SITE_ORIGIN).toString();
};
