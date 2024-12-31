// babel.config.js
module.exports = (api) => {
  const isTest = api.env('test')
  return {
    presets: [
      '@babel/preset-flow',
      '@babel/preset-react',
      [
        '@babel/preset-env',
        {
          targets: {
            node: 'current',
          },
          modules: isTest ? 'commonjs' : false, // Use CommonJS for Jest, ES modules for Rollup
        },
      ],
    ],
  }
}
