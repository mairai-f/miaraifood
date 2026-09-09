import js from "@eslint/js";
import globals from "globals";
import reactHooks from "eslint-plugin-react-hooks";
import reactRefresh from "eslint-plugin-react-refresh";
import tseslint from "typescript-eslint";

export default tseslint.config(
  {
    // Saída de build e apps com ciclo próprio. O site Next mantém o próprio
    // lint; "happycashsite" virou "miaraifoodsite" no rebrand.
    ignores: [
      "**/node_modules",
      "**/dist",
      "**/build",
      "**/.next",
      "dist-site",
      "miaraifoodsite",
      "mobile",
      "release",
      "release-builds",
      "garçomtelas",
    ],
  },
  {
    extends: [js.configs.recommended, ...tseslint.configs.recommended],
    files: ["**/*.{ts,tsx}"],
    languageOptions: {
      ecmaVersion: 2020,
      globals: globals.browser,
    },
    plugins: {
      "react-hooks": reactHooks,
      "react-refresh": reactRefresh,
    },
    rules: {
      ...reactHooks.configs.recommended.rules,
      "react-refresh/only-export-components": ["warn", { allowConstantExport: true }],
      "@typescript-eslint/no-unused-vars": "off",
    },
  },
);
