#!/usr/bin/env node
import { execFileSync } from "node:child_process";
import { existsSync, readFileSync } from "node:fs";
import { join } from "node:path";

const root = process.cwd();
const findings = [];

const add = (level, message, details = "") => findings.push({ level, message, details });
const git = (...args) => execFileSync("git", args, { cwd: root, encoding: "utf8" }).trim();

const trackedFiles = git("ls-files").split("\n").filter(Boolean);
const trackedEnvFiles = trackedFiles.filter((file) => /(^|\/)\.env(\.|$)/.test(file) && !/\.env\.example$|\.env\.sample$/.test(file));
if (trackedEnvFiles.length) {
  add("FAIL", "Arquivos de ambiente reais estao versionados.", trackedEnvFiles.join(", "));
} else {
  add("PASS", "Nenhum .env real esta versionado.");
}

const browserFilePattern = /^(src|happycashagenda\/src|happycashfood\/src|happycashsite\/src|happycashmenu\/src|mobile)\//;
const serviceRoleInBrowser = trackedFiles
  .filter((file) => browserFilePattern.test(file))
  .filter((file) => readFileSync(join(root, file), "utf8").includes("SUPABASE_SERVICE_ROLE_KEY"));
if (serviceRoleInBrowser.length) {
  add("FAIL", "SUPABASE_SERVICE_ROLE_KEY aparece em codigo de cliente.", serviceRoleInBrowser.join(", "));
} else {
  add("PASS", "Service role key nao aparece em codigo de cliente.");
}

const textFilePattern = /\.(cjs|css|html|js|json|jsx|md|mjs|sql|toml|ts|tsx|txt|yml|yaml)$/;
const viteSecretPattern = /VITE_[A-Z0-9_]*(SECRET|SERVICE_ROLE|TOKEN|PRIVATE|PASSWORD)([A-Z0-9_]*)/i;
const viteSecretMentions = trackedFiles
  .filter((file) => textFilePattern.test(file) && !file.endsWith("package-lock.json") && existsSync(join(root, file)))
  .filter((file) => viteSecretPattern.test(readFileSync(join(root, file), "utf8")));
if (viteSecretMentions.length) {
  add("WARN", "Possiveis secrets com prefixo VITE_ foram encontrados.", viteSecretMentions.join(", "));
} else {
  add("PASS", "Nenhum secret obvio com prefixo VITE_ encontrado.");
}

const configPath = join(root, "supabase/config.toml");
if (existsSync(configPath)) {
  const config = readFileSync(configPath, "utf8");
  const functionMatches = [...config.matchAll(/\[functions\.([^\]]+)\]\s+verify_jwt\s*=\s*(true|false)/g)];
  const disabled = functionMatches.filter(([, , value]) => value === "false").map(([, name]) => name);
  const protectedPatterns = [
    "ACTIVATE_PLAN_DISABLED",
    "auth.getUser",
    "ASAAS_WEBHOOK_AUTH_TOKEN",
    "x-cron-secret",
    "checkRedisRateLimit",
    "logAttempt",
    "Authorization",
  ];

  const weak = disabled.filter((name) => {
    const file = join(root, "supabase/functions", name, "index.ts");
    if (!existsSync(file)) return false;
    const source = readFileSync(file, "utf8");
    return !protectedPatterns.some((pattern) => source.includes(pattern));
  });

  if (disabled.length) {
    add("WARN", `${disabled.length} Edge Functions estao com verify_jwt=false.`, disabled.join(", "));
  }

  if (weak.length) {
    add("WARN", "Functions publicas sem protecao obvia detectada pelo scanner.", weak.join(", "));
  } else if (disabled.length) {
    add("PASS", "Functions publicas tem algum controle local detectavel pelo scanner.");
  }
}

const corsPath = join(root, "supabase/functions/_shared/cors.ts");
if (existsSync(corsPath)) {
  const cors = readFileSync(corsPath, "utf8");
  if (cors.includes('Access-Control-Allow-Origin", "*"') || cors.includes("Access-Control-Allow-Origin: *")) {
    add("FAIL", "CORS wildcard detectado nas Edge Functions.");
  } else {
    add("PASS", "CORS wildcard nao detectado no helper compartilhado.");
  }
}

const rlsMigrationCount = trackedFiles
  .filter((file) => file.startsWith("supabase/migrations/") && file.endsWith(".sql"))
  .filter((file) => /enable row level security/i.test(readFileSync(join(root, file), "utf8"))).length;

if (rlsMigrationCount) {
  add("PASS", `Migrations com RLS detectadas: ${rlsMigrationCount}.`);
} else {
  add("WARN", "Nenhuma migration com ENABLE ROW LEVEL SECURITY foi detectada.");
}

const levelRank = { FAIL: 0, WARN: 1, PASS: 2 };
findings.sort((left, right) => levelRank[left.level] - levelRank[right.level]);

for (const finding of findings) {
  const suffix = finding.details ? `\n  ${finding.details}` : "";
  console.log(`[${finding.level}] ${finding.message}${suffix}`);
}

const failCount = findings.filter((finding) => finding.level === "FAIL").length;
process.exitCode = failCount ? 1 : 0;
