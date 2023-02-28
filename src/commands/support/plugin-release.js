/* eslint-disable no-unused-vars */

'use strict'

import util from 'util' // eslint-disable-line
/* eslint-disable */
import { filesystem, colors, print, path, system, prompt, strings, api as http } from '@codedungeon/gunner'
const { ListPrompt } = import('inquirer/lib/prompts/list')
import Listr from 'listr'
import split from 'split'
import execa from 'execa'
import { merge, throwError } from 'rxjs'
import { catchError, filter } from 'rxjs/operators'
import streamToObservable from '@samverschueren/stream-to-observable'
import pluginUtils from './plugin-utils'
import github from './github'

import prerequisiteTasks from './plugin-release/prerequisite-tasks'
import gitTasks from './plugin-release/git-tasks'
import updateVersionTasks from './plugin-release/update-version-tasks'
import releaseTasks from './plugin-release/release-tasks'
import releasePrompts from './plugin-release/release-prompts'

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
