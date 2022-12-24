// @flow

/*-------------------------------------------------------------------------------------------
 * Copyright (c) 2022 Mike Erickson / Codedungeon.  All rights reserved.
 * Licensed under the MIT license.  See LICENSE in the project root for license information.
 * -----------------------------------------------------------------------------------------*/

import fm from 'front-matter'

export function getAttributes(templateData: string = ''): any {
  const fmData = fm(templateData, { allowUnsafe: true })
  Object.keys(fmData?.attributes).forEach((key) => {
    fmData.attributes[key] || typeof fmData.attributes[key] === 'boolean' ? fmData.attributes[key] : (fmData.attributes[key] = '')
  })
  return fmData && fmData?.attributes ? fmData.attributes : {}
}

export function getBody(templateData: string = ''): string {
  const fmData = fm(templateData, { allowUnsafe: true })

  return fmData && fmData?.body ? fmData.body : ''
}

export default class FrontmatterModule {
  // $FlowIgnore
  constructor(NPTemplating: any = null) {
    if (NPTemplating) {
      // $FlowIgnore
      this.templatingInstance = NPTemplating
    }
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

  getFrontmatterText(templateData: string): string {
    return templateData.replace(this.body(templateData), '')
  }

  parse(template: string = ''): any {
    if (this.isFrontmatterTemplate(template)) {
      const fmData = fm(template)
      Object.keys(fmData?.attributes).forEach((key) => {
        fmData.attributes[key] ? fmData.attributes[key] : (fmData.attributes[key] = '')
      })
      fmData.body = fmData.body.replace(/---/gi, '*****')

      return fmData
    } else {
      return {}
    }
  }

  attributes(templateData: string = ''): any {
    try {
      const fmData = fm(templateData, { allowUnsafe: true })
      Object.keys(fmData?.attributes).forEach((key) => {
        fmData.attributes[key] ? fmData.attributes[key] : (fmData.attributes[key] = '')
      })

      return fmData && fmData?.attributes ? fmData.attributes : {}
    } catch (error) {
      // console.log(error)
      return {}
    }
  }

  body(templateData: string = ''): string {
    const fmData = fm(templateData, { allowUnsafe: true })

    return fmData && fmData?.body ? fmData.body : ''
  }

  convertProjectNoteToFrontmatter(projectNote: string = ''): any {
    if (this.isFrontmatterTemplate(projectNote)) {
      return -3
    }

    let note = projectNote

    if (note.length === 0) {
      return -1
    }

    const lines = note.split('\n')
    if (lines.length === 0) {
      return -1
    }

    let title = lines.shift()
    if (!title.startsWith('#')) {
      return -2
    }

    title = title.substr(2)

    note = lines.join('\n')

    // construct fronmatter object
    // - use first line from above as `title` attribute value
    let frontmatter = '---\n'
    frontmatter += `title: ${title}\n`
    frontmatter += 'type: empty-note\n'
    frontmatter += '---\n'

    note = `${frontmatter}${note}`

    return note
  }
}
