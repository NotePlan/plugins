const { filesystem, colors, print, path } = require('@codedungeon/gunner')
const { prompt } = require('enquirer')
const tildify = require('tildify')
const gitUserLocal = require('git-user-local')
const githubUsername = require('github-username')

const buildQuestion = (name = '', message = '', initial = '') => {
  return {
    type: 'input',
    name,
    message,
    initial,
  }
}

const questions = []

module.exports = {
  run: async (toolbox) => {
    try {
      const ghUserLocal = await gitUserLocal()
      const ghUserName = await githubUsername(ghUserLocal.user.email)
      !toolbox.arguments.hasOwnProperty('id') ? questions.push(buildQuestion('pluginId', 'What would you like to name your plugin?', `${ghUserName}.PluginName`)) : null

      !toolbox.arguments.hasOwnProperty('name')
        ? questions.push(buildQuestion('pluginName', 'Name as it will appear in NotePlan Preferences Plugins List?', `My Plugin Name`))
        : null

      !toolbox.arguments.hasOwnProperty('description') ? questions.push(buildQuestion('pluginDescription', 'Simple Plugin Description', `My Plugin for NotePlan`)) : null

      !toolbox.arguments.hasOwnProperty('author') ? questions.push(buildQuestion('pluginAuthor', 'Your Name or Organization', ghUserName)) : null

      let answers = {}
      if (questions.length > 0) {
        answers = { ...(await prompt(questions)) }
      }
      const result = {
        ...{
          pluginId: toolbox.arguments?.id,
          pluginName: toolbox.arguments?.name,
          pluginDescription: toolbox.arguments?.description,
          pluginAuthor: toolbox.arguments?.author,
        },
        ...answers,
      }

      return result
    } catch (error) {
      console.error(error)
    }
  },

  createPlugin: async function (pluginDest = '', pluginInfo = {}) {
    const src = path.resolve('./src/templates/np.plugin.starter')
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
      result = await this.merge(path.join(dest, 'src', 'NPPluginMain.js'), pluginInfo)

      result = await this.merge(path.join(dest, '__tests__', 'utils.test.js'), pluginInfo)

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
      print.error(error, 'ERROR')
      return false
    }
  },
}
