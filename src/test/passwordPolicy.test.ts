import { describe, expect, it } from "vitest";

import {
  getPasswordPolicyError,
  getPasswordPolicyErrors,
  isStrongPassword,
  passwordPolicyHint,
} from "../../shared/security/passwordPolicy";

describe("passwordPolicy", () => {
  it("accepts a strong password", () => {
    expect(isStrongPassword("Senha@2026")).toBe(true);
    expect(getPasswordPolicyErrors("Senha@2026")).toEqual([]);
  });

  it("rejects weak passwords with helpful messages", () => {
    expect(getPasswordPolicyError("senha")).toBe("A senha deve ter no minimo 10 caracteres.");
    expect(getPasswordPolicyErrors("senha")).toContain(
      "A senha deve ter pelo menos uma letra maiuscula.",
    );
    expect(getPasswordPolicyErrors("senha")).toContain(
      "A senha deve ter pelo menos um numero.",
    );
    expect(getPasswordPolicyErrors("senha")).toContain(
      "A senha deve ter pelo menos um simbolo.",
    );
  });

  it("exposes a user-facing hint", () => {
    expect(passwordPolicyHint).toContain("10 caracteres");
  });
});
