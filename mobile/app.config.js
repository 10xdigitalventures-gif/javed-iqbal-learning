const IS_DEV = process.env.APP_ENV === 'development';

// White-label overrides from env vars (set per-tenant in EAS Build profile)
const APP_NAME = process.env.EXPO_PUBLIC_APP_NAME || 'Prof. Dr. Javed Iqbal';
const APP_SLUG = process.env.EXPO_PUBLIC_APP_SLUG || 'javed-iqbal-learning';
const BUNDLE_ID = process.env.EXPO_PUBLIC_BUNDLE_ID || 'com.javediqbal.learning';
const ANDROID_PKG = process.env.EXPO_PUBLIC_ANDROID_PKG || 'com.javediqbal.learning';
const API_URL = process.env.EXPO_PUBLIC_API_URL || 'https://api.mentoringhub.online/api';
const TENANT_SLUG = process.env.EXPO_PUBLIC_TENANT_SLUG || '';
const BRAND_COLOR = process.env.EXPO_PUBLIC_BRAND_COLOR || '#FF9100';
const EAS_PROJECT_ID = process.env.EAS_PROJECT_ID || '431ff4dd-dc8b-43af-8544-511099762aaa';

module.exports = {
  expo: {
    name: APP_NAME,
    slug: APP_SLUG,
    version: '1.0.0',
    sdkVersion: '54.0.0',
    orientation: 'portrait',
    userInterfaceStyle: 'light',
    newArchEnabled: true,
    icon: './assets/icon.png',
    splash: {
      image: './assets/splash-icon.png',
      resizeMode: 'contain',
      backgroundColor: BRAND_COLOR,
    },
    assetBundlePatterns: ['**/*'],
    plugins: [
      'expo-font',
      ['expo-notifications', { color: BRAND_COLOR, defaultChannel: 'default' }],
      ['expo-secure-store', {
        faceIDPermission: `Allow $(PRODUCT_NAME) to access your Face ID biometric data.`,
      }],
      ['expo-av', {
        microphonePermission: `Allow ${APP_NAME} to access your microphone to record voice messages.`,
      }],
      ['expo-image-picker', {
        cameraPermission: `Allow ${APP_NAME} to use the camera to record video messages.`,
        microphonePermission: `Allow ${APP_NAME} to record audio for video messages.`,
      }],
    ],
    notification: { iosDisplayInForeground: true },
    ios: {
      supportsTablet: true,
      bundleIdentifier: BUNDLE_ID,
      infoPlist: {
        NSMicrophoneUsageDescription: `Allow ${APP_NAME} to access your microphone to record voice messages.`,
        NSCameraUsageDescription: `Allow ${APP_NAME} to use the camera to record video messages.`,
        NSPhotoLibraryUsageDescription: `Allow ${APP_NAME} to attach media from your library.`,
      },
    },
    android: {
      package: ANDROID_PKG,
      adaptiveIcon: {
        foregroundImage: './assets/adaptive-icon.png',
        backgroundColor: BRAND_COLOR,
      },
      permissions: [
        'android.permission.INTERNET',
        'android.permission.RECORD_AUDIO',
        'android.permission.READ_EXTERNAL_STORAGE',
        'android.permission.WRITE_EXTERNAL_STORAGE',
        'android.permission.CAMERA',
      ],
    },
    web: { favicon: './assets/favicon.png' },
    extra: {
      apiUrl: API_URL,
      tenantSlug: TENANT_SLUG,
      brandColor: BRAND_COLOR,
      isDev: IS_DEV,
      eas: { projectId: EAS_PROJECT_ID },
    },
  },
};
