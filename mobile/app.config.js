const defaultProjectId = '644bdd5c-af8c-4e44-a395-36a71e68f57e';

module.exports = {
  expo: {
    name: 'HappyCash Mobile',
    slug: 'happycash-mobile',
    version: '0.1.61',
    orientation: 'portrait',
    scheme: 'happycash',
    userInterfaceStyle: 'dark',
    icon: './assets/icon.png',
    splash: {
      image: './assets/splash.png',
      resizeMode: 'contain',
      backgroundColor: '#f8fbff',
    },
    ios: {
      supportsTablet: true,
      bundleIdentifier: 'com.happycash.mobile',
      infoPlist: {
        ITSAppUsesNonExemptEncryption: false,
      },
    },
    android: {
      package: 'com.happycash.mobile',
      edgeToEdgeEnabled: true,
      adaptiveIcon: {
        foregroundImage: './assets/adaptive-icon.png',
        backgroundColor: '#f8fbff',
      },
    },
    extra: {
      eas: {
        projectId: defaultProjectId,
      },
      happycash: {
        context: 'happycash',
      },
    },
  },
};
