// @flow

/*-------------------------------------------------------------------------------------------
 * Copyright (c) 2022 Mike Erickson / Codedungeon.  All rights reserved.
 * Licensed under the MIT license.  See LICENSE in the project root for license information.
 * -----------------------------------------------------------------------------------------*/

import fm from 'front-matter'

export function getAttributes(templateData: string = ''): any {
  const fmData = fm(templateData, { allowUnsafe: true })

  return fmData && fmData?.attributes ? fmData.attributes : {}
}

export function getBody(templateData: string = ''): string {
  const fmData = fm(templateData, { allowUnsafe: true })

  return fmData && fmData?.body ? fmData.body : ''
}

export default class FrontmatterModule {
  constructor(config: any = {}) {
    // $FlowFixMe
    this.config = config
  }

  isFrontmatterTemplate(templateData: string): boolean {
    return fm.test(templateData)
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
    const fmData = fm(template, { allowUnsafe: true })

    return fmData
  }

  attributes(templateData: string = ''): any {
    try {
      const fmData = fm(templateData, { allowUnsafe: true })

      return fmData && fmData?.attributes ? fmData.attributes : {}
    } catch (error) {
      return {}
    }
  }

  body(templateData: string = ''): string {
    const fmData = fm(templateData, { allowUnsafe: true })

    return fmData && fmData?.body ? fmData.body : ''
  }
}
