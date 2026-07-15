const { getDefaultConfig } = require('expo/metro-config');

const config = getDefaultConfig(__dirname);

// expo-sqlite uses a WebAssembly worker for its web storage implementation.
config.resolver.assetExts.push('wasm');

module.exports = config;
