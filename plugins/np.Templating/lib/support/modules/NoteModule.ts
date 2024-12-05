// @flow
/* eslint-disable */

/*-------------------------------------------------------------------------------------------
 * Copyright (c) 2022 Mike Erickson / Codedungeon.  All rights reserved.
 * Licensed under the MIT license.  See LICENSE in the project root for license information.
 * -----------------------------------------------------------------------------------------*/

import FrontMatterModule from '@templatingModules/FrontmatterModule'
import { getAllPropertyNames } from '@np/helpers/dev'
import moment from 'moment/min/moment-with-locales'
import FrontmatterModule from './FrontmatterModule'

export default class NoteModule {
  constructor(config: any) {
    // $FlowFixMe
    this.config = config
  }

  getCurrentNote(): ?Note {
    const filename = Editor.type === 'Calendar' ? Editor.filename?.replace('.md', '') : Editor.filename
    if (filename == null) {
      return null
    }
    const note = DataStore.noteByFilename(filename, Editor.type ?? 'Notes')
    return note
  }

  setCursor(line: number = 0, position: number = 0): string {
    // await Editor.highlightByIndex(line, position)
    // TODO: Need to complete the implementation of cursor command
    return '$NP_CURSOR'
  }

  filename(): ?string {
    return this.getCurrentNote()?.filename
  }

  title(): ?string {
    return this.getCurrentNote()?.title
  }

  type(): ?NoteType {
    return this.getCurrentNote()?.type
  }

  content(stripFrontmatter: boolean = false): ?string {
    let content = this.getCurrentNote()?.content
    if (content == null) {
      return null
    }
    if (stripFrontmatter) {
      const frontmatterText = new FrontmatterModule().getFrontmatterText(content)
      content = content.replace(frontmatterText, '')
    }

    return content
  }

  hashtags(): ?string {
    return this.getCurrentNote()?.hashtags.join(', ')
  }

  mentions(): ?string {
    return this.getCurrentNote()?.mentions.join(', ')
  }

  date(format: string = ''): ?Date | string {
    let dt = this.getCurrentNote()?.date
    if (format.length > 0) {
      dt = moment(dt).format('YYYY-MM-DD')
    }
    return dt
  }

  createdDate(format: string = ''): ?Date | string {
    let dt = this.getCurrentNote()?.createdDate
    if (format.length > 0) {
      dt = moment(dt).format('YYYY-MM-DD')
    }
    return dt
  }

  changedDate(format: string = ''): ?Date | string {
    let dt = this.getCurrentNote()?.changedDate
    if (format.length > 0) {
      dt = moment(dt).format('YYYY-MM-DD')
    }
    return dt
  }

  paragraphs(): Array<{ key: string, value: string | boolean | Array<any> }> {
    let paragraphs = this.getCurrentNote()?.paragraphs

    let result = []

    if (paragraphs == null) {
      return result
    }

    paragraphs.forEach((item) => {
      let keys = getAllPropertyNames(item)
      keys.forEach((key) => {
        // @ts-ignore
        if (typeof item[key] === 'string' || typeof item[key] === 'boolean' || Array.isArray(item[key])) {
          result.push({ key, value: item[key] })
        }
      })
    })
    return result
  }

  backlinks(): Array<{ key: string, value: string | boolean | Array<any> }> {
    let backlinks = this.getCurrentNote()?.backlinks

    let result = []
    if (backlinks == null) {
      return result
    }

    backlinks.forEach((item) => {
      let keys = getAllPropertyNames(item)
      keys.forEach((key) => {
        // @ts-ignore
        if (typeof item[key] === 'string' || typeof item[key] === 'boolean' || Array.isArray(item[key])) {
          result.push({ key, value: item[key] })
        }
      })
    })
    return result
  }

  linkedItems(): Array<{ key: string, value: string | boolean | Array<any> }> {
    let linkedItems = this.getCurrentNote()?.linkedItems

    let result = []
    if (linkedItems == null) {
      return result
    }

    linkedItems.forEach((item) => {
      let keys = getAllPropertyNames(item)
      keys.forEach((key) => {
        // @ts-ignore
        if (typeof item[key] === 'string' || typeof item[key] === 'boolean' || Array.isArray(item[key])) {
          result.push({ key, value: item[key] })
        }
      })
    })
    return result
  }

  datedTodos(): Array<{ key: string, value: string | boolean | Array<any> }> {
    let datedTodos = this.getCurrentNote()?.datedTodos

    let result = []
    if (datedTodos == null) {
      return result
    }

    datedTodos.forEach((item) => {
      let keys = getAllPropertyNames(item)
      keys.forEach((key) => {
        // @ts-ignore
        if (typeof item[key] === 'string' || typeof item[key] === 'boolean' || Array.isArray(item[key])) {
          result.push({ key, value: item[key] })
        }
      })
    })
    return result
  }

  async attributes(): Promise<Array<{ key: string, value: any }>> {
    const iFM = new FrontMatterModule()
    const note = this.getCurrentNote()?.content ?? ''
    let result: Array<{ key: string, value: any }> = []

    if (iFM.isFrontmatterTemplate(note)) {
      for (const [key, value] of Object.entries(iFM.attributes(note))) {
        result.push({ key, value })
      }
    }

    return result
  }
}
