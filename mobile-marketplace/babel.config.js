module.exports = function (api) {
  api.cacheDirectory(true);
  return { presets: ['babel-preset-expo'] };
};
