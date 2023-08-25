/* eslint-disable no-empty */
// @flow
// About Flow: https://flow.org/en/docs/usage/#toc-write-flow-code
// Getting started with Flow in NotePlan: https://github.com/NotePlan/plugins/blob/main/Flow_Guide.md

// REMINDER, to build this plugin as you work on it:
// From the command line:
// `noteplan-cli plugin:dev aaronpoweruser.NoteProtector --test --watch --coverage`
// IMPORTANT: It's a good idea for you to open the settings ASAP in NotePlan Preferences > Plugins and set your plugin's logging level to DEBUG

import CryptoJS from 'crypto-js'
import pluginJson from '../plugin.json'
import { log, logDebug, logError, logWarn, clo, JSP } from '@helpers/dev'

const toBeDecyrptedToken = DataStore.settings.toBeDecyrptedToken ?? '#🔐'
const toBeEncryptedToken = DataStore.settings.toBeEncryptedToken ?? '#🔒'

export async function noteProtectorUnlockNotes(): Promise<void> {
  await processNotes(decryptParagraph, 'Unlock Notes')
}

export async function noteProtectorLockNotes(): Promise<void> {
  await processNotes(encryptParagraph, 'Lock Notes')
}

async function processNotes(operation: (note: TNote, paragraph: TParagraph, key: string) => void, promptMessage: string): Promise<void> {
  try {
    const allNotes = getAllNotes()
    const key = await promptForKey(promptMessage)

    if (key === '') {
      await CommandBar.prompt('Invalid password', 'Please enter a valid password')
      return
    }

    allNotes.forEach((note) => {
      if (note.hashtags.find((hashtag) => hashtag === toBeDecyrptedToken || hashtag === toBeEncryptedToken)) {
        const paragraphs: ?$ReadOnlyArray<TParagraph> = note.paragraphs
        if (paragraphs) {
          paragraphs.forEach((paragraph) => {
            operation(note, paragraph, key)
          })
        }
      }
    })
  } catch (error) {
    logError(pluginJson, JSP(error))
  }
}

function encryptParagraph(note: TNote, paragraph: TParagraph, key: string): void {
  try {
    if (paragraph?.content?.includes(toBeEncryptedToken)) {
      const encryptedText = CryptoJS.AES.encrypt(paragraph.content, key).toString()
      paragraph.content = `${encryptedText} ${toBeDecyrptedToken}`
      note.updateParagraph(paragraph)
    }
  } catch (error) {
    logError(pluginJson, JSP(error))
  }
}

function decryptParagraph(note: TNote, paragraph: TParagraph, key: string) {
  try {
    if (paragraph?.content?.includes(toBeDecyrptedToken)) {
      const content = paragraph.content
      const decyptedText = CryptoJS.AES.decrypt(content, key).toString(CryptoJS.enc.Utf8)
      paragraph.content = `${decyptedText}`
      note.updateParagraph(paragraph)
    }
  } catch (error) {
    logError(pluginJson, JSP(error))
  }
}

async function promptForKey(submitText: string): Promise<string> {
  let password = ''
  try {
    password = await CommandBar.showInput('Enter your passsword', submitText)
    return password
  } catch (error) {
    logError(pluginJson, JSP(error))
  }
  return password
}

function getAllNotes(): $ReadOnlyArray<TNote> {
  try {
    const projectNotes = DataStore.projectNotes.slice()
    const calendarNotes = DataStore.calendarNotes.slice()
    const allNotes = projectNotes.concat(calendarNotes)
    return allNotes
  } catch (error) {
    logError(pluginJson, JSP(error))
  }
  return []
}
