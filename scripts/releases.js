//@flow

const fs = require('fs/promises')
const path = require('path')
const commandLineArgs = require('command-line-args')

const { getFolderFromCommandLine, runShellCommand } = require('./shared')

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
          `>>Releases: PROBLEM: More than one matching release for ${pluginName}\n${JSON.stringify(
            lines,
          )}\n   You will need to delete one of them on github`,
        )
        failed = true
      } else if (checkForLines.length === 0) {
        console.log(
          `>>Releases: Did not find pre-existing release for "${pluginName}" on github.\nThat's ok if this is the firs release. Existing releases on github:\n${JSON.stringify(
            lines,
          )}`,
        )
        failed = true
      }
    }
    //FIXME HERE - release is not defined
    if (!failed) {
      const parts = checkForLines[0].split('\t')
      if (parts.length > 3) {
        const name = parts[0]
        const tag = parts[2]
        console.log(`>>Releases: found existing release name: ${name}`)
        console.log(`>>Releases: found existing release tag : ${tag}`)
      } else {
        console.log(
          `>>Releases: couldn't find proper fields in: ${JSON.stringify(
            parts,
          )}`,
        )
      }
    } else {
      return
    }
  } else {
    console.log(
      `>>RELEASES: Did not find pre-existing gh release named "${release}". You need to create it.`,
    )
  }
}

async function main() {
  console.log(`----------`)
  const rootFolderPath = path.join(__dirname, '..')

  const limitToFolders = await getFolderFromCommandLine(rootFolderPath)
  if (limitToFolders.length === 1) {
    const pluginName = limitToFolders[0]
    getExistingRelease(pluginName)
  } else {
    console.log(
      `>>Releases: ${limitToFolders.length} file(s): ${JSON.stringify(
        limitToFolders,
      )}`,
    )
    console.log(
      `>>Releases: Wrong # of arguments...You can only release one plugin/folder at a time!\nUsage:\n \
      npm run release "dwertheimer.dateAutomations"`,
    )
  }
}
main()
