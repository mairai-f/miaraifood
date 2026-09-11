import { fireEvent, render, screen } from "@testing-library/react";
import { beforeEach, describe, expect, it, vi } from "vitest";

import { LocaleProvider } from "../../shared/locale/LocaleContext";
import { LocaleGatewayModal } from "../../shared/locale/LocaleGatewayModal";
import { formatCurrency, getCurrencyFractionDigits, getFormatLocale } from "../../shared/locale/format";
import { translateTextValue } from "../../shared/locale/localeTranslations";
import {
  getFormatLocaleFor,
  localeChoiceStorageKey,
  localeStorageKey,
  resolveLocale,
} from "../../shared/locale/locales";
import { compareText, foldForSearch, matchesSearch } from "../../shared/locale/text";

beforeEach(() => {
  window.localStorage.clear();
});

describe("resolveLocale", () => {
  it("casa a tag completa e depois o idioma base", () => {
    expect(resolveLocale("pt-BR")).toBe("pt-BR");
    expect(resolveLocale("pt-PT")).toBe("pt-BR");
    expect(resolveLocale("EN-us")).toBe("en");
    expect(resolveLocale("es-AR")).toBe("es");
    expect(resolveLocale("es_PY")).toBe("es");
    expect(resolveLocale("gn-PY")).toBe("gn");
  });

  it("cai no portugues para idioma nao suportado ou vazio", () => {
    expect(resolveLocale("fr-FR")).toBe("pt-BR");
    expect(resolveLocale("")).toBe("pt-BR");
    expect(resolveLocale(null)).toBe("pt-BR");
  });
});

describe("formatLocale", () => {
  it("usa um locale que o Intl realmente suporta para o guarani", () => {
    expect(Intl.NumberFormat.supportedLocalesOf(["gn"])).toEqual([]);
    expect(getFormatLocaleFor("gn")).toBe("es-PY");
    expect(Intl.NumberFormat.supportedLocalesOf([getFormatLocaleFor("gn")])).toEqual(["es-PY"]);
  });

  it("formata moeda com o formatLocale do idioma salvo", () => {
    window.localStorage.setItem(localeStorageKey, "gn");

    expect(getFormatLocale()).toBe("es-PY");
    expect(formatCurrency(1234.5, "PYG")).toBe(
      new Intl.NumberFormat("es-PY", { style: "currency", currency: "PYG" }).format(1234.5),
    );
  });

  it("respeita as casas decimais reais de cada moeda", () => {
    expect(getCurrencyFractionDigits("PYG")).toBe(0);
    expect(getCurrencyFractionDigits("BRL")).toBe(2);
  });
});

describe("foldForSearch", () => {
  it("preserva o til do guarani, que e fonemico", () => {
    expect(foldForSearch("G̃uahu", "gn")).toBe("g̃uahu");
    expect(foldForSearch("Tetã", "gn")).toBe("tetã");
  });

  it("remove todos os acentos em portugues", () => {
    expect(foldForSearch("Ação", "pt-BR")).toBe("acao");
    expect(foldForSearch("G̃uahu", "pt-BR")).toBe("guahu");
  });

  it("unifica as variantes de apostrofo do puso", () => {
    expect(foldForSearch("ñe’ẽ", "gn")).toBe(foldForSearch("ñe'ẽ", "gn"));
    expect(matchesSearch("Avañe’ẽ", "avañe'ẽ", "gn")).toBe(true);
  });

  it("nao confunde vogal nasal com oral em guarani", () => {
    expect(matchesSearch("tetã", "teta", "gn")).toBe(false);
    expect(matchesSearch("tetã", "teta", "pt-BR")).toBe(true);
  });
});

describe("compareText", () => {
  it("ordena com collator numerico do idioma", () => {
    expect(["Mesa 10", "Mesa 2", "Mesa 1"].sort((a, b) => compareText(a, b, "es"))).toEqual([
      "Mesa 1",
      "Mesa 2",
      "Mesa 10",
    ]);
  });
});

describe("translateTextValue", () => {
  it("traduz para os idiomas com catalogo e preserva espacos das bordas", () => {
    expect(translateTextValue("  Painel ", "es")).toBe("  Panel ");
    expect(translateTextValue("Painel", "en")).toBe("Dashboard");
  });

  it("cai no texto original quando nao ha traducao", () => {
    expect(translateTextValue("Painel", "gn")).toBe("Painel");
    expect(translateTextValue("Texto que nao existe no catalogo", "es")).toBe("Texto que nao existe no catalogo");
    expect(translateTextValue("Painel", "pt-BR")).toBe("Painel");
  });
});

describe("LocaleGatewayModal", () => {
  it("lista os quatro idiomas, aplica a selecao na hora e grava a escolha ao confirmar", () => {
    const onDone = vi.fn();

    render(
      <LocaleProvider>
        <LocaleGatewayModal onDone={onDone} />
      </LocaleProvider>,
    );

    for (const name of ["Português", "English", "Español", "Avañe'ẽ"]) {
      expect(screen.getByText(name)).toBeInTheDocument();
    }

    fireEvent.click(screen.getByText("Español"));
    expect(screen.getByRole("heading", { name: "Seleccioná tu idioma" })).toBeInTheDocument();
    expect(window.localStorage.getItem(localeStorageKey)).toBe("es");
    expect(window.localStorage.getItem(localeChoiceStorageKey)).toBeNull();

    fireEvent.click(screen.getByRole("button", { name: "Continuar" }));
    expect(window.localStorage.getItem(localeChoiceStorageKey)).toBe("1");
    expect(onDone).toHaveBeenCalledOnce();
  });

  it("avisa que o guarani ainda cai em portugues", () => {
    render(
      <LocaleProvider>
        <LocaleGatewayModal />
      </LocaleProvider>,
    );

    fireEvent.click(screen.getByText("Avañe'ẽ"));
    expect(screen.getByText(/Ojejapohína traducción/)).toBeInTheDocument();
  });
});
