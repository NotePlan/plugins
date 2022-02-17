// @flow
import NPTemplating from 'NPTemplating'
import pluginInfo from '../plugin.json'
import { log, logError } from '@helpers/dev'

export async function testTemplating(): Promise<void> {
  try {
    const result = await NPTemplating.renderTemplate('Template - Hello World', {})
    log('testTemplating', 'DEBUG')
    log({ key: 'value' })
    log(new Date())
    log(3)

    logError('testTemplating error w/ Debug', 'DEBUG')
    logError({ key: 'value' })
    logError(new Date())
    let msg2 = logError(3)
    console.log(msg2.length)
    console.log('')

    log(pluginInfo, 'testTemplating')
    log(pluginInfo, { key: 'value' })
    log(pluginInfo, 3)
    log(pluginInfo, new Date())
    log(pluginInfo, ['mike'])

    console.log('')
    logError(pluginInfo, 'testTemplating')
    logError(pluginInfo, { key: 'value' })
    logError(pluginInfo, 3)
    logError(pluginInfo, new Date())
    let msg = logError(pluginInfo, ['mike'])

    console.log(msg.length)

    Editor.insertTextAtCursor(result)
  } catch (error) {
    logError(pluginInfo, error)
  }
}
