// NOTE: You cannot use flow on this file. Must be pure JS.
// Use JSDOC for type annotations.

const TEST = true // when set to true, doesn't actually create or delete anything. Just a dry run
const COMMAND = 'Plugin Release'

// $FlowIgnore
const fs = require('fs/promises')
const path = require('path')
const colors = require('chalk')
const Messenger = require('@codedungeon/messenger')

const { program } = require('commander')
const { getFolderFromCommandLine, runShellCommand, getPluginFileContents, fileExists, getCopyTargetPath } = require('./shared')

// Command line options
program.option('-d, --debug', 'Rollup: allow for better JS debugging - no minification or transpiling')
program.parse(process.argv)

// const options = program.opts() //see rollup.js for how to add command line options
// const DEBUGGING = Boolean(options.debug) | false

const installInstructions = `

${colors.yellow(
  `Getting Started
===============

In order to create a public release on the NotePlan github repository, you will need to obtain proper permissions on the github repository from @eduardme.
So get that sorted out before moving any further. More than likely, you'll simply want to create a Pull Request for your plugin code to the NotePlan/plugins repository
and get it reviewed so someone can create a release to get it out to the community.`,
)}

If you have necessary permissions to create a release, then here's the next step:\n
- In order to do releases from the command line, you need the "gh" command line tool from github.
  The following commands should get you up and running.
${colors.cyan.italic(
  `
  Note: the first two commands may take awhile (5 minutes each) to run:
  `,
)}
  git -C /usr/local/Homebrew/Library/Taps/homebrew/homebrew-core fetch --unshallow
  git -C /usr/local/Homebrew/Library/Taps/homebrew/homebrew-cask fetch --unshallow
  brew update
  brew install gh
  gh auth login

  Actions/Prompts:

   [ Select: Github.com > HTTPS > Yes Credentials > Login with web browser ]
   [ Log in using your github account and press Enter ]
   [ copy the OTP code from command line ]
   [ Paste OTP code in browser window ]

 If the above doesn't work for you, check out the detailed instructions from github:
  - https://github.com/cli/cli#installation

- Once you have "gh" installed and you have received access to repository, come back here to run the command again!
`
if (TEST) {
  Messenger.warn('Creating draft release (which should be deleted) and not deleting existing release without permission', 'TEST MODE')
  console.log('')
}

/**
 * Extract plugin name from tag (removes version suffix like -v1.0.0)
 * @param {string} tagName - The full tag name (e.g., "dwertheimer.TaskAutomations-v1.0.0")
 * @returns {string} - The plugin name without version (e.g., "dwertheimer.TaskAutomations")
 */
function extractPluginNameFromTag(tagName) {
  // Remove version suffix pattern like -v1.0.0, -v1.0, -v1, etc. including pre-release versions
  return tagName.replace(/-v\d+(\.\d+)*(\.\d+)*(?:-[a-zA-Z0-9.-]+)?$/, '')
}

/**
 * Extract version from tag
 * @param {string} tagName - The full tag name (e.g., "dwertheimer.TaskAutomations-v1.0.0")
 * @returns {string|null} - The version number (e.g., "1.0.0")
 */
function extractVersionFromTag(tagName) {
  const match = tagName.match(/-v(\d+(?:\.\d+)*(?:\.\d+)*(?:-[a-zA-Z0-9.-]+)?)$/)
  return match ? match[1] : null
}

/**
 * Get all existing releases for a specific plugin
 * @param {string} pluginName - The plugin name to search for
 * @returns {Promise<Array<{name: string, tag: string, version: string, publishedAt: string}> | null>}
 */
