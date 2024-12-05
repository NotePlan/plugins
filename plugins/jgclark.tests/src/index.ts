/* eslint-disable require-await */
// @flow
//-----------------------------------------------------------------------------
// Tests for API calls etc.
// Jonathan Clark
// Last updated 24.6.2022
//-----------------------------------------------------------------------------

import { log } from '@np/helpers/dev'
import { printNote } from '@np/helpers/note'
import { findStartOfActivePartOfNote } from '@np/helpers/paragraph'
import { chooseNote } from '@np/helpers/userInput'

export function init(): void {
  // Placeholder only
}

export function onSettingsUpdated(): void {
  // Placeholder only to stop error in logs
}

export async function onUpdateOrInstall(_config: any = { silent: false }): Promise<void> {
  // placeholder only
}

export async function invokePluginCommandByName() {
  const result = await DataStore.invokePluginCommandByName('np:about', 'np.Templating', [])
  log('invokePluginCommandByName', result)
}

export function showStartActive(): void {
  const { note, paragraphs } = Editor
  if (note != null) {
    const a = findStartOfActivePartOfNote(note)
    log('testStartActive', `start = ${a} out of ${paragraphs.length}`)
    if (paragraphs[a] !== undefined) {
      Editor.highlight(paragraphs[a])
    }
  }
}

export async function logCurrentNoteInfo(): Promise<void> {
  const { note } = Editor
  if (note) {
    printNote(note, true)
  }
}

export async function logNoteInfo(): Promise<void> {
  const note = await chooseNote(true, true, [], 'Select note to log', false, false)
  if (note) {
    printNote(note, true)
  }
}
