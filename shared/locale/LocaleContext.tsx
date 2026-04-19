import { useEffect, useMemo, useRef, useState, type ReactNode } from "react";

import { localeStorageKey, resolveLocale, translateTextValue, type Locale } from "./localeTranslations";
import { LocaleContext, type LocaleContextValue } from "./locale-context";

const textNodeOrigins = new WeakMap<Text, string>();
const attributeOrigins = new WeakMap<Element, Map<string, string>>();
const translatableAttributes = ["placeholder", "aria-label", "title", "alt"] as const;

const readInitialLocale = (): Locale => {
  if (typeof window === "undefined") return "pt-BR";

  const storedLocale = window.localStorage.getItem(localeStorageKey);
  if (storedLocale) {
    return resolveLocale(storedLocale);
  }

  const preferredLanguage = window.navigator.languages?.[0] ?? window.navigator.language;
  return resolveLocale(preferredLanguage);
};

const shouldTranslateTextNode = (node: Text) => {
  if (!node.textContent?.trim()) return false;

  const parent = node.parentElement;
  if (!parent) return false;
  if (parent.closest("[data-i18n-ignore='true']")) return false;

  return !["SCRIPT", "STYLE", "NOSCRIPT", "TEXTAREA"].includes(parent.tagName);
};

const applyTranslations = (root: ParentNode, locale: Locale) => {
  const walker = document.createTreeWalker(root, NodeFilter.SHOW_TEXT);
  const textNodes: Text[] = [];
  let currentNode = walker.nextNode();

  while (currentNode) {
    if (currentNode instanceof Text && shouldTranslateTextNode(currentNode)) {
      textNodes.push(currentNode);
    }
    currentNode = walker.nextNode();
  }

  for (const textNode of textNodes) {
    const originalText = textNodeOrigins.get(textNode) ?? textNode.textContent ?? "";
    if (!textNodeOrigins.has(textNode)) {
      textNodeOrigins.set(textNode, originalText);
    }

    const translatedText = translateTextValue(originalText, locale);
    if (textNode.textContent !== translatedText) {
      textNode.textContent = translatedText;
    }
  }

  if (!(root instanceof Element || root instanceof Document)) return;

  const elements =
    root instanceof Document
      ? root.querySelectorAll<HTMLElement>("[placeholder], [aria-label], [title], img[alt]")
      : root.matches?.("[placeholder], [aria-label], [title], img[alt]")
        ? [root as HTMLElement]
        : root.querySelectorAll<HTMLElement>("[placeholder], [aria-label], [title], img[alt]");

  for (const element of elements) {
    if (element.closest("[data-i18n-ignore='true']")) continue;

    const originalAttributes = attributeOrigins.get(element) ?? new Map<string, string>();
    attributeOrigins.set(element, originalAttributes);

    for (const attributeName of translatableAttributes) {
      const currentValue = element.getAttribute(attributeName);
      if (!currentValue) continue;

      const originalValue = originalAttributes.get(attributeName) ?? currentValue;
      if (!originalAttributes.has(attributeName)) {
        originalAttributes.set(attributeName, originalValue);
      }

      const translatedValue = translateTextValue(originalValue, locale);
      if (currentValue !== translatedValue) {
        element.setAttribute(attributeName, translatedValue);
      }
    }
  }
};

export function LocaleProvider({ children }: { children: ReactNode }) {
  const [locale, setLocale] = useState<Locale>(readInitialLocale);
  const applyingRef = useRef(false);

  useEffect(() => {
    if (typeof window === "undefined") return;

    window.localStorage.setItem(localeStorageKey, locale);
    document.documentElement.lang = locale;
    document.documentElement.dataset.locale = locale;

    if (!document.body) return;

    let frameId = 0;

    const runTranslations = (root: ParentNode = document.body) => {
      if (applyingRef.current) return;
      applyingRef.current = true;
      applyTranslations(root, locale);
      applyingRef.current = false;
    };

    runTranslations(document.body);

    const observer = new MutationObserver((mutations) => {
      if (applyingRef.current) return;

      cancelAnimationFrame(frameId);
      frameId = window.requestAnimationFrame(() => {
        for (const mutation of mutations) {
          if (mutation.type === "childList") {
            mutation.addedNodes.forEach((node) => {
              if (node instanceof HTMLElement || node instanceof DocumentFragment) {
                runTranslations(node);
              } else if (node instanceof Text && node.parentNode) {
                runTranslations(node.parentNode);
              }
            });
          }

          if (mutation.type === "characterData" && mutation.target.parentNode) {
            runTranslations(mutation.target.parentNode);
          }

          if (mutation.type === "attributes" && mutation.target instanceof HTMLElement) {
            runTranslations(mutation.target);
          }
        }
      });
    });

    observer.observe(document.body, {
      subtree: true,
      childList: true,
      characterData: true,
      attributes: true,
      attributeFilter: [...translatableAttributes],
    });

    return () => {
      cancelAnimationFrame(frameId);
      observer.disconnect();
    };
  }, [locale]);

  const value = useMemo<LocaleContextValue>(() => ({
    locale,
    setLocale,
    toggleLocale: () => setLocale((currentLocale) => (currentLocale === "pt-BR" ? "en" : "pt-BR")),
  }), [locale]);

  return <LocaleContext.Provider value={value}>{children}</LocaleContext.Provider>;
}
