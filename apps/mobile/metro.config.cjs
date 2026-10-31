const { getDefaultConfig } = require('expo/metro-config');
const { resolve, sep } = require('node:path');

const config = getDefaultConfig(__dirname);
const contractsSource = resolve(__dirname, '../../packages/contracts/src') + sep;

config.resolver.resolveRequest = (context, moduleName, platform) => {
  // Shared NodeNext contracts retain .js imports for the API's emitted ESM.
  // Let Expo resolve their source extensions and native variants in this bundle.
  const sourceRequest = context.originModulePath.startsWith(contractsSource) &&
    /^\.\.?\//.test(moduleName) && moduleName.endsWith('.js')
    ? moduleName.slice(0, -3)
    : moduleName;
  return context.resolveRequest(context, sourceRequest, platform);
};

module.exports = config;
