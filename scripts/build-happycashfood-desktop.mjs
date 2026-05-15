import { spawnSync } from "node:child_process";
import { createRequire } from "node:module";
import { readFileSync } from "node:fs";
import path from "node:path";

const require = createRequire(import.meta.url);
const foodPackage = JSON.parse(readFileSync("happycashfood/package.json", "utf8"));
const foodVersion = String(foodPackage.version || "").trim();

const resolvePackageBin = (packageName, binName = packageName) => {
  const packageJsonPath = require.resolve(`${packageName}/package.json`);
  const packageJson = JSON.parse(readFileSync(packageJsonPath, "utf8"));
  const binPath = typeof packageJson.bin === "string"
    ? packageJson.bin
    : packageJson.bin?.[binName];

  if (!binPath) {
    throw new Error(`Binario ${binName} nao encontrado no pacote ${packageName}.`);
  }

  return path.resolve(path.dirname(packageJsonPath), binPath);
};

if (!foodVersion) {
  throw new Error("Versao do HappyCashFood nao encontrada em happycashfood/package.json.");
}

const run = (command, args, options = {}) => {
  const result = spawnSync(command, args, {
    stdio: "inherit",
    shell: false,
    ...options,
  });

  if (result.error) {
    throw result.error;
  }

  if (result.status !== 0) {
    process.exit(result.status || 1);
  }
};

run(process.execPath, [
  resolvePackageBin("vite"),
  "build",
  "--config",
  "happycashfood/vite.config.ts",
  "--outDir",
  "../dist-food",
]);

run(
  process.execPath,
  [
    require.resolve("electron-builder/cli.js"),
    ...process.argv.slice(2),
    "--config",
    "electron-builder.food.json",
    `-c.extraMetadata.version=${foodVersion}`,
  ],
  {
    env: {
      ...process.env,
      HAPPYCASH_PRODUCT_CONTEXT: "happycashfood",
      HAPPYCASH_RENDERER_DIR: "dist-food",
    },
  },
);
