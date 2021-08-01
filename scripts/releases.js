// @flow

// $FlowIgnore
const fs = require('fs/promises')
const path = require('path')

const {
  getFolderFromCommandLine,
  runShellCommand,
  getPluginFileContents,
} = require('./shared')
/**
 *
 * @param {string} pluginFullPath
 * @returns {Promise<{name:string,tag:string} | null>
 */
async function getExistingRelease(pluginName) {
  // const command = `gh release upload --clobber "dwertheimer.TaskAutomations" /tmp/test.txt`
  //   const command = `gh release list | grep "${releaseName}"`
  const command = `gh release list`
  console.log(`>>Releases: Getting full release list from Github`)

  const releases = await runShellCommand(command)
  //   console.log(
  //     `>>Releases Command: "${command}" returned:\n ${JSON.stringify(release)}`,
  //   )
  if (releases.length) {
    let checkForLines = []
    let failed = false
    const lines = releases.split('\n')
    console.log(
      `>>Releases: Found ${lines.length} releases. Searching for release named: "${pluginName}"`,
    )
    if (lines.length) {
      checkForLines = lines.filter((line) => line.includes(pluginName))
      if (checkForLines.length > 1 && checkForLines[1] !== '') {
        console.log(
          `>>Releases: PROBLEM: Found more than one matching release for "${pluginName}" on github\nYou will need to delete one of them on github before running this script. Go to:\n\thttps://github.com/NotePlan/plugins/releases\nand delete one of these:\n${checkForLines.join(
            '\n',
          )}`,
        )
        process.exit(0)
      } else if (checkForLines.length === 0) {
        console.log(
          `>>Releases: Did not find pre-existing release for "${pluginName}" on github.\nThat's ok if this is the first release. Here are the existing releases on github:\n${releases}`,
        )
        failed = true
      }
    }
    if (!failed) {
      const parts = checkForLines[0].split('\t')
      if (parts.length > 3) {
        const name = parts[0]
        const tag = parts[2]
        console.log(`>>Releases: found existing release name: ${name}`)
        console.log(`>>Releases: found existing release tag : ${tag}`)
        return { name, tag }
      } else {
        console.log(
          `>>Releases: couldn't find proper fields in: ${JSON.stringify(
            parts,
          )}`,
        )
      }
    } else {
      return null
    }
  } else {
    console.log(`>>RELEASES: Did not find pre-existing releases.`)
  }
}

function getReleaseTagName(pluginName, version) {
  return `${pluginName}-v${version}`
}

function getVersionFromPluginJson(pluginData) {
  const version = pluginData['plugin.version'] || null
  if (!version) {
    console.log(`Could not find plugin.version in plugin.json`)
    process.exit(0)
  }
  return version
}

/**
 * @param {string} pluginFullPath
 * @returns {Promise<{ changelog: string | null, files: Array<string> }>>}
 */
async function getReleaseFileList(pluginFullPath) {
  const fileList = { changelog: null, files: [] }
  const filesInPluginFolder = await fs.readdir(pluginFullPath, {
    withFileTypes: true,
  })
  const fileLowerMatch = (str) =>
    filesInPluginFolder.filter((f) => f.name.toLowerCase() === str)
  const existingFileName = (lowercaseName) => {
    const match = fileLowerMatch(lowercaseName)
    if (match.length) {
      return match[0].name
    } else {
      return null
    }
  }
  const fullPath = (name) =>
    name ? `"${path.join(pluginFullPath, name)}"` : null

  let name
  if ((name = existingFileName('changelog.md'))) {
    fileList.changelog = fullPath(name)
  } else {
    if ((name = existingFileName('readme.md'))) {
      fileList.changelog = fullPath(name)
    } else {
      console.log(
        `>>Releases: NOTE there is no changelog or README file in ${pluginFullPath}`,
      )
    }
  }
  if ((name = existingFileName('plugin.json'))) {
    fileList.files.push(fullPath(name))
  }
  if ((name = existingFileName('script.js'))) {
    fileList.files.push(fullPath(name))
  }
  if ((name = existingFileName('readme.md'))) {
    fileList.files.push(fullPath(name))
  }
  // console.log(`>> Releases fileList:\n${JSON.stringify(fileList)}`)
  return fileList
}

