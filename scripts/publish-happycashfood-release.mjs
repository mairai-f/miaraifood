import { execSync } from "node:child_process";
import { existsSync, readFileSync } from "node:fs";
import path from "node:path";

const owner = process.env.GITHUB_FOOD_RELEASE_OWNER?.trim() || "celioantonio7";
const repo = process.env.GITHUB_FOOD_RELEASE_REPO?.trim() || "HappyCashFood-Releases";
const version = `v${JSON.parse(execSync("node -p \"JSON.stringify(require('./package.json').version)\"", { encoding: "utf8" }))}`;
const releaseDir = path.resolve("release/happycashfood");
const assets = [
  path.join(releaseDir, `HappyCashFood-${version.slice(1)}.AppImage`),
  path.join(releaseDir, `HappyCashFood-${version.slice(1)}.deb`),
  path.join(releaseDir, "latest-linux.yml"),
  path.join(releaseDir, `HappyCashFood-${version.slice(1)}-win-unpacked.zip`),
];

const credentialScript = [
  "tmp=$(mktemp)",
  "printf 'protocol=https\\nhost=github.com\\n\\n' | git credential fill > \"$tmp\" 2>/dev/null",
  "sed -n 's/^password=//p' \"$tmp\" | head -n1",
  "rm -f \"$tmp\"",
].join("; ");

const token = process.env.GH_TOKEN?.trim()
  || process.env.GITHUB_TOKEN?.trim()
  || execSync(`bash -lc "${credentialScript}"`, { encoding: "utf8" }).trim();

if (!token) {
  throw new Error("Nenhum token do GitHub foi encontrado. Defina GH_TOKEN ou mantenha a credencial HTTPS salva no git.");
}

for (const asset of assets) {
  if (!existsSync(asset)) {
    throw new Error(`Asset nao encontrado para a release: ${asset}`);
  }
}

const defaultHeaders = {
  Accept: "application/vnd.github+json",
  Authorization: `Bearer ${token}`,
  "X-GitHub-Api-Version": "2022-11-28",
  "User-Agent": "happycashfood-release-publisher",
};

const requestGitHub = async (url, init = {}, { allow404 = false } = {}) => {
  const response = await fetch(url, {
    ...init,
    headers: {
      ...defaultHeaders,
      ...(init.headers || {}),
    },
  });

  const text = await response.text();
  const json = text ? JSON.parse(text) : null;

  if (!response.ok && !(allow404 && response.status === 404)) {
    throw new Error(`GitHub ${response.status} ${response.statusText}: ${json?.message || text}`);
  }

  return { response, json };
};

const ensureRepository = async () => {
  const current = await requestGitHub(`https://api.github.com/repos/${owner}/${repo}`, {}, { allow404: true });
  if (current.response.ok) {
    console.log(`REPO_EXISTS ${owner}/${repo}`);
    return current.json;
  }

  const created = await requestGitHub("https://api.github.com/user/repos", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      name: repo,
      description: "Releases oficiais do HappyCashFood Offline para Windows, Linux e .deb.",
      private: false,
      auto_init: true,
      has_issues: false,
      has_projects: false,
      has_wiki: false,
    }),
  });

  console.log(`REPO_CREATED ${created.json.full_name}`);
  return created.json;
};

const ensureRelease = async () => {
  const current = await requestGitHub(`https://api.github.com/repos/${owner}/${repo}/releases/tags/${version}`, {}, { allow404: true });
  if (current.response.ok) {
    console.log(`RELEASE_EXISTS ${version}`);
    return current.json;
  }

  const created = await requestGitHub(`https://api.github.com/repos/${owner}/${repo}/releases`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      tag_name: version,
      target_commitish: "main",
      name: `HappyCashFood ${version}`,
      body: "Release desktop do HappyCashFood Offline com Windows, AppImage e pacote .deb.",
      draft: false,
      prerelease: false,
      generate_release_notes: false,
    }),
  });

  console.log(`RELEASE_CREATED ${version}`);
  return created.json;
};

const mimeTypeForAsset = (name) => {
  if (name.endsWith(".yml")) return "text/yaml";
  if (name.endsWith(".deb")) return "application/vnd.debian.binary-package";
  if (name.endsWith(".zip")) return "application/zip";
  return "application/octet-stream";
};

await ensureRepository();
const release = await ensureRelease();
const uploadUrl = release.upload_url.replace(/\{.*$/, "");
const existingAssetsResponse = await requestGitHub(`https://api.github.com/repos/${owner}/${repo}/releases/${release.id}/assets`);
const existingAssets = Array.isArray(existingAssetsResponse.json) ? existingAssetsResponse.json : [];

for (const asset of assets) {
  const name = path.basename(asset);
  const existingAsset = existingAssets.find((item) => item.name === name);
  if (existingAsset) {
    await requestGitHub(`https://api.github.com/repos/${owner}/${repo}/releases/assets/${existingAsset.id}`, {
      method: "DELETE",
    });
  }

  const uploaded = await requestGitHub(`${uploadUrl}?name=${encodeURIComponent(name)}`, {
    method: "POST",
    headers: { "Content-Type": mimeTypeForAsset(name) },
    body: readFileSync(asset),
  });

  console.log(`ASSET_UPLOADED ${uploaded.json.name}`);
}
