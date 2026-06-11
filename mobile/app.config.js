const contextFromEnv = process.env.HAPPYCASH_MOBILE_CONTEXT || process.env.EXPO_PUBLIC_HAPPYCASH_CONTEXT;
const isFoodContext = String(contextFromEnv || '').trim().toLowerCase() === 'happycashfood';
const defaultProjectId = '644bdd5c-af8c-4e44-a395-36a71e68f57e';
const foodProjectId = process.env.HAPPYCASH_FOOD_MOBILE_EAS_PROJECT_ID || defaultProjectId;

module.exports = {
  expo: {
    name: isFoodContext ? 'HappyCashFood Mobile' : 'HappyCash Mobile',
    slug: isFoodContext ? 'happycashfood-mobile' : 'happycash-mobile',
    version: '0.1.33',
    orientation: 'portrait',
    scheme: isFoodContext ? 'happycashfood' : 'happycash',
    userInterfaceStyle: 'dark',
    icon: './assets/icon.png',
    splash: {
      image: './assets/splash.png',
      resizeMode: 'contain',
      backgroundColor: '#1a1a1a',
    },
    ios: {
      supportsTablet: true,
      bundleIdentifier: isFoodContext ? 'com.happycashfood.mobile' : 'com.happycash.mobile',
      infoPlist: {
        ITSAppUsesNonExemptEncryption: false,
      },
    },
    android: {
      package: isFoodContext ? 'com.happycashfood.mobile' : 'com.happycash.mobile',
      edgeToEdgeEnabled: true,
      adaptiveIcon: {
        foregroundImage: './assets/adaptive-icon.png',
        backgroundColor: '#1a1a1a',
      },
    },
    extra: {
      eas: {
        projectId: isFoodContext ? foodProjectId : defaultProjectId,
      },
      happycash: {
        context: isFoodContext ? 'happycashfood' : 'happycash',
      },
    },
  },
};
