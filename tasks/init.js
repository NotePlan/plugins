const exec = require('child_process').execSync
const os = require('os')
const username = os.userInfo().username
const { filesystem, system, path, print, colors } = require('@codedungeon/gunner')

async function init(cwd = null) {
  const pluginDirectory = cwd
  let result = -''

  const cliPath = path.join(path.dirname(system.run('which node')), 'noteplan-cli')
  if (!filesystem.existsSync(cliPath)) {
    system.run('npm link')
  }

  const pluginPathFilename = path.join(cwd, '.pluginpath')
  if (!filesystem.existsSync(pluginPathFilename)) {
    const data = `/Users/${username}/Library/Containers/co.noteplan.NotePlan3/Data/Library/Application Support/co.noteplan.NotePlan3/Plugins`
    filesystem.writeFileSync(pluginPathFilename, data)
  }
  result = console.log(result)

  console.log('')
  print.success('NotePlan Plugin Development Environment Ready!', 'SUCCESS')
  console.log('')
  print.info(colors.bold('👉  Whats next?'))
  print.info('    • You can use `noteplan-cli create-plugin` to create your first NotePlan Plugin')
  print.info(
    '    • You can read code from other NotePlan Plugins to gain more insight how you can interact with NotePlan',
  )
  print.info('    • You can interace with other NotePlan Plugin Developers on Discord')
}

// execute initialization
init(process.cwd())