function wrongArgsMessage(limitToFolders) {
  console.log(
    `>>Releases: ${
      limitToFolders ? String(limitToFolders.length) : ''
    } file(s): ${JSON.stringify(limitToFolders) || ''}`,
  )
  console.log(
    `>>Releases: Wrong # of arguments...You can only release one plugin/folder at a time!\nUsage:\n \
      npm run release "dwertheimer.dateAutomations"`,
  )
}

function ensureVersionIsNew(existingRelease, versionedTagName) {
  if (existingRelease && versionedTagName) {
    if (existingRelease.tag === versionedTagName) {
      console.log(
        `>>Releases: Found existing release with tag name: "${versionedTagName}", which matches the version number in your plugin.json. New releases always have to have a unique name/tag. Update your plugin.version in plugin.json (and changelog.md or readme.md) and try again.`,
      )
      process.exit(0)
    }
  }
}

function getReleaseCommand(version, fileList, sendToGithub = false) {
  const changeLog = fileList.changelog ? `-F ${fileList.changelog}` : ''
  return `gh release create "${version}" -t "${version}" ${changeLog} ${
    !sendToGithub ? `--draft` : ''
  } ${fileList.files.join(' ')}`
}

function getRemoveCommand(version, fileList, sendToGithub = false) {
  return `gh release delete "${version}" ${sendToGithub ? `` : '-y'}` // -y removes the release without prompting
}

async function releasePlugin(versionedTagName, fileList, sendToGithub = false) {
  const releaseCommand = getReleaseCommand(
    versionedTagName,
    fileList,
    sendToGithub,
  )
  if (!sendToGithub) {
    console.log(`\nRelease create command: \n${releaseCommand}\n`)
  } else {
    if (releaseCommand) {
      console.log(`Creating release "${versionedTagName}" on github...`)
      const resp = await runShellCommand(releaseCommand)
      console.log(
        `New release posted (check on github):\n\t${JSON.stringify(
          resp.trim(),
        )}`,
      )
    }
  }
}

async function removePlugin(versionedTagName, sendToGithub = false) {
  const removeCommand = getRemoveCommand(versionedTagName, sendToGithub)
  if (!sendToGithub) {
    console.log(`\nPrevious release remove command: \n${removeCommand}\n`)
  } else {
    if (removeCommand) {
      console.log(
        `Removing previous version "${versionedTagName}" on github...`,
      )
      const resp = await runShellCommand(removeCommand)
      // console.log(`...response: ${JSON.stringify(resp.trim())}`)
    }
  }
}

async function main() {
  console.log(`----------`)
  const rootFolderPath = path.join(__dirname, '..')
  const limitToFolders = await getFolderFromCommandLine(rootFolderPath)
  if (limitToFolders.length === 1) {
    const pluginName = limitToFolders[0]
    const pluginFullPath = path.join(rootFolderPath, pluginName)
    const existingRelease = await getExistingRelease(pluginName)
    const pluginData = await getPluginFileContents(pluginFullPath)
    const versionNumber = getVersionFromPluginJson(pluginData)
    const fileList = await getReleaseFileList(pluginFullPath)
    const versionedTagName = getReleaseTagName(pluginName, versionNumber)
    // console.log(`>>Releases: This version/tag will be:\n\t${versionedTagName}`)
    ensureVersionIsNew(existingRelease, versionedTagName)
    await releasePlugin(versionedTagName, fileList, true)
    if (existingRelease) await removePlugin(existingRelease.tag, true)
  } else {
    wrongArgsMessage()
  }
}
main()
