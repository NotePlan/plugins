// @flow

/*-------------------------------------------------------------------------------------------
 * Copyright (c) 2022 Mike Erickson / Codedungeon.  All rights reserved.
 * Licensed under the MIT license.  See LICENSE in the project root for license information.
 * -----------------------------------------------------------------------------------------*/

import fm from 'front-matter'

export default class FrontmatterModule {
  constructor(config: any = {}) {
    // $FlowFixMe
    this.config = config
  }

  isFrontmatterTemplate(templateData: string): boolean {
    const result = this.getFrontmatterBlock(templateData)
    return result.length > 0
  }

  getFrontmatterBlock(templateData: string): string {
    const templateLines = templateData.split('\n')

    templateLines.shift()
    const tempTemplateLines = [...templateLines]
    if (templateLines[0]?.charCodeAt(0) === 65532) {
      templateLines[0] = templateLines[0].substring(1)
    }

    if (templateLines[0] === '--') {
      templateLines.shift()
      if (templateLines.indexOf('--') !== -1) {
        tempTemplateLines[0] = '--'
        return tempTemplateLines.join('\n')
      }
    }

    return ''
  }

  render(template: any = ''): any {
    const fmData = fm(template)

    return fmData
  }
}
