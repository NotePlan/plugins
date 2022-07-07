const path = require('path')

// NOTE: In addition to adding alias entry, the `./.flowconfig` mapper

module.exports = {
  aliasEntries: [
    {
      find: '@plugins',
      replacement: path.resolve(__dirname),
    },
    {
      find: '@helpers',
      replacement: path.resolve('./helpers'),
    },
    {
      find: '@mocks',
      replacement: path.resolve('./__mocks__'),
    },
    {
      find: '@templating',
      replacement: path.resolve('./np.Templating/lib'),
    },
    {
      find: '@templatingModules',
      replacement: path.resolve('./np.Templating/lib/support/modules'),
    },
    {
      find: 'NPTemplating',
      replacement: path.resolve('./np.Templating/lib/NPTemplating'),
    },
    {
      find: 'TemplatingEngine',
      replacement: path.resolve('./np.Templating/lib/TemplatingEngine'),
    },
    {
      find: 'NPGlobals',
      replacement: path.resolve('./np.Globals/lib/NPGlobals'),
    },
  ],
}
