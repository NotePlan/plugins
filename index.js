#!/usr/bin/env node

const { CLI } = require('@codedungeon/gunner')
const colors = require('chalk')
const parseArgs = require('minimist')

const appUtils = require('./src/utils/app')
const pkgInfo = require('./package.json')

const options = [
  // {
  //   option: 'overwrite, -o',
  //   description: 'Overwrite Existing Files(s) if creating in command',
  // },
  // {
  //   option: 'template, -t',
  //   description: 'Template path (override default template)',
  // },
]

const getLogDirectory = (argv, defaultLocation = 'system') => {
  const logDir = parseArgs(argv)['logDir'] || parseArgs(argv)['log-dir'] || ''
  return logDir.length > 0 ? logDir : defaultLocation
}

new CLI(process.argv, __dirname)
  .usage(`${pkgInfo.packageName} ${colors.magenta('<resource>')} ${colors.cyan('[options]')}`)
  .options(options)
  .version(/* version string override, if not supplied default version info will be displayed */)
  .examples(
    /* if not called, examples will be suppressed in help dialog */
    [
      `noteplan-cli plugin:create ${colors.gray('(creates noteplan plugin project)')}`,
      `  noteplan-cli plugin:info ${colors.gray('(show information about current plugins)')}`,
      `  noteplan-cli plugin:info --check formatted ${colors.gray(
        '(checks to see if "formatted" command is available to use)',
      )}`,
    ].join('\n'),
  )
  .logger({ directory: getLogDirectory(process.argv), alwaysLog: true })
  .hooks({
    beforeExecute: (toolbox, command = '', args = {}) => {
      toolbox.print.write('debug', {
        hook: 'beforeExecute',
        command,
        args,
        cwd: process.cwd(),
      })
    },
    afterExecute: (toolbox, command = '', args = {}) => {
      toolbox.print.write('debug', { hook: 'afterExecute', command, args })
    },
    commandPrefix: 'make:',
  })
  .run()
