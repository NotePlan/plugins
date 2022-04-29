'use strict'

const util = require('util')
const { filesystem, colors, print, path, system, prompt, strings } = require('@codedungeon/gunner')
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

const exec = (cmd, args) => {
  const cp = execa(cmd, args)

  return merge(streamToObservable(cp.stdout.pipe(split())), streamToObservable(cp.stderr.pipe(split())), cp).pipe(filter(Boolean))
}

module.exports = {
  run: async (pluginId = '', pluginVersion = '', args = {}) => {
    // const runTests = !args?.noTests
    const runTests = false
    const runBuild = !args?.noBuild
    const preview = args?.preview
    const testRunner = `./node_modules/.bin/jest`
    const testCommand = ['run', 'test:dev', `${pluginId}/__tests__/*.test.js`]
    const buildCommand = ['run', 'build', pluginId]
    console.log(testCommand)
    if (args.preview) {
      print.info('Preview Mode')
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
          title: 'Buliding release',
          enabled: () => {
            return true
          },
          skip: () => {
            if (preview) {
              return `[Preview] npm run build ${pluginId}`
            }
          },
          task: () =>
            exec('npm', buildCommand).pipe(
              catchError(async (error) => {
                console.log(error.stderr)
                console.log('')
                print.error('Build failed, release aborted', 'ERROR')
                process.exit()
                return throwError(error)
              }),
            ),
        },
      ])
    }

    tasks.add([
      {
        title: 'Publishing release',
        skip: async () => {
          const cmd = await releaseTasks(pluginId, pluginVersion, args)
          if (args.preview) {
            return cmd
          }
        },
        task: async () => {
          const cmd = await releaseTasks(pluginId, pluginVersion, args)
          if (cmd.includes(`gh release create "${pluginVersion}" -t "${pluginId}" -F`)) {
            const result = await system.run(cmd, true)
            console.log(result)
          }
        },
      },
    ])

    const result = await tasks.run()
    console.log('')
    if (preview) {
      print.note(`${pluginId} ${pluginVersion} [PREVIEW] Released Successfully`, 'PREVIEW')
    } else {
      print.success(`${pluginId} ${pluginVersion} Released Successfully`, 'SUCCESS')
    }
  },
}
