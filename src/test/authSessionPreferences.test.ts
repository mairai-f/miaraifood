import { beforeEach, describe, expect, it } from "vitest";

import {
  getSystemLoginPreferences,
  saveSystemLoginPreferences,
} from "@/lib/authSessionPreferences";

describe("authSessionPreferences", () => {
  beforeEach(() => {
    window.localStorage.clear();
    window.sessionStorage.clear();
  });

  it("restores the last login mode without hydrating auth fields", () => {
    window.localStorage.setItem("happycash:system:last-login-mode", "operator");
    window.localStorage.setItem("happycash:system:remember-account", "1");
    window.localStorage.setItem("happycash:system:keep-connected", "1");
    window.localStorage.setItem("happycash:system:remembered-admin-email", "admin@loja.test");
    window.localStorage.setItem("happycash:system:remembered-operator-username", "caixa.memoria");

    expect(getSystemLoginPreferences()).toEqual({
      loginMode: "operator",
      rememberAccount: false,
      keepConnected: false,
      adminEmail: "",
      operatorUsername: "",
    });
  });

  it("still records preferences from an explicit submit", () => {
    saveSystemLoginPreferences({
      loginMode: "admin",
      rememberAccount: true,
      keepConnected: true,
      adminEmail: " admin@loja.test ",
      operatorUsername: " caixa ",
    });

    expect(window.localStorage.getItem("happycash:system:last-login-mode")).toBe("admin");
    expect(window.localStorage.getItem("happycash:system:remember-account")).toBe("1");
    expect(window.localStorage.getItem("happycash:system:keep-connected")).toBe("1");
    expect(window.localStorage.getItem("happycash:system:remembered-admin-email")).toBe("admin@loja.test");
    expect(window.localStorage.getItem("happycash:system:remembered-operator-username")).toBe("caixa");
  });
});
