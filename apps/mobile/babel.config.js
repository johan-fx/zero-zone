module.exports = function (api) {
  api.cache(true);

  const plugins = [];

  if (process.env.NODE_ENV !== 'test') {
    plugins.push([
      '@tamagui/babel-plugin',
      {
        components: ['tamagui'],
        config: './tamagui.config.ts',
        disableExtraction: process.env.NODE_ENV !== 'production',
      },
    ]);
  }

  return {
    presets: ['babel-preset-expo'],
    plugins,
  };
};
