// @flow

/*-------------------------------------------------------------------------------------------
 * Copyright (c) 2022 Mike Erickson / Codedungeon.  All rights reserved.
 * Licensed under the MIT license.  See LICENSE in the project root for license information.
 * -----------------------------------------------------------------------------------------*/

import FrontMatterModule from '@templatingModules/FrontmatterModule'
import { getAllPropertyNames } from '@helpers/dev'
import moment from 'moment'
import FrontmatterModule from './FrontmatterModule'

export default class NoteModule {
  constructor(config: any) {
    // $FlowFixMe
    this.config = config
  }

  getCurrentNote(): string {
    const filename = Editor.type === 'Calendar' ? Editor.filename?.replace('.md', '') : Editor.filename
    // $FlowIgnore
    const note = DataStore.noteByFilename(filename, Editor.type)

    // $FlowIgnore
    return note
  }

  setCursor(line: number = 0, position: number = 0): string {
    // await Editor.highlightByIndex(line, position)
    // TODO: Need to complete the implementation of cursor command
    return '$NP_CURSOR'
  }

  filename(): string {
    // $FlowIgnore
    return this.getCurrentNote()?.filename
  }

  title(): string {
    // $FlowIgnore
    return this.getCurrentNote()?.title
  }

  type(): string {
    // $FlowIgnore
    return this.getCurrentNote()?.type
  }

  content(stripFrontmatter: boolean = false): string {
    // $FlowIgnore
    let content = this.getCurrentNote()?.content
    if (stripFrontmatter) {
      const frontmatterText = new FrontmatterModule().getFrontmatterText(content)
      content = content.replace(frontmatterText, '')
    }

    return content
  }

  hashtags(): string {
    // $FlowIgnore
    return this.getCurrentNote()?.hashtags.join(', ')
  }

  mentions(): string {
    // $FlowIgnore
    return this.getCurrentNote()?.mentions.join(', ')
  }

  date(format: string = ''): string {
    // $FlowIgnore
    let dt = this.getCurrentNote()?.date
    if (format.length > 0) {
      dt = moment(dt).format('YYYY-MM-DD')
    }
    return dt
  }

  createdDate(format: string = ''): string {
    let dt = this.getCurrentNote()?.createdDate
    if (format.length > 0) {
      dt = moment(dt).format('YYYY-MM-DD')
    }
    return dt
  }

  changedDate(format: string = ''): string {
    let dt = this.getCurrentNote()?.changedDate
    if (format.length > 0) {
      dt = moment(dt).format('YYYY-MM-DD')
    }
    return dt
  }

  paragraphs(): any {
    let paragraphs = this.getCurrentNote()?.paragraphs

    let result = []

    paragraphs.forEach((item) => {
      let keys = getAllPropertyNames(item)
      keys.forEach((key) => {
        if (typeof item[key] === 'string' || typeof item[key] === 'boolean' || Array.isArray(item[key])) {
          result.push({ key, value: item[key] })
        }
      })
    })
    return result
  }

  backlinks(): any {
    let backlinks = this.getCurrentNote()?.backlinks

    let result = []

    backlinks.forEach((item) => {
      let keys = getAllPropertyNames(item)
      keys.forEach((key) => {
        if (typeof item[key] === 'string' || typeof item[key] === 'boolean' || Array.isArray(item[key])) {
          result.push({ key, value: item[key] })
        }
      })
    })
    return result
  }

  linkedItems(): any {
    let linkedItems = this.getCurrentNote()?.linkedItems

    let result = []

    linkedItems.forEach((item) => {
      let keys = getAllPropertyNames(item)
      keys.forEach((key) => {
        if (typeof item[key] === 'string' || typeof item[key] === 'boolean' || Array.isArray(item[key])) {
          result.push({ key, value: item[key] })
        }
      })
    })
    return result
  }

  datedTodos(): any {
    let datedTodos = this.getCurrentNote()?.datedTodos

    let result = []

    datedTodos.forEach((item) => {
      let keys = getAllPropertyNames(item)
      keys.forEach((key) => {
        if (typeof item[key] === 'string' || typeof item[key] === 'boolean' || Array.isArray(item[key])) {
          result.push({ key, value: item[key] })
        }
      })
    })
    return result
  }

  async attributes(): any {
    const iFM = new FrontMatterModule()
    // $FlowIgnore
    const note = this.getCurrentNote().content
    let result = []
    if (iFM.isFrontmatterTemplate(note)) {
      for (const [key, value] of Object.entries(iFM.attributes(note))) {
        result.push({ key, value })
      }
    }

    return result
  }
}
