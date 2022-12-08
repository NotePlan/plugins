// @flow
/* eslint-disable */

const TEST = false // when set to true, doesn't actually create or delete anything. Just a dry run
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
 *
 * @param {string} pluginFullPath
 * @returns {Promise<{name:string,tag:string} | null>
 */
async function getExistingRelease(pluginName) {
  // const command = `gh release upload --clobber "dwertheimer.TaskAutomations" /tmp/test.txt`
  //   const command = `gh release list | grep "${releaseName}"`
  const command = `gh release list`
  console.log('')
  Messenger.info(`==> ${COMMAND}: Getting full release list from github.com`)

  const releases = await runShellCommand(command)

  if (releases.length) {
    let checkForLines = []
    let failed = false
    const lines = releases.split('\n')
    Messenger.info(`==> ${COMMAND}: Found ${lines.length} releases. Searching for release named: "${pluginName}"`)
    if (lines.length) {
      checkForLines = lines.filter((line) => line.includes(pluginName))
      if (checkForLines.length > 1 && checkForLines[1] !== '') {
        Messenger.error(
          `Found more than one matching release for "${pluginName}" on github\nYou will need to delete one of them on github before running this script. Go to:\n\thttps://github.com/NotePlan/plugins/releases\nand delete one of these:\n${checkForLines.join(
            '\n',
          )}`,
        )
        process.exit(0)
      } else if (checkForLines.length === 0) {
        Messenger.log(
          `==> ${COMMAND}: Did not find a pre-existing release that matched the pattern for this plugin folder: "${pluginName}" on github.\
          \nThat's ok if this is the first release. Or it could be that a pre-existing release did not match this naming convention.\
          Here are all the currently existing releases on github:\n---\n${releases}\nYou can always delete the old release at:\n\thttps://github.com/NotePlan/plugins/releases`,
        )
        failed = true
      }
    }
    if (!failed) {
      const parts = checkForLines[0].split('\t')
      if (parts.length > 3) {
        const name = parts[0]
        const tag = parts[2]
        Messenger.note(`==> ${COMMAND}: Found on github.com release tagged: ${colors.cyan(tag)}`)
        return { name, tag }
      } else {
        console.log(`==> ${COMMAND}: couldn't find proper fields in: ${JSON.stringify(parts)}`)
      }
    } else {
      return null
    }
  } else {
    console.log(`==> ${COMMAND}: Did not find pre-existing releases.`)
  }
}

function getReleaseTagName(pluginName, version) {
  return `${pluginName}-v${version}`
}

function getPluginDataField(pluginData, field) {
  const data = pluginData[field] || null
  if (!data) {
    console.log(`Could not find value for "${field}" in plugin.json`)
    process.exit(0)
  }
  return data
}

// $FlowFix - tried to use this type below, but flow doesn't like it
// type FileList = { changelog: string | null, files: Array<string> }

/**
 * @param {string} pluginFullPath
 * @returns {Promise<{ changelog: string | null, files: Array<string> } | null >}
 */
// eslint-disable-next-line no-unused-vars
async function getReleaseFileList(pluginFullPath, appPluginsPath) {
  let goodToGo = true
  const fileList = { changelog: null, files: [] }
  const filesInPluginFolder = await fs.readdir(pluginFullPath, {
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
  const fullPath = (name) => path.join(pluginFullPath, name)

  let name
  if ((name = existingFileName('changelog.md'))) {
    //$FlowFixMe - see note above
    fileList.changelog = fullPath(name)
  } else {
    if ((name = existingFileName('readme.md'))) {
      //$FlowFixMe - see note above
      fileList.changelog = fullPath(name)
    } else {
      Messenger.note(`==> ${COMMAND}: Missing ${colors.cyan('CHANGELOG.md')} or ${colors.cyan('README.md')} in ${pluginFullPath}`)
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
  }
  if ((name = existingFileName('script.js'))) {
    fileList.files.push(fullPath(name))
  } else {
    goodToGo = false
  }
  if ((name = existingFileName('readme.md'))) {
    fileList.files.push(fullPath(name))
  }

  // console.log(`>> Releases fileList:\n${JSON.stringify(fileList)}`)
  if (fileList.files.length < 2) goodToGo = false
  if (goodToGo === false) {
    console.log(
      colors.red(
        `>> Releases: ERROR. ABORTING: Not enough files to create a release. Minimum 2 files required are: plugin.json and script.js. Here are the files I found:\n${JSON.stringify(
          fileList,
        )}`,
      ),
    )
    return null
  } else {
    return fileList
  }
}

function wrongArgsMessage(limitToFolders) {
  console.log(`==> ${COMMAND}: ${limitToFolders ? String(limitToFolders.length) : ''} file(s): ${JSON.stringify(limitToFolders) || ''}`)
  console.log(colors.red(`\nERROR:\n Invalid Arguments (you may only release one plugin at a time)`), colors.yellow(`\n\nUsage:\n npm run release "dwertheimer.dateAutomations"`))
}

function ensureVersionIsNew(existingRelease, versionedTagName) {
  if (existingRelease && versionedTagName) {
    if (existingRelease.tag === versionedTagName) {
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

function getReleaseCommand(version, pluginTitle, fileList, sendToGithub = false) {
  const changeLog = fileList.changelog ? `-F "${fileList.changelog}"` : ''
  const cmd = `gh release create "${version}" -t "${pluginTitle}" ${changeLog} ${!sendToGithub ? `--draft` : ''} ${fileList.files.map((m) => `"${m}"`).join(' ')}`

  if (!sendToGithub) {
    console.log(`==> ${COMMAND}: Release command:\n\t${cmd}\n\nYou can run that by hand. The script is not doing it in TEST mode.\n`)
  }
  return cmd
}

function getRemoveCommand(version, sendToGithub = false) {
  const cmd = `gh release delete "${version}" ${sendToGithub ? `` : '-y'}` // -y removes the release without prompting
  if (!sendToGithub) {
    console.log(`==> ${COMMAND}: Pre-existing release remove command:\n\t${cmd}\n\nYou can run that by hand. The script is not doing it in TEST mode.\n`)
  }
  return cmd
}

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

async function removePlugin(versionedTagName, sendToGithub = false) {
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

async function checkForGh() {
  if (!((await fileExists(`/usr/local/bin/gh`)) || (await fileExists(`/opt/homebrew/bin/gh`)))) {
    console.log(`${colors.red('==> ${COMMAND}: ERROR: Could not find "gh" command.')}\n${installInstructions}`)
    process.exit(0)
  }
}

async function main() {
  await checkForGh()
  const rootFolderPath = path.join(__dirname, '..')
  const rootFolderDirs = await fs.readdir(rootFolderPath, {
    withFileTypes: true,
  })
  const limitToFolders = await getFolderFromCommandLine(rootFolderPath, program.args)

  if (limitToFolders.length === 1) {
    const pluginName = limitToFolders[0]
    const pluginFullPath = path.join(rootFolderPath, pluginName)
    const existingRelease = await getExistingRelease(pluginName)
    const pluginData = await getPluginFileContents(path.join(pluginFullPath, 'plugin.json'))
    const versionNumber = getPluginDataField(pluginData, 'plugin.version')
    const copyTargetPath = await getCopyTargetPath(rootFolderDirs)
    const fileList = await getReleaseFileList(pluginFullPath, path.join(copyTargetPath, pluginName))

    if (fileList) {
      const versionedTagName = getReleaseTagName(pluginName, versionNumber)
      // console.log(`==> ${COMMAND}: This version/tag will be:\n\t${versionedTagName}`)
      ensureVersionIsNew(existingRelease, versionedTagName)
      await releasePlugin(versionedTagName, pluginData, fileList, !TEST)
      if (existingRelease) await removePlugin(existingRelease.tag, !TEST)
      const newReleaseList = await getExistingRelease(pluginName)
      if (newReleaseList && newReleaseList.tag === versionedTagName) {
        Messenger.success(`Release Completed Successfully. "${versionedTagName}" has been published.`, 'SUCCESS')
      } else {
        Messenger.error(`^^^ Something went wrong. Please check log ^^^`, 'ERROR')
      }
    }
  } else {
    wrongArgsMessage()
  }
}
main()
