const GITHUB_LATEST_DOWNLOAD_BASE = "https://github.com/celioantonio7/HappyCash/releases/latest/download";

export const desktopDownloads = {
  windows: {
    label: "Windows (.exe)",
    href: `${GITHUB_LATEST_DOWNLOAD_BASE}/HappyCash-Setup-0.1.1.exe`,
  },
  linux: {
    label: "Linux (AppImage)",
    href: `${GITHUB_LATEST_DOWNLOAD_BASE}/HappyCash-0.1.1.AppImage`,
  },
};
