export type DesktopDownloadPlatform = "windows" | "linux";

export const desktopDownloadConfigKeys = {
  bucket: "DESKTOP_DOWNLOAD_BUCKET",
  signedUrlTtl: "DESKTOP_DOWNLOAD_SIGNED_URL_TTL",
  windowsObjectPath: "DESKTOP_WINDOWS_OBJECT_PATH",
  linuxObjectPath: "DESKTOP_LINUX_OBJECT_PATH",
} as const;

export const desktopDownloads = {
  windows: {
    label: "Windows (.exe)",
    route: "/downloads/windows",
    requiredEnv: [desktopDownloadConfigKeys.bucket, desktopDownloadConfigKeys.windowsObjectPath],
  },
  linux: {
    label: "Linux (AppImage)",
    route: "/downloads/linux",
    requiredEnv: [desktopDownloadConfigKeys.bucket, desktopDownloadConfigKeys.linuxObjectPath],
  },
};

export const isDesktopDownloadPlatform = (value: string | null | undefined): value is DesktopDownloadPlatform =>
  value === "windows" || value === "linux";
