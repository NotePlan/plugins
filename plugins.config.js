const path = require('path')

// NOTE: In addition to adding alias entry, the `./.flowconfig` mapper

module.exports = {
  aliasEntries: [
    {
      find: '@helpers',
      replacement: path.resolve('./helpers'),
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
  ],
}