async function getExistingReleases(pluginName) {
  const limit = 1000
  const command = `gh release list --limit ${limit} --json tagName,publishedAt`
  console.log('')
  Messenger.info(`==> ${COMMAND}: Getting full release list from github.com`)

  const releasesJson = await runShellCommand(command)

  if (!releasesJson || releasesJson.trim() === '') {
    console.log(`==> ${COMMAND}: Did not find pre-existing releases.`)
    return null
  }

  try {
    const releases = JSON.parse(releasesJson)
    Messenger.info(`==> ${COMMAND}: Found ${releases.length} total releases. Searching for releases matching plugin: "${pluginName}"`)

    // Filter releases that match this plugin name
    const pluginReleases = releases
      .map((release) => {
        const pluginNameFromTag = extractPluginNameFromTag(release.tagName)
        const version = extractVersionFromTag(release.tagName)

        return {
          name: pluginNameFromTag,
          tag: release.tagName,
          version: version,
          publishedAt: release.publishedAt,
        }
      })
      .filter((release) => release.name === pluginName && release.version !== null)
      .sort((a, b) => new Date(b.publishedAt).getTime() - new Date(a.publishedAt).getTime()) // Sort by published date, newest first

    if (pluginReleases.length === 0) {
      Messenger.log(
        `==> ${COMMAND}: Did not find any pre-existing releases that matched the pattern for this plugin folder: "${pluginName}" on github.\
        \nThat's ok if this is the first release. Or it could be that a pre-existing release did not match this naming convention.`,
      )
      return null
    }

    Messenger.note(`==> ${COMMAND}: Found ${pluginReleases.length} existing release(s) for plugin "${pluginName}":`)
    pluginReleases.forEach((release, index) => {
      Messenger.log(`  ${index + 1}. ${colors.cyan(release.tag)} (version ${release.version}, published ${new Date(release.publishedAt).toLocaleDateString()})`)
    })

    return pluginReleases
  } catch (error) {
    Messenger.error(`==> ${COMMAND}: Error parsing releases JSON: ${error.message}`)
    return null
  }
}

/**
 * Generate release tag name from plugin name and version
 * @param {string} pluginName - The plugin name
 * @param {string} version - The version number
 * @returns {string} - The formatted tag name
 */
function getReleaseTagName(pluginName, version) {
  return `${pluginName}-v${version}`
}

/**
 * Get a field value from plugin data
 * @param {Object} pluginData - The plugin data object
 * @param {string} field - The field name to retrieve
 * @returns {*} - The field value
 */
function getPluginDataField(pluginData, field) {
  if (!pluginData || typeof pluginData !== 'object') {
    console.log(`Could not find value for "${field}" in plugin.json`)
    process.exit(0)
  }
  const data = pluginData[field] || null
  if (!data) {
    console.log(`Could not find value for "${field}" in plugin.json`)
    process.exit(0)
  }
  return data
}

/**
 * Get the list of files to include in the release
 * @param {string} pluginDevDirFullPath - Path to the plugin development directory
 * @param {string} appPluginsPath - Path to the app plugins directory
 * @param {Array<string>} dependencies - Array of dependency file names
 * @returns {Promise<{changelog: string|null, files: Array<string>}|null>} - File list object or null if error
 */
// eslint-disable-next-line no-unused-vars
async function getReleaseFileList(pluginDevDirFullPath, appPluginsPath, dependencies) {
  let goodToGo = true
  const fileList = { changelog: null, files: [] }
  const filesInPluginFolder = await fs.readdir(pluginDevDirFullPath, {
    withFileTypes: true,
  })
  const fileLowerMatch = (str) => filesInPluginFolder.filter((f) => f.name.toLowerCase() === str)
  const existingFileName = (lowercaseName) => {
    const match = fileLowerMatch(lowercaseName)
    if (match.length) {
      return match[0].name
    } else {
      return null
    }
  }
  const fullPath = (name) => path.join(pluginDevDirFullPath, name)

  let name
  if ((name = existingFileName('changelog.md'))) {
    //$FlowFixMe - see note above
    fileList.changelog = fullPath(name)
  } else {
    if ((name = existingFileName('readme.md'))) {
      //$FlowFixMe - see note above
      fileList.changelog = fullPath(name)
    } else {
      Messenger.note(`==> ${COMMAND}: Missing ${colors.cyan('CHANGELOG.md')} or ${colors.cyan('README.md')} in ${pluginDevDirFullPath}`)
    }
  }
  // Grab the minified/cleaned version of the plugin.json file
  // Commenting out: Does not work. JSON5 adds commas that NP doesn't like
  // const pluginInAppPluginDirectory = path.join(appPluginsPath, 'plugin.json')
  // if (fileExists(pluginInAppPluginDirectory)) {
  //   fileList.files.push(`${pluginInAppPluginDirectory}`)
  // }
  if ((name = existingFileName('plugin.json'))) {
    fileList.files.push(fullPath(name))
  } else {
    goodToGo = false
    console.log('no plugin.json found')
  }
  if ((name = existingFileName('script.js'))) {
    fileList.files.push(fullPath(name))
  } else {
    goodToGo = false
    console.log('no script.js found')
  }
  if ((name = existingFileName('readme.md'))) {
    fileList.files.push(fullPath(name))
  }
  const dependendenciesPath = path.join(pluginDevDirFullPath, 'requiredFiles')
  for (const dependency of dependencies) {
    const dependencyFile = path.join(dependendenciesPath, dependency)
    if (await fileExists(dependencyFile)) {
      fileList.files.push(dependencyFile)
    } else {
      goodToGo = false
      console.log(`no "${dependency}" file found in "${dependendenciesPath}"`)
    }
  }

  // console.log(`>> Releases fileList:\n${JSON.stringify(fileList)}`)
  if (fileList.files.length < 2) goodToGo = false
  if (goodToGo === false) {
    console.log(
      colors.red(
        `>> Releases: ERROR. ABORTING: Encountered errors in creating the release. Minimum 2 files required are: plugin.json and script.js. Here are the files I found:\n${JSON.stringify(
          fileList,
        )}`,
      ),
    )
    return null
  } else {
    return fileList
  }
}

