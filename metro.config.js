const { getSentryExpoConfig } = require('@sentry/react-native/metro');
const { getDefaultConfig } = require('expo/metro-config');

const hasSentryBuildConfig = Boolean(process.env.SENTRY_ORG && process.env.SENTRY_PROJECT);
const config = hasSentryBuildConfig
  ? getSentryExpoConfig(__dirname, { enableSourceContextInDevelopment: false })
  : getDefaultConfig(__dirname);

// expo-sqlite uses a WebAssembly worker for its web storage implementation.
config.resolver.assetExts.push('wasm');

module.exports = config;
