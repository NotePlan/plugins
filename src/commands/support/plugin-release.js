/* eslint-disable no-unused-vars */

'use strict'

const util = require('util') // eslint-disable-line
/* eslint-disable */
const { filesystem, colors, print, path, system, prompt, strings, api: http } = require('@codedungeon/gunner')
const ListPrompt = require('inquirer/lib/prompts/list')
const Listr = require('listr')
const split = require('split')
const execa = require('execa')
const { merge, throwError } = require('rxjs')
const { catchError, filter } = require('rxjs/operators')
const streamToObservable = require('@samverschueren/stream-to-observable')
const pluginUtils = require('./plugin-utils')
const github = require('./github')

const prerequisiteTasks = require('./plugin-release/prerequisite-tasks')
const gitTasks = require('./plugin-release/git-tasks')
const updateVersionTasks = require('./plugin-release/update-version-tasks')
const releaseTasks = require('./plugin-release/release-tasks')
const releasePrompts = require('./plugin-release/release-prompts')
const scriptGrep = require('./plugin-release/script-grep')

const exec = (cmd, args) => {
  const cp = execa(cmd, args)

  return merge(streamToObservable(cp.stdout.pipe(split())), streamToObservable(cp.stderr.pipe(split())), cp).pipe(filter(Boolean))
}

const buildDeleteCommands = async (pluginId = '', currentVersion = '') => {
  const deleteCommands = []

  const api = http.create({
    baseURL: 'https://api.github.com',
    headers: { Accept: 'application/vnd.github.v3+json' },
  })

  const releases = await api.get('repos/NotePlan/plugins/releases')
  if (releases.data.length > 0) {
    releases.data.forEach((release) => {
      const tag = release.tag_name
      if (tag.includes(pluginId) && !tag.includes(currentVersion)) {
        const version = tag.replace(pluginId, '').replace('-v', '')
        deleteCommands.push(`gh release delete "${pluginId}-v${version}" -y`)
      }
    })
  }

  return deleteCommands
}

module.exports = {
  run: async (pluginId = '', pluginName = '', pluginVersion = '', args = {}) => {
    const runTests = false
    const runBuild = !args?.noBuild
    const deletePrevious = !args?.noDelete
    const preview = args?.preview
    const testRunner = `./node_modules/.bin/jest`
    const testCommand = ['run', 'test:dev', `${pluginId}/__tests__/*.test.js`]
    const buildCommand = ['run', 'build', pluginId]

    if (args.preview) {
      print.info('Plugin Release Preview Mode')
      console.log('')
    }

    const tasks = new Listr(
      [
        {
          title: 'Prerequisite check',
          skip: () => {
            if (preview) {
              return `[Preview] all validation`
            }
          },
          task: () => prerequisiteTasks(pluginId, args),
        },
        {
          title: 'Github check',
          skip: () => {
            if (preview) {
              return `[Preview] github tasks`
            }
          },
          task: () => gitTasks(pluginId, args),
        },
      ],
      { showSubtaks: true },
    )

    tasks.add([
      {
        title: 'Updating version',
        skip: () => {
          if (args.preview) {
            return `[Preview] update version ${pluginId} ${pluginVersion}`
          }
        },
        task: () => {
          const result = updateVersionTasks(pluginId, pluginVersion)
        },
      },
    ])

    if (runTests) {
      tasks.add([
        {
          title: 'Running tests',
          enabled: () => {
            return true
          },
          skip: () => {
            if (preview) {
              return `[Preview] npm run test:dev ${pluginId}`
            }
          },
          task: () =>
            exec('npm', testCommand).pipe(
              catchError(async (error) => {
                console.log(error.stderr)
                console.log('')
                print.error('Testing failed, release aborted', 'ERROR')
                print.error(error)
                process.exit()
                return throwError(error)
              }),
            ),
        },
      ])
    }

    if (runBuild) {
      tasks.add([
        {
          title: 'Building release',
          enabled: () => {
            return true
          },
          skip: () => {
            if (preview) {
              return `[Preview] npm run build ${pluginId}`
            }
          },
          task: async () => {
            exec('npm', buildCommand).pipe(
              catchError(async (error) => {
                console.log(error.stderr)
                console.log('')
                print.error('Build failed, release aborted', 'ERROR')
                process.exit()
                return throwError(error)
              }),
            )
            // check to make sure we're not trying to release with fetch mocks still enabled
            const pluginPath = path.resolve(pluginId)
            const scriptFilename = path.join(pluginPath, 'script.js')
            if (await scriptGrep.existsInFile(scriptFilename, 'FetchMock')) {
              const error = `Fetch Mocks are not allowed in the script.js file during releases. Please remove it and try again.`
              print.error(error)
              process.exit()
              // return throwError(new Error(error))
            }
          },
        },
      ])
    }

    if (deletePrevious) {
      tasks.add([
        {
          title: 'Deleting previous releases',
          skip: async () => {
            const cmds = await buildDeleteCommands(pluginId, pluginVersion)
            if (args.preview) {
              return `[Preview] ${(await cmds).join(', ')}`
            }
          },
          task: async () => {
            const cmds = await buildDeleteCommands(pluginId, pluginVersion)
            if (cmds.length > 0) {
              cmds.forEach(async (cmd) => {
                const result = await system.run(cmd, true)
              })
            }
          },
        },
      ])
    }

    tasks.add([
      {
        title: 'Publishing release',
        skip: async () => {
          const cmd = await releaseTasks(pluginId, pluginVersion, args)
          if (args.preview) {
            return `[Preview] ${cmd}`
          }
        },
        task: async () => {
          const cmd = await releaseTasks(pluginId, pluginVersion, args)
          if (cmd.includes(`gh release create "${pluginId}-v${pluginVersion}" -t "${pluginName}" -F`)) {
            const result = await system.run(cmd, true)
          }
        },
      },
    ])

    const result = await tasks.run()
    console.log('')
    if (preview) {
      print.note(`${pluginId} v${pluginVersion} Released Successfully [PREVIEW]`, 'PREVIEW')
    } else {
      print.success(`${pluginId} ${pluginVersion} Released Successfully`, 'SUCCESS')
    }
  },
}
