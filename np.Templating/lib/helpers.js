/*-------------------------------------------------------------------------------------------
 * Copyright (c) 2022 Mike Erickson / Codedungeon.  All rights reserved.
 * Licensed under the MIT license.  See LICENSE in the project root for license information.
 * -----------------------------------------------------------------------------------------*/

// @flow

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
        docPage = 'templating-basics/template-anatomy#template-configuration---frontmatter'
        break
      default:
        break
    }
  }

  let msg = ''
  msg += `For more information please refer to "${section}"\n\nhttps://nptemplating-docs.netlify.app/docs/${docPage}`

  return msg
}
