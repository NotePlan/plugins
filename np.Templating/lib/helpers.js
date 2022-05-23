/*-------------------------------------------------------------------------------------------
 * Copyright (c) 2022 Mike Erickson / Codedungeon.  All rights reserved.
 * Licensed under the MIT license.  See LICENSE in the project root for license information.
 * -----------------------------------------------------------------------------------------*/

// @flow

import { log, clo } from '@helpers/dev'
import pluginJson from '../plugin.json'

export function helpInfo(section: string, userDocPage?: string): string {
  let docPage = userDocPage || ''
  if (docPage.length === 0) {
    switch (section) {
      case 'Templating Prompts':
        docPage = 'templating-examples/prompt'
        break
      case 'Migrating Legacy Templates':
        docPage = 'templating-migrating/overview'
        break
      case 'Meeting Notes':
        docPage = 'templating-commands/overview#npmtn'
        break
      case 'Quick Notes':
        docPage = 'templating-commands/overview#npqtn'
        break
      case 'Template Anatomty':
        docPage = 'templating-basics/template-anatomy'
        break
      case 'Template Anatomty: Frontmatter':
        docPage = 'templating-basics/template-anatomy#template-configuration'
        break
      case 'Plugin Error':
        docPage = 'templating-modules/helpers#noteplan-plugin-helpers'
        break
      default:
        break
    }
  }

  let msg = ''
  msg += `For more information please refer to "${section}"\n\nhttps://nptemplating-docs.netlify.app/docs/${docPage}`

  return msg
}

export function debug(debugInfo: any, preamble: string = '', logInfo: string = ''): void {
  const SPACER_LENGTH = 80 // num lines to show around debug call
  const LINE_CHAR = '- ' // visual queue character

  // NOTE: DEBUG_MODE CONFIGURATION
  // DEBUG_MODE variable will be changed to false if not in debug mode when creating release
  //            see npc plugin:dev command for --debug option
  const DEBUG_MODE = true

  if (DEBUG_MODE) {
    const spaces = logInfo.length === 0 ? SPACER_LENGTH : Math.round((SPACER_LENGTH - (logInfo.length - 2)) / 2)
    const premambe = logInfo.length === 0 ? `${LINE_CHAR}`.repeat(spaces - 4) : `${LINE_CHAR}`.repeat(spaces) + ` ${logInfo} ` + `${LINE_CHAR}`.repeat(spaces)

    log(pluginJson, premambe, 'DEBUG')
    if (Array.isArray(debugInfo)) {
<<<<<<< HEAD
      clo(`numItems: ${debugInfo.length}  \n            ` + '[ ' + debugInfo.join(', ') + ' ]', '', 4)
=======
      clo(`  numItems: ${debugInfo.length}  \n            ` + '[\n ' + debugInfo.join(',\n     ') + ' \n]', '', 4)
>>>>>>> feature/templating-invoke-command
    } else {
      clo(debugInfo, preamble, 4)
    }
    log(pluginJson, premambe, 'DEBUG')
    console.log('') // add a little visual space
  }
}
