const { getDefaultConfig } = require('expo/metro-config');
const { withTamagui } = require('@tamagui/metro-plugin');

const config = getDefaultConfig(__dirname);

config.resolver.sourceExts = Array.from(new Set([...config.resolver.sourceExts, 'cjs']));

module.exports = withTamagui(config, {
  components: ['tamagui'],
  config: './tamagui.config.ts',
  outputCSS: './src/tamagui.generated.css',
});
