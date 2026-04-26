export type DesktopDownloadPlatform = "windows" | "linux" | "linux-deb" | "linux-appimage";

export const desktopDownloadConfigKeys = {
  bucket: "DESKTOP_DOWNLOAD_BUCKET",
  signedUrlTtl: "DESKTOP_DOWNLOAD_SIGNED_URL_TTL",
  windowsObjectPath: "DESKTOP_WINDOWS_OBJECT_PATH",
  linuxDebObjectPath: "DESKTOP_LINUX_DEB_OBJECT_PATH",
  linuxAppImageObjectPath: "DESKTOP_LINUX_APPIMAGE_OBJECT_PATH",
} as const;

export const desktopDownloads = {
  windows: {
    label: "Windows (.exe)",
    route: "/downloads/windows",
    requiredEnv: [desktopDownloadConfigKeys.bucket, desktopDownloadConfigKeys.windowsObjectPath],
  },
  "linux-deb": {
    label: "Linux instalador (.deb)",
    route: "/downloads/linux-deb",
    requiredEnv: [desktopDownloadConfigKeys.bucket, desktopDownloadConfigKeys.linuxDebObjectPath],
  },
  linux: {
    label: "Linux instalador (.deb)",
    route: "/downloads/linux",
    requiredEnv: [desktopDownloadConfigKeys.bucket, desktopDownloadConfigKeys.linuxDebObjectPath],
  },
  "linux-appimage": {
    label: "Linux portátil (AppImage)",
    route: "/downloads/linux-appimage",
    requiredEnv: [desktopDownloadConfigKeys.bucket, desktopDownloadConfigKeys.linuxAppImageObjectPath],
  },
};

export const isDesktopDownloadPlatform = (value: string | null | undefined): value is DesktopDownloadPlatform =>
  value === "windows" || value === "linux" || value === "linux-deb" || value === "linux-appimage";
