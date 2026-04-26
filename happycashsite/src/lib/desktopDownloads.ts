export type DownloadPlatform =
  | "windows"
  | "linux"
  | "linux-deb"
  | "linux-appimage"
  | "android"
  | "ios";

export const desktopDownloadConfigKeys = {
  bucket: "DESKTOP_DOWNLOAD_BUCKET",
  signedUrlTtl: "DESKTOP_DOWNLOAD_SIGNED_URL_TTL",
  windowsObjectPath: "DESKTOP_WINDOWS_OBJECT_PATH",
  linuxDebObjectPath: "DESKTOP_LINUX_DEB_OBJECT_PATH",
  linuxAppImageObjectPath: "DESKTOP_LINUX_APPIMAGE_OBJECT_PATH",
  androidApkObjectPath: "ANDROID_APK_OBJECT_PATH",
} as const;

export const downloads = {
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
  android: {
    label: "Android APK",
    route: "/downloads/android",
    requiredEnv: [desktopDownloadConfigKeys.bucket, desktopDownloadConfigKeys.androidApkObjectPath],
  },
  ios: {
    label: "iOS TestFlight",
    route: "/downloads/ios",
    requiredEnv: ["IOS_TESTFLIGHT_URL"],
  },
};

export const isDownloadPlatform = (value: string | null | undefined): value is DownloadPlatform =>
  value === "windows" ||
  value === "linux" ||
  value === "linux-deb" ||
  value === "linux-appimage" ||
  value === "android" ||
  value === "ios";
