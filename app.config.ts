import { ExpoConfig, ConfigContext } from 'expo/config';

const IS_DEV = process.env.APP_VARIANT === 'development';
const IS_PREVIEW = process.env.APP_VARIANT === 'preview';

const getBundleId = () => {
  if (IS_DEV) return 'com.nutritrack.app.dev';
  if (IS_PREVIEW) return 'com.nutritrack.app.preview';
  return 'com.nutritrack.app';
};

const getAppName = () => {
  if (IS_DEV) return 'NutriTrack (Dev)';
  if (IS_PREVIEW) return 'NutriTrack (Preview)';
  return 'NutriTrack';
};

export default ({ config }: ConfigContext): ExpoConfig => ({
  ...config,
  name: getAppName(),
  slug: 'nutritrack',
  version: '1.0.0',
  sdkVersion: '55.0.0',
  orientation: 'portrait',
  icon: './assets/icon.png',
  scheme: 'nutritrack',
  userInterfaceStyle: 'light',
  splash: {
    backgroundColor: '#4CAF50',
    resizeMode: 'contain',
  },
  ios: {
    supportsTablet: true,
    bundleIdentifier: getBundleId(),
  },
  android: {
    adaptiveIcon: {
      backgroundColor: '#4CAF50',
    },
    package: getBundleId(),
  },
  web: {
    bundler: 'metro',
    output: 'static',
    favicon: './assets/favicon.png',
  },
  plugins: [
    'expo-router',
    [
      'expo-build-properties',
      {
        android: {
          minSdkVersion: 24,
          compileSdkVersion: 35,
          targetSdkVersion: 35,
          kotlinVersion: '2.0.21',
        },
        ios: {
          deploymentTarget: '16.0',
        },
      },
    ],
  ],
  experiments: {
    typedRoutes: true,
  },
});
