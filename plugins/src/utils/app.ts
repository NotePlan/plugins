const { helpers, filesystem, system, strings, print, path } = require('@codedungeon/gunner')
const toolbox = require('@codedungeon/gunner')

const execa = require('execa')
const dotProp = require('dot-prop')
const _ = require('lodash')
const findup = require('findup-sync')
const Configstore = require('configstore')
const Messenger = require('@codedungeon/messenger')

const appConfigPath = path.join(__dirname, '../..', 'config', 'craftsman.json')
const projectConfigPath = path.join(process.cwd(), '/config/craftsman.json')

module.exports = {
  checkApplication() {
    const composerFilename = path.join(process.cwd(), 'composer.json')
    if (!filesystem.existsSync(composerFilename)) {
      console.log('')
      toolbox.print.error('Unable to locate `composer.json` in current directory.', 'ERROR')
      toolbox.print.error('        Make sure you are executing command from project root.\n')
      process.exit()
    }
  },

  formatModel(model = '') {
    if (!model) {
      return ''
    }
    model = model.replace(/\//gi, '/').replace(/[.]/gi, '/')
    const tempParts = model.split('/').map((x) => {
      return strings.titleCase(x)
    })
    return tempParts.join('/')
  },

  templatePath() {
    return path.join(__dirname, '../..', 'templates')
  },

  getAppPath() {
    const packageJsonFilename = findup('package.json')
    return path.dirname(packageJsonFilename)
  },

  // eslint-disable-next-line
  getConfigData(options = { converToObject: true }) {
    let projectConfig = ''
    const appConfig = filesystem.readFileSync(appConfigPath)
    if (filesystem.existsSync(projectConfigPath)) {
      projectConfig = filesystem.readFileSync(projectConfigPath)
    }

    // merge config
    const appConfigData = JSON.parse(appConfig)
    const projectConfigData = projectConfig.length >= 2 ? JSON.parse(projectConfig) : {}

    const configData = _.merge(appConfigData, projectConfigData)

    return configData
  },

  async getCommandPath() {
    return path.join(await this.getAppPath(), 'src', 'commands')
  },

  async getCommandList() {
    const commandPath = await this.getCommandPath()
    const commands = []
    if (commandPath) {
      const files = filesystem.readdirSync(commandPath)
      files.forEach((file) => {
        const filename = path.join(commandPath, file)
        commands.push(filename)
      })
    }

    return commands
  },

  getAppConfigData() {
    const configData = filesystem.readFileSync(appConfigPath, 'utf-8')
    return JSON.parse(configData)
  },

  getProjectConfig() {
    return filesystem.existsSync(projectConfigPath) ? require(projectConfigPath) : {}
  },

  config(key = null, value = null, options = {}) {
    const configData = this.getConfigData()

    let config = ''

    const deleteKey = options?.action === 'delete' || false
    if (deleteKey) {
      // only delete from project config
      config = new Configstore('laravel-craftsman-2', null, {
        configPath: projectConfigPath,
      })
      return config.delete(key)
    }

    const hasKey = options?.action === 'has' || false
    if (hasKey) {
      return dotProp.has(configData, key)
    }

    if (typeof value === 'string' || typeof value === 'boolean') {
      // set config to project config, leave app config in place
      config = new Configstore('laravel-craftsman-2', null, {
        configPath: projectConfigPath,
      })
      config.set(key, value)
      const configValue = value.replace('<project>', process.cwd())
      return configValue
    } else {
      let configValue = dotProp.get(configData, key)

      if (configValue && typeof configValue === 'string') {
        configValue = configValue.replace('<project>', process.cwd())
      }
      return configValue
    }
  },

  configGet(key = null, defaultValue = null) {
    return this.config(key, defaultValue)
  },

  configDelete(key = null) {
    return this.config(key, null, { action: 'delete' })
  },

  configSet(key = null, value = null) {
    return this.config(key, value)
  },

  configHas(key = null) {
    return this.config(key, null, { action: 'has' })
  },

  getOutputPath(type = '') {
    type = toolbox.strings.plural(type)
    return this.config(`output.${type}`)
  },

  getFilename(type = '', name = '') {
    const parts = name.split('/')
    if (parts.length === 1) {
      // eslint-disable-next-line
      name = this.config(`output.${type}`) + '/' + name
    }

    // eslint-disable-next-line
    const filename = path.join(process.cwd(), name) + '.php'
    return path.resolve(filename)
  },

  getTemplate(configTemplate = null, args = null) {
    let templateFilename = ''

    // first use user supplied template
    let template = args && args?.template ? args.template : ''
    if (template.length > 0) {
      const ext = path.extname(template)
      if (template.length > 0 && ext !== '.mustache') {
        template = template.replace(ext, '')
        template = `${template}.mustache`
      }

      templateFilename = path.resolve(template)
      if (filesystem.existsSync(templateFilename)) {
        return templateFilename
      }
    }

    // second check if specific template has been defined
    templateFilename = this.config(`templates.${configTemplate}`)
    if (filesystem.existsSync(templateFilename)) {
      return path.resolve(templateFilename) // all good, return result
    }

    // third attempt will be to locate template in user defined templatePath
    templateFilename = path.join(this.getAppTemplatePath(), `${configTemplate}.mustache`)
    if (filesystem.existsSync(templateFilename)) {
      return templateFilename // all good, return result
    }

    // no go, use application default
    template = ''
    templateFilename = ''

    if (template.length === 0) {
      // get default template, it will be overridden if project template exists
      template = path.join(__dirname, '../..', this.config(`templates.${configTemplate}`))

      const projectConfigData = this.getProjectConfig()
      if (projectConfigData?.templates && projectConfigData.templates?.[configTemplate]) {
        templateFilename = projectConfigData.templates[configTemplate].replace('<project>', process.cwd())
        if (toolbox.filesystem.existsSync(templateFilename)) {
          template = templateFilename
        }
      }
    }
    return path.resolve(template)
  },

  getAppTemplatePath: function () {
    const templatePath = this.config('app.templatePath')
    if (templatePath === 'default') {
      return path.join(__dirname, '../..', 'templates')
    }
    return path.resolve(templatePath)
  },

  shortenFilename(filename) {
    return filename.replace(process.cwd(), '~')
  },

  createFile(data = null) {
    toolbox.filesystem.mkdirSync(path.dirname(data.dest), { recursive: true })
    return toolbox.template.mergeFile(data.template, data.dest, data, {
      overwrite: true,
    })
  },

  getOptionData(toolbox, command) {
    // eslint-disable-next-line
    let data = {}
    // eslint-disable-next-line
    for (const [key, value] of Object.entries(command.flags)) {
      if (key !== 'template') {
        let names = [key]
        if (command.flags[key]?.aliases) {
          names = names.concat(command.flags[key].aliases)
        }
        const defaultValue = command.flags[key]?.default ? command.flags[key].default : false
        const result = toolbox.getOptionValue(toolbox.arguments, names, defaultValue)
        data[key] = result
      }
    }
    return data
  },

  getOptionValue(args = null, options = null, key = null, defaultValue = null) {
    let flags = [key]
    if (options.hasOwnProperty(key) && options[key].hasOwnProperty('aliases')) {
      flags = flags.concat(options[key].aliases)
    }

    return this.getOptionValueEx(args, flags, defaultValue)
  },

  argumentHasOption(args, needles) {
    if (typeof args === 'undefined') {
      toolbox.print.error('Invalid Arguments')
      return false
    }

    if (typeof needles === 'undefined') {
      toolbox.print.error('Invalid Option Value')
      return false
    }

    const items = typeof needles === 'string' ? needles.split(',') : needles

    for (let i = 0; i < items.length; i++) {
      if (items[i] === undefined) {
        return false
      }
      const element = items[i].replace(/-/gi, '')
      if (args.hasOwnProperty(element)) {
        return true
      }
    }
    return false
  },

  getOptionValueEx(args, optName, defaultValue = null) {
    if (this.argumentHasOption(args, optName)) {
      const options = typeof optName === 'string' ? [optName] : optName
      for (let i = 0; i < options.length; i++) {
        const option = options[i].replace(/-/gi, '')
        if (args.hasOwnProperty(option)) {
          return args[option]
        }
      }
      return defaultValue
    }
    return defaultValue
  },

  createParentDirectories(dir = null) {
    filesystem.mkdirSync(dir, { recursive: true })
  },

  getBuild() {
    const pkgInfo = path.resolve(this.getAppPath(), 'package.json')

    if (pkgInfo?.build) {
      return pkgInfo.build
    }
    return ''
  },

  getVersion() {
    const pkgFilename = path.join(this.getAppPath(), 'package.json')
    const pkgInfo = require(pkgFilename)

    return `v${pkgInfo.version}`
  },

  verifyTemplate(templatePath = null) {
    if (templatePath) {
      return true
    }
    return false
  },

  success(toolbox = null, response = null) {
    const quiet = toolbox.getOptionValue(toolbox.arguments, ['quiet', 'q']) || false
    const fullpath = toolbox.getOptionValue(toolbox.arguments, ['fullpath']) || false

    !quiet ? console.log('') : null
    const filename = fullpath ? response.dest : response.shortFilename
    !quiet ? toolbox.print.success(`${filename} Created Successfully\n`, 'SUCCESS') : null
  },

  error(toolbox = null, response = null) {
    const quiet = toolbox.getOptionValue(toolbox.arguments, ['quiet', 'q']) || false
    const fullpath = toolbox.getOptionValue(toolbox.arguments, ['fullpath']) || false

    !quiet ? console.log('') : null
    const filename = fullpath ? response.dest : response.shortFilename
    !quiet ? toolbox.print.error(`${filename} Already Exists\n`, 'ERROR') : null
  },

  getRequiredArguments(command) {
    const requiredArguments = []

    const flags = (command?.flags && Object.keys(command.flags)) || []
    flags.forEach((flag) => {
      command.flags[flag]?.required && command.flags[flag].required ? requiredArguments.push(flag) : null
    })

    return requiredArguments
  },

  hasRequiredArguments(command = null, result = null) {
    let matches = 0

    const requiredArguments = this.getRequiredArguments(command)
    const resultKeys = Object.keys(result)

    requiredArguments.forEach((requiredArgument) => {
      if (resultKeys.includes(requiredArgument)) {
        matches++
      }
    })

    return matches === requiredArguments.length
  },

  async execute(toolbox, command) {
    const args = helpers.getArguments(toolbox.arguments, command.flags)

    const answers = command.usePrompts ? await toolbox.prompts.run(toolbox, command) : {}
    const result = { ...args, ...answers }

    // if user did not supply resource name, it will be supplied via prompt
    if (toolbox.commandName === '') {
      this.logToFile(command.name, result.commandName, result)
    }

    const hasRequiredArguments = this.hasRequiredArguments(command, result)
    const commandName = toolbox.commandName || result.commandName

    if (!commandName || !hasRequiredArguments) {
      console.log('')
      toolbox.print.warning('Command Aborted\n', 'ABORT')
      process.exit()
    } else {
      toolbox.commandName = commandName // update toolbox, it will be used when creating files
    }

    return result
  },

  executeSubCommand(cmd = null) {
    if (cmd) {
      try {
        // eslint-disable-next-line
        const result = system.run(cmd, true)
      } catch (error) {
        console.log('')
        print.error('An error occurred executing command', 'ERROR')
        print.log(`        ${cmd}`)
        console.log('')
      }
    }
  },

  run(cmd = null) {
    execa('noteplan-cli', [cmd, '--help'], {
      env: { FORCE_COLOR: 'true' },
    }).then((data) => console.log(data.stdout))
  },

  getLogDirectory(args, defaultLocation = 'system') {
    const logDir = args?.logDir || args?.['log-dir'] ? args.logDir || args['log-dir'] : defaultLocation
    return logDir.length > 0 ? logDir : defaultLocation
  },

  logToFile(command, resource, args = {}) {
    if (!args.log) {
      return
    }

    let cmd = ''
    Object.keys(args).forEach((item) => {
      if (item !== 'anonymous' && item !== 'sub' && item !== 'log' && item !== 'commandName' && item.length > 1) {
        if (args[item]) {
          cmd += typeof args[item] === 'boolean' ? `-- ${item} ` : `--${item} ${args[item]} `
        }
      }
    })
    cmd = `${command} ${resource} ${cmd}`.trim()

    Messenger.initLogger(false, this.getLogDirectory(args, 'system'), 'laravel-craftsman-2')
    Messenger.loggerLog(cmd)
  },

  errorMessage(response = {}) {
    const message = response?.message ? response.message : 'An Error Occurred'
    print.error(message, 'ERROR')
    if (response.hasOwnProperty('args')) {
      response.args.forEach((arg) => {
        print.warn(`        ${arg}`)
      })
    }
  },

  successMessage(response = {}) {
    const message = response?.message ? response.message : 'Process Completed Successfully'
    print.success(message, 'SUCCESS')
    if (response.hasOwnProperty('args')) {
      response.args.forEach((arg) => {
        print.debug(`          ${arg}`)
      })
    }
  },
}
