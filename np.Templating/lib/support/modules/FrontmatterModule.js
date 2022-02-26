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
    if (templateLines[0] === '---') {
      templateLines.shift()
      if (templateLines.indexOf('---') > 0) {
        return templateData
      }
    }

    return ''
  }

  render(template: any = ''): any {
    const fmData = fm(template)

    return fmData
  }
}
