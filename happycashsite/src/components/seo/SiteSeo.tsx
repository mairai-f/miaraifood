import { useEffect } from "react";
import { useLocation } from "react-router-dom";

import { createSiteUrl, resolveSeoImage, type SiteSeoConfig } from "@/lib/siteSeo";

const upsertMetaTag = (
  selector: string,
  attributes: Record<string, string>,
  content: string,
) => {
  let element = document.head.querySelector(selector) as HTMLMetaElement | null;

  if (!element) {
    element = document.createElement("meta");
    Object.entries(attributes).forEach(([key, value]) => element?.setAttribute(key, value));
    document.head.appendChild(element);
  }

  element.setAttribute("content", content);
};

const upsertLinkTag = (rel: string, href: string) => {
  let element = document.head.querySelector(`link[rel="${rel}"]`) as HTMLLinkElement | null;

  if (!element) {
    element = document.createElement("link");
    element.setAttribute("rel", rel);
    document.head.appendChild(element);
  }

  element.setAttribute("href", href);
};

const SiteSeo = ({
  title,
  description,
  path,
  image,
  keywords = [],
  noindex = false,
  type = "website",
}: SiteSeoConfig) => {
  const location = useLocation();
  const keywordsContent = keywords.join(", ");

  useEffect(() => {
    const currentPath = path ?? location.pathname;
    const canonicalUrl = createSiteUrl(currentPath);
    const imageUrl = resolveSeoImage(image);
    const robotsContent = noindex ? "noindex, nofollow" : "index, follow, max-image-preview:large";

    document.title = title;
    document.documentElement.lang = "pt-BR";

    upsertMetaTag('meta[name="description"]', { name: "description" }, description);
    upsertMetaTag('meta[name="keywords"]', { name: "keywords" }, keywordsContent);
    upsertMetaTag('meta[name="robots"]', { name: "robots" }, robotsContent);
    upsertMetaTag('meta[property="og:title"]', { property: "og:title" }, title);
    upsertMetaTag('meta[property="og:description"]', { property: "og:description" }, description);
    upsertMetaTag('meta[property="og:type"]', { property: "og:type" }, type);
    upsertMetaTag('meta[property="og:url"]', { property: "og:url" }, canonicalUrl);
    upsertMetaTag('meta[property="og:image"]', { property: "og:image" }, imageUrl);
    upsertMetaTag('meta[property="og:site_name"]', { property: "og:site_name" }, "HappyCash");
    upsertMetaTag('meta[name="twitter:card"]', { name: "twitter:card" }, "summary_large_image");
    upsertMetaTag('meta[name="twitter:title"]', { name: "twitter:title" }, title);
    upsertMetaTag('meta[name="twitter:description"]', { name: "twitter:description" }, description);
    upsertMetaTag('meta[name="twitter:image"]', { name: "twitter:image" }, imageUrl);
    upsertLinkTag("canonical", canonicalUrl);
  }, [description, image, keywordsContent, location.pathname, noindex, path, title, type]);

  return null;
};

export default SiteSeo;
