// babel.config.js
module.exports = {
  presets: [
    '@babel/preset-flow',
    '@babel/preset-react',
    [
      '@babel/preset-env',
      {
        targets: {
          node: 'current',
        },
        modules: 'commonjs', // Ensure modules are transformed to CommonJS
      },
    ],
  ],
}
