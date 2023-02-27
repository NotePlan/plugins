import path from 'path'
import { fileURLToPath } from 'url'
const __filename = fileURLToPath(import.meta.url)
const __dirname = path.dirname(__filename)

// NOTE: In addition to adding alias entry, the `./.flowconfig` mapper

export default {
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
