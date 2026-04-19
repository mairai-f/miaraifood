export type DesktopDownloadPlatform = "windows" | "linux";

const windowsTargetUrl = import.meta.env.VITE_WINDOWS_DESKTOP_DOWNLOAD_URL?.trim() || null;
const linuxTargetUrl = import.meta.env.VITE_LINUX_DESKTOP_DOWNLOAD_URL?.trim() || null;

export const desktopDownloads = {
  windows: {
    label: "Windows (.exe)",
    route: "/downloads/windows",
    targetUrl: windowsTargetUrl,
  },
  linux: {
    label: "Linux (AppImage)",
    route: "/downloads/linux",
    targetUrl: linuxTargetUrl,
  },
};

export const isDesktopDownloadPlatform = (value: string | null | undefined): value is DesktopDownloadPlatform =>
  value === "windows" || value === "linux";