/**
 * Display error message for wrong arguments
 * @param {*} limitToFolders - The folders that were passed as arguments
 */
function wrongArgsMessage(limitToFolders) {
  console.log(`==> ${COMMAND}: ${limitToFolders ? String(limitToFolders.length) : ''} file(s): ${JSON.stringify(limitToFolders) || ''}`)
  console.log(colors.red(`\nERROR:\n Invalid Arguments (you may only release one plugin at a time)`), colors.yellow(`\n\nUsage:\n npm run release "dwertheimer.dateAutomations"`))
}

/**
 * Ensure the version being released is new and not a duplicate
 * @param {Array<{name: string, tag: string, version: string, publishedAt: string}>|null} existingReleases - Array of existing releases
 * @param {string} versionedTagName - The new version tag name to check
 */
function ensureVersionIsNew(existingReleases, versionedTagName) {
  if (existingReleases && existingReleases.length > 0 && versionedTagName) {
    const duplicateRelease = existingReleases.find((release) => release.tag === versionedTagName)
    if (duplicateRelease) {
      Messenger.note(
        `==> ${COMMAND}: Found existing release with tag name: ${colors.cyan(versionedTagName)}, which matches the version number in your ${colors.cyan('plugin.json')}`,
      )
      Messenger.error(
        `    New releases must contain a unique name/tag. Update ${colors.magenta('plugin.version')} in ${colors.cyan('plugin.json, CHANGELOG.md or README.md')} and try again.`,
      )
      console.log('')
      const testMessage = TEST ? '(Test Mode)' : ''
      Messenger.error(`${COMMAND} Failed ${testMessage} (duplicate version)`, 'ERROR')
      process.exit(0)
    }
  }
}

/**
 * Generate the GitHub release command
 * @param {string} version - The version tag
 * @param {string} pluginTitle - The plugin title
 * @param {Object} fileList - Object containing changelog and files
 * @param {boolean} [sendToGithub=false] - Whether to actually send to GitHub
 * @returns {string} - The release command
 */
function getReleaseCommand(version, pluginTitle, fileList, sendToGithub = false) {
  const changeLog = fileList.changelog ? `-F "${fileList.changelog}"` : ''
  const cmd = `gh release create "${version}" -t "${pluginTitle}" ${changeLog} ${!sendToGithub ? `--draft` : ''} ${fileList.files.map((m) => `"${m}"`).join(' ')}`

  if (!sendToGithub) {
    console.log(`==> ${COMMAND}: Release command:\n\t${cmd}\n\nYou can run that by hand. The script is not doing it in TEST mode.\n`)
  }
  return cmd
}

/**
 * Generate the GitHub release delete command
 * @param {string} version - The version tag to delete
 * @param {boolean} [sendToGithub=false] - Whether to actually send to GitHub
 * @returns {string} - The delete command
 */
function getRemoveCommand(version, sendToGithub = false) {
  const cmd = `gh release delete "${version}" ${sendToGithub ? `` : '-y'}` // -y removes the release without prompting
  if (!sendToGithub) {
    console.log(`==> ${COMMAND}: Pre-existing release remove command:\n\t${cmd}\n\nYou can run that by hand. The script is not doing it in TEST mode.\n`)
  }
  return cmd
}

