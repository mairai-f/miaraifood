export type DownloadPlatform =
  | "windows"
  | "linux"
  | "linux-deb"
  | "linux-appimage"
  | "android"
  | "ios";

export const downloads = {
  windows: {
    label: "Windows (.exe)",
    route: "/downloads/windows",
  },
  "linux-deb": {
    label: "Linux instalador (.deb)",
    route: "/downloads/linux-deb",
  },
  linux: {
    label: "Linux instalador (.deb)",
    route: "/downloads/linux",
  },
  "linux-appimage": {
    label: "Linux portátil (AppImage)",
    route: "/downloads/linux-appimage",
  },
  android: {
    label: "Android APK",
    route: "/downloads/android",
  },
  ios: {
    label: "iOS TestFlight",
    route: "/downloads/ios",
  },
};

export const isDownloadPlatform = (value: string | null | undefined): value is DownloadPlatform =>
  value === "windows" ||
  value === "linux" ||
  value === "linux-deb" ||
  value === "linux-appimage" ||
  value === "android" ||
  value === "ios";
