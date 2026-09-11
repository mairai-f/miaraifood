import type { SupportedDesktopPlatform } from "./desktopAccess.ts";

interface GitHubReleaseAsset {
  name: string;
  browser_download_url: string;
  size?: number;
}

interface GitHubReleasePayload {
  tag_name: string;
  html_url: string;
  draft: boolean;
  prerelease: boolean;
  published_at: string | null;
  assets: GitHubReleaseAsset[];
}

export interface GitHubDesktopReleaseAsset {
  assetName: string;
  downloadUrl: string;
  tag: string;
  version: string;
  htmlUrl: string;
  publishedAt: string | null;
  size: number | null;
}

export interface GitHubMobileReleaseAsset {
  assetName: string;
  downloadUrl: string;
  tag: string;
  version: string;
  htmlUrl: string;
  publishedAt: string | null;
  size: number | null;
}

export type DesktopReleaseContext = "happycash";

const DEFAULT_OWNER = "mairai-f";
const DEFAULT_CHANNEL = "latest";
const DEFAULT_REPOSITORIES: Record<DesktopReleaseContext, string> = {
  happycash: "miaraifood",
};

const readReleaseConfig = (_context: DesktopReleaseContext) => {
  return {
    owner: (Deno.env.get("GITHUB_DESKTOP_RELEASE_OWNER") || DEFAULT_OWNER).trim(),
    repo: (Deno.env.get("GITHUB_DESKTOP_RELEASE_REPO") || DEFAULT_REPOSITORIES.happycash).trim(),
    channel: (Deno.env.get("GITHUB_DESKTOP_RELEASE_CHANNEL") || DEFAULT_CHANNEL).trim().toLowerCase(),
    token: Deno.env.get("GITHUB_DESKTOP_RELEASE_TOKEN")?.trim() || null,
  };
};

const githubHeaders = (token?: string | null) => {
  const headers = new Headers({
    "Accept": "application/vnd.github+json",
    "User-Agent": "happycash-desktop-release",
  });

  if (token) {
    headers.set("Authorization", `Bearer ${token}`);
  }

  return headers;
};

const requestGitHub = async <T>(path: string, token?: string | null): Promise<T> => {
  const response = await fetch(`https://api.github.com${path}`, {
    headers: githubHeaders(token),
  });

  if (!response.ok) {
    throw new Error(`GitHub release lookup failed with status ${response.status}.`);
  }

  return await response.json() as T;
};

const selectReleaseCandidatesByChannel = (releases: GitHubReleasePayload[], channel: string) => {
  if (channel === "beta") {
    return releases.filter((release) => !release.draft && release.prerelease && /beta/i.test(release.tag_name));
  }

  if (channel === "alpha") {
    return releases.filter((release) => !release.draft && release.prerelease && /alpha/i.test(release.tag_name));
  }

  return releases.filter((release) => !release.draft && !release.prerelease);
};

const findPlatformAsset = (assets: GitHubReleaseAsset[], platform: SupportedDesktopPlatform) => {
  if (platform === "windows") {
    return assets.find((asset) =>
      /\.exe$/i.test(asset.name)
      && /setup/i.test(asset.name)
      && !/portable/i.test(asset.name)
      && !/\.blockmap$/i.test(asset.name),
    ) || null;
  }

  if (platform === "linux" || platform === "linux-deb") {
    return assets.find((asset) =>
      /\.deb$/i.test(asset.name)
      && !/\.blockmap$/i.test(asset.name),
    ) || null;
  }

  return assets.find((asset) =>
    /\.AppImage$/i.test(asset.name)
    && !/\.blockmap$/i.test(asset.name),
  ) || null;
};

const findAndroidApkAsset = (assets: GitHubReleaseAsset[]) =>
  assets.find((asset) =>
    /\.apk$/i.test(asset.name)
    && !/sha256|checksum|blockmap/i.test(asset.name),
  ) || null;

export const fetchLatestDesktopReleaseAsset = async (
  platform: SupportedDesktopPlatform,
  context: DesktopReleaseContext = "happycash",
): Promise<GitHubDesktopReleaseAsset> => {
  const { owner, repo, channel, token } = readReleaseConfig(context);
  const releases = await requestGitHub<GitHubReleasePayload[]>(`/repos/${owner}/${repo}/releases?per_page=30`, token);
  const candidates = selectReleaseCandidatesByChannel(releases, channel);

  if (!candidates.length) {
    throw new Error("Nenhum release do GitHub foi encontrado para o canal configurado.");
  }

  for (const release of candidates) {
    const asset = findPlatformAsset(release.assets || [], platform);

    if (!asset) {
      continue;
    }

    return {
      assetName: asset.name,
      downloadUrl: asset.browser_download_url,
      tag: release.tag_name,
      version: release.tag_name.replace(/^v/i, ""),
      htmlUrl: release.html_url,
      publishedAt: release.published_at,
      size: typeof asset.size === "number" ? asset.size : null,
    };
  }

  throw new Error(`Nenhum asset de ${platform} foi encontrado nos releases do canal ${channel}.`);
};

export const fetchLatestMobileReleaseAsset = async (
  context: DesktopReleaseContext = "happycash",
): Promise<GitHubMobileReleaseAsset> => {
  const { owner, repo, channel, token } = readReleaseConfig(context);
  const releases = await requestGitHub<GitHubReleasePayload[]>(`/repos/${owner}/${repo}/releases?per_page=30`, token);
  const candidates = selectReleaseCandidatesByChannel(releases, channel);

  if (!candidates.length) {
    throw new Error("Nenhum release do GitHub foi encontrado para o canal configurado.");
  }

  for (const release of candidates) {
    const asset = findAndroidApkAsset(release.assets || []);

    if (!asset) {
      continue;
    }

    return {
      assetName: asset.name,
      downloadUrl: asset.browser_download_url,
      tag: release.tag_name,
      version: release.tag_name.replace(/^v/i, ""),
      htmlUrl: release.html_url,
      publishedAt: release.published_at,
      size: typeof asset.size === "number" ? asset.size : null,
    };
  }

  throw new Error(`Nenhum asset Android APK foi encontrado nos releases do canal ${channel}.`);
};