/**
 * Release a plugin to GitHub
 * @param {string} versionedTagName - The versioned tag name for the release
 * @param {Object} pluginData - The plugin data object
 * @param {Object} fileList - Object containing changelog and files
 * @param {boolean} [sendToGithub=false] - Whether to actually send to GitHub
 */
async function releasePlugin(versionedTagName, pluginData, fileList, sendToGithub = false) {
  const pluginTitle = getPluginDataField(pluginData, 'plugin.name')
  const releaseCommand = getReleaseCommand(versionedTagName, pluginTitle, fileList, sendToGithub)

  if (sendToGithub) {
    if (releaseCommand) {
      console.log(`>>Release: Creating release "${versionedTagName}" on github...`)
      const resp = await runShellCommand(releaseCommand)
      console.log(`==> ${COMMAND}: New release posted (check on github):\n\t${JSON.stringify(resp.trim())}`)
    }
  }
}

/**
 * Remove a plugin release from GitHub
 * @param {string} versionedTagName - The versioned tag name to remove
 * @param {boolean} [sendToGithub=false] - Whether to actually send to GitHub
 */
async function _removePlugin(versionedTagName, sendToGithub = false) {
  const removeCommand = getRemoveCommand(versionedTagName, sendToGithub)
  if (sendToGithub) {
    if (removeCommand) {
      console.log(`==> ${COMMAND}: Removing previous version "${versionedTagName}" on github...`)
      // eslint-disable-next-line no-unused-vars
      const resp = await runShellCommand(removeCommand)
      // console.log(`...response: ${JSON.stringify(resp.trim())}`)
    }
  }
}

/**
 * Check if GitHub CLI (gh) is installed
 */
async function checkForGh() {
  if (!((await fileExists(`/usr/local/bin/gh`)) || (await fileExists(`/opt/homebrew/bin/gh`)))) {
    console.log(`${colors.red('==> ${COMMAND}: ERROR: Could not find "gh" command.')}\n${installInstructions}`)
    process.exit(0)
  }
}

/**
 * Main function to handle plugin release process
 */
async function main() {
  await checkForGh()
  const rootFolderPath = path.join(__dirname, '..')
  const rootFolderDirs = await fs.readdir(rootFolderPath, {
    withFileTypes: true,
  })
  const limitToFolders = await getFolderFromCommandLine(rootFolderPath, program.args)

  if (limitToFolders.length === 1) {
    const pluginName = limitToFolders[0]
    const pluginDevDirFullPath = path.join(rootFolderPath, pluginName)
    const existingReleases = await getExistingReleases(pluginName)
    const pluginData = await getPluginFileContents(path.join(pluginDevDirFullPath, 'plugin.json'))
    const versionNumber = getPluginDataField(pluginData, 'plugin.version')
    const copyTargetPath = await getCopyTargetPath(rootFolderDirs)
    const fileList = await getReleaseFileList(pluginDevDirFullPath, path.join(copyTargetPath, pluginName), pluginData['plugin.requiredFiles'] || [])

    if (fileList) {
      const versionedTagName = getReleaseTagName(pluginName, versionNumber)
      // console.log(`==> ${COMMAND}: This version/tag will be:\n\t${versionedTagName}`)
      ensureVersionIsNew(existingReleases, versionedTagName)
      await releasePlugin(versionedTagName, pluginData, fileList, !TEST)

      // Note: We no longer automatically remove previous releases - they are kept for history
      // The user can manually prune old releases if needed in a future step

      const newReleaseList = await getExistingReleases(pluginName)
      if (newReleaseList && newReleaseList.some((release) => release.tag === versionedTagName)) {
        Messenger.success(`Release Completed Successfully. "${versionedTagName}" has been published.`, 'SUCCESS')
        if (newReleaseList.length > 1) {
          Messenger.note(`Plugin now has ${newReleaseList.length} total releases. Previous releases are preserved for history.`)
        }
      } else {
        Messenger.error(`^^^ Something went wrong. Please check log ^^^`, 'ERROR')
      }
    }
  } else {
    wrongArgsMessage()
  }
}

// Run the main function
main().catch(console.error)
