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
const releaseManagement = require('./release-management')

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

// Removed buildDeleteCommands - no longer automatically deleting releases

module.exports = {
  run: async (pluginId = '', pluginName = '', pluginVersion = '', args = {}) => {
    const runTests = false
    const runBuild = !args?.noBuild
    const deletePrevious = !args?.noDelete
    const preview = args?.preview
    const testRunner = `./node_modules/.bin/jest`
    const testCommand = ['run', 'test:dev', `${pluginId}/__tests__/*.test.js`]
    const buildCommand = ['run', 'build:minified', pluginId]

    if (args.preview) {
      print.info('Plugin Release Preview Mode')
      console.log('')
    }

    const tasks = new Listr(
      [
        {
          title: 'Validating plugin files and structure',
          skip: () => {
            if (preview) {
              return `[Preview] validate plugin files and structure`
            }
          },
          task: () => prerequisiteTasks(pluginId, args),
        },
        {
          title: 'Checking GitHub authentication and repository status',
          skip: () => {
            if (preview) {
              return `[Preview] check GitHub auth and repo status`
            }
          },
          task: () => gitTasks(pluginId, args),
        },
      ],
      {
        renderer: 'default',
        nonTTYRenderer: 'verbose',
        collapse: false,
        clearOutput: true,
        showSubtasks: false,
      },
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

    // Always check release history and show pruning recommendations
    tasks.add([
      {
        title: 'Checking release history',
        skip: () => {
          if (args.preview) {
            return `[Preview] Show pruning recommendations`
          }
        },
        task: async () => {
          // Collect release information but don't display it yet (to avoid interfering with Listr)
          const releases = await releaseManagement.getExistingReleases(pluginId)
          // Store the release info for display after Listr completes
          return { releases, pluginId }
        },
      },
    ])

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
          // dbw commenting this out 2024-07-17 because releasing was sometimes failing
          // not sure if this will have unintended consequences -- we shall see! :)
          // if (cmd.includes(`gh release create "${pluginId}-v${pluginVersion}" -t "${pluginName}" -F`)) {
          const result = await system.run(cmd, true)
          // }
        },
      },
    ])

    // Store release info to display after Listr completes
    let releaseInfo = null

    // Override the release history task to capture the data
    const originalTasks = tasks._tasks
    const releaseHistoryTask = originalTasks.find((task) => task.title === 'Checking release history')
    if (releaseHistoryTask) {
      const originalTask = releaseHistoryTask.task
      releaseHistoryTask.task = async () => {
        const releases = await releaseManagement.getExistingReleases(pluginId)
        releaseInfo = { releases, pluginId }
        return { releases, pluginId }
      }
    }

    const result = await tasks.run()

    // Now display the release information after Listr has completed
    if (releaseInfo) {
      const { releases, pluginId: resultPluginId } = releaseInfo
      if (releases && releases.length > 0) {
        console.log('')
        print.note(`Found ${releases.length} existing release(s) for plugin "${resultPluginId}":`)

        // Get pruning recommendations
        const releasesToPrune = releases.length > 3 ? releaseManagement.identifyReleasesToPrune(releases) : []
        const pruneTags = new Set(releasesToPrune.map((r) => r.tag))

        releases.forEach((release, index) => {
          const publishedDate = new Date(release.publishedAt).toLocaleDateString()
          const relativeTime = releaseManagement.getRelativeTime(release.publishedAt)
          const shouldPrune = pruneTags.has(release.tag)
          const pruneIndicator = shouldPrune ? ` ${colors.red('--PRUNE?')}` : ''

          print.log(`  ${index + 1}. ${colors.cyan(release.tag)} (version ${release.version}, published ${publishedDate} -- ${relativeTime})${pruneIndicator}`)
        })

        if (releasesToPrune.length > 0) {
          console.log('')
          print.log(colors.cyan(releaseManagement.generatePruneCommands(releasesToPrune)))
          console.log('')
        } else if (releases.length <= 3) {
          print.note(`Plugin has ${releases.length} releases (≤3), no pruning recommendations`)
        }
      } else {
        print.note('No existing releases found for this plugin')
      }
    }

    console.log('')
    if (preview) {
      print.note(`${pluginId} v${pluginVersion} Released Successfully [PREVIEW]`, 'PREVIEW')
    } else {
      print.success(`${pluginId} ${pluginVersion} Released Successfully`, 'SUCCESS')
    }
  },
}
