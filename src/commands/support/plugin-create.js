/* eslint-disable */
const { filesystem, colors, print, path } = require('@codedungeon/gunner')
const { prompt } = require('enquirer')
const tildify = require('tildify')
const gitUserLocal = require('git-user-local')
const githubUsername = require('github-username')

const questions = []

module.exports = {
  run: async (toolbox) => {
    try {
      const ghUserLocal = await gitUserLocal()
      let ghUserName = '<author>'
      if (!toolbox.arguments.force) {
        ghUserName = await githubUsername(ghUserLocal.user.email)
      }

      !toolbox.arguments.hasOwnProperty('id')
        ? questions.push(
            toolbox.prompts.buildQuestion('input', 'pluginId', 'What would you like to name your plugin?', {
              input: ghUserName === '<author>' ? '' : `${ghUserName}.PluginName`,
              hint: ghUserName === '<author>' ? 'e.g. githubUserName.MyPlugin' : '',
              validate: (value, state, item, index) => {
                if (value.length === 0 || value.indexOf('<author>') !== -1) {
                  return toolbox.colors.red(`You must supply a valid plugin author (e.g. githubUserName.MyPlugin)`)
                }
                return true
              },
            }),
          )
        : null

      !toolbox.arguments.hasOwnProperty('name')
        ? questions.push(
            toolbox.prompts.buildQuestion(
              'input',
              'pluginName',
              'Name as it will appear in NotePlan Preferences Plugins List?',
              { input: `My Plugin Name` },
            ),
          )
        : null

      !toolbox.arguments.hasOwnProperty('description')
        ? questions.push(
            toolbox.prompts.buildQuestion('input', 'pluginDescription', 'Simple Plugin Description', {
              input: `My Plugin for NotePlan`,
            }),
          )
        : null

      !toolbox.arguments.hasOwnProperty('author')
        ? questions.push(
            toolbox.prompts.buildQuestion('input', 'pluginAuthor', 'Your Name or Organization Name', {
              input: ghUserName === '<author>' ? '' : ghUserName,
              hint: ghUserName === '<author>' ? 'e.g. codedungeon' : '',
              validate: (value, state, item, index) => {
                if (value.length === 0 || value.indexOf('<author>') !== -1) {
                  if (ghUserName.indexOf('<pluginAuthor>') !== -1) {
                    return toolbox.colors.red('You must supply a valid plugin author name (e.g. codedungeon)')
                  } else {
                    return toolbox.colors.red(`You must supply a valid plugin author name (e.g. ${ghUserName})`)
                  }
                }
                return true
              },
            }),
          )
        : null

      let answers = {}

      if (questions.length > 0) {
        answers = { ...(await toolbox.prompts.show(questions)) }
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

      result = await this.merge(path.join(dest, '__tests__', 'helpers.test.js'), pluginInfo)
      result = await this.merge(path.join(dest, '__tests__', 'NPPluginMain.test.js'), pluginInfo)

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
