const exec = require('child_process').execSync

async function init(cwd = null) {
  let pluginDirectory = cwd
  let result = -''

  // install all the node_modules
  // result = exec('npm install')

  // create local link to CLI as it is not published as npm package
  // result = exec('npm link')

  // after npm install is complete, we can use the modules
  const { print } = require('@codedungeon/gunner')
  const colors = require('chalk')
  const fs = require('fs')
  const path = require('path')
  const os = require('os')
  const username = os.userInfo().username

  const pluginPathFilename = path.join(cwd, '.pluginpath')
  if (!fs.existsSync(pluginPathFilename)) {
    const data = `/Users/${username}/Library/Containers/co.noteplan.NotePlan3/Data/Library/Application Support/co.noteplan.NotePlan3/Plugins`
    fs.writeFileSync(pluginPathFilename, data)
  }
  result = console.log(result)

  console.log('')
  print.success('NotePlan Plugin Development Environment Ready!', 'SUCCESS')
  console.log('')
  print.info(colors.bold('👉  Whats next?'))
  print.info(
    '    • You can use `noteplan-cli create-plugin` to create your first NotePlan Plugin',
  )
  print.info(
    '    • You can read code from other NotePlan Plugins to gain more insight how you can interact with NotePlan',
  )
  print.info(
    '    • You can interace with other NotePlan Plugin Developers on Discord',
  )
}

// execute initialization
init(process.cwd())
