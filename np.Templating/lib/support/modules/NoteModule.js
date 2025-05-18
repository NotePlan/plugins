// @flow
/* eslint-disable */

/*-------------------------------------------------------------------------------------------
 * Copyright (c) 2022 Mike Erickson / Codedungeon.  All rights reserved.
 * Licensed under the MIT license.  See LICENSE in the project root for license information.
 * -----------------------------------------------------------------------------------------*/

import FrontMatterModule from '@templatingModules/FrontmatterModule'
import { getAllPropertyNames } from '@helpers/dev'
import moment from 'moment/min/moment-with-locales'
import FrontmatterModule from './FrontmatterModule'
import { findStartOfActivePartOfNote, findEndOfActivePartOfNote } from '@helpers/paragraph'
import { replaceContentUnderHeading, insertContentUnderHeading } from '@helpers/NPParagraph'
import { removeSection } from '@helpers/note'
import { getFlatListOfBacklinks } from '@helpers/NPnote'
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
    const note = Editor.note
    return note
  }

  currentNote(): ?Note {
    return Editor.note
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
        // $FlowIgnore
        if (typeof item[key] === 'string' || typeof item[key] === 'boolean' || Array.isArray(item[key])) {
          result.push({ key, value: item[key] })
        }
      })
    })
    return result
  }

  // return the array of tasks
  openTasks(): Array<TParagraph> {
    const note = this.getCurrentNote()
    let inTodaysNote = note?.paragraphs || []
    const scheduledForToday = note?.type === 'Calendar' ? getFlatListOfBacklinks(note) : []
    const paragraphs = [...inTodaysNote, ...scheduledForToday].filter((p) => p.type === 'open')
    let openTasks = paragraphs.filter((paragraph) => paragraph.type === 'open')
    return openTasks
  }

  openTaskCount(): number {
    const openTasks = this.openTasks()
    return openTasks.length || 0
  }

  completedTasks(): Array<TParagraph> {
    const note = this.getCurrentNote()
    let inTodaysNote = note?.paragraphs || []
    const scheduledForToday = note?.type === 'Calendar' ? getFlatListOfBacklinks(note) : []
    const paragraphs = [...inTodaysNote, ...scheduledForToday].filter((p) => p.type === 'done')
    let completedTasks = paragraphs.filter((paragraph) => paragraph.type === 'done')
    return completedTasks
  }

  completedTaskCount(): number {
    const completedTasks = this.completedTasks()
    return completedTasks.length || 0
  }

  openChecklists(): Array<TParagraph> {
    let paragraphs = this.getCurrentNote()?.paragraphs || []
    let openChecklists = paragraphs.filter((paragraph) => paragraph.type === 'checklist')
    return openChecklists
  }

  completedChecklists(): Array<TParagraph> {
    let paragraphs = this.getCurrentNote()?.paragraphs || []
    let completedChecklists = paragraphs.filter((paragraph) => paragraph.type === 'checklistDone')
    return completedChecklists
  }

  completedChecklistCount(): number {
    const completedChecklists = this.completedChecklists()
    return completedChecklists.length || 0
  }

  openChecklistCount(): number {
    const openChecklists = this.openChecklists()
    return openChecklists.length || 0
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
        // $FlowIgnore
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
        // $FlowIgnore
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
        // $FlowIgnore
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

  // Works out where the first 'active' line of the note is, following the first paragraph of type 'title', or frontmatter (if present).
  // returns the line number of the first non-frontmatter paragraph (0 if no frontmatter, -1 if no note can be found)
  contentStartIndex(): number {
    const note = this.getCurrentNote()
    return note ? findStartOfActivePartOfNote(note) : -1
  }

  // Works out the index to insert paragraphs before any ## Done or ## Cancelled section starts, if present, and returns the paragraph before that. Works with folded Done or Cancelled sections. If the result is a separator, use the line before that instead If neither Done or Cancelled present, return the last non-empty lineIndex.
  contentEndIndex(): number {
    const note = this.getCurrentNote()
    return note ? findEndOfActivePartOfNote(note) : -1
  }

  /**
   * Remove paragraphs in a section (under a title/heading) of the current note.
   * BEWARE: This is a dangerous function. It removes all paragraphs in the section of the active note, given:
   * and can remove more than you expect if you don't have a title of equal or lower headingLevel beneath it.
   * - Section heading line to look for (needs to match from start of line but not necessarily the end)
   * A section is defined (here at least) as all the lines between the heading,
   * and the next heading of that same or higher level (lower headingLevel), or the end of the file if that's sooner. *
   * @param {string} headingOfSectionToRemove
   * @return {void}
   */
  removeSection(headingOfSectionToRemove: string): void {
    return 'Not implemented yet'
    const note = this.getCurrentNote()
    note ? removeSection(note, headingOfSectionToRemove) : null
  }

  /**
   * Replace content under a given heading in the current note.
   * See getParagraphBlock below for definition of what constitutes a block an definition of includeFromStartOfSection.
   * @param {string} heading
   * @param {string} newContentText - text to insert (multiple lines, separated by newlines)
   * @param {boolean} includeFromStartOfSection
   * @param {number} headingLevel of the heading to insert where necessary (1-5, default 2)
   */
  async replaceContentUnderHeading(heading: string, newContentText: string, includeFromStartOfSection: boolean = false, headingLevel: number = 2): void {
    return 'Not implemented yet'
    const note = this.getCurrentNote()
    note ? await replaceContentUnderHeading(note, heading, newContentText, includeFromStartOfSection, headingLevel) : null
  }
}

// TODO: insertContentUnderHeading and new createHeading which is just insertContentUnderHeading with no text to add?
