const { filesystem, colors, print, path } = require('@codedungeon/gunner')
const { Snippet } = require('enquirer')
const tildify = require('tildify')

const prompt = new Snippet({
  name: 'username',
  message: `Fill out the following fields in ${colors.yellow.bold('plugin.json')}`,
  required: true,
  fields: [
    {
      name: 'pluginId',
      message: 'githubUserName.PluginName',
    },
    {
      name: 'pluginName',
      message: 'Name as it will appear in NotePlan Plugins menu',
    },
    {
      name: 'pluginDescription',
      message: 'Simple plugin description',
    },
    {
      name: 'pluginAuthor',
      message: 'your name or organization',
    },
  ],
  template: `{
  "plugin.id": "\${pluginId}",
  "plugin.name": "\${pluginName}",
  "plugin.description": "\${pluginDescription}",
  "plugin.author": "\${pluginAuthor}",
}
`,
})

module.exports = {
  run: async () => {
    try {
      return await prompt.run()
    } catch (error) {
      console.error(error)
    }
  },
  createPlugin: async function (pluginDest = '', pluginInfo = {}) {
    const src = path.resolve('./np.plugin-flow-skeleton')
    const dest = path.resolve(pluginDest)

    if (filesystem.existsSync(pluginDest)) {
      print.error(`${tildify(dest)} Already Exits`, 'ERROR')
      process.exit()
    }

    try {
      let result
      result = await filesystem.copySync(src, dest)

      result = await this.merge(path.join(dest, 'plugin.json'), pluginInfo)
      result = await this.merge(path.join(dest, 'README.md'), pluginInfo)
      result = await this.merge(path.join(dest, 'changelog.md'), pluginInfo)
      result = await this.merge(path.join(dest, 'src', 'helloWorld.js'), pluginInfo)

      await filesystem.delete(path.join(dest, 'script.js'))
    } catch (error) {
      print.error('An error occcured creating plugin', 'ERROR')
      const message = error.message.replace('ENOENT: ', '').replace(', stat ', '')
      print.error(`        • ${message}`)
      process.exit()
    }

    return true
  },

  merge: async function (filename = null, data = null) {
    try {
      let fileData = filesystem.read(filename)

      for (const [key, value] of Object.entries(data)) {
        const placeholder = '{{' + key + '}}' // dont use interpoliation
        fileData = fileData.replace(new RegExp(placeholder, 'g'), value)
      }

      filesystem.write(filename, fileData)
      return true
    } catch (error) {
      print.error(`An error occured processing ${filename}`, 'ERROR')
      return false
    }
  },
}
