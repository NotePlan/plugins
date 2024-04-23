import { getLocalDate } from './NPReadwiseHelpers'
import { getOrMakeNote } from '@helpers/note'

const SYNC_LOG_TOKEN = 'readWiseToken'
const SYNC_NOTE_TITLE = 'Readwise Syncs'

export async function startReadwiseSyncLog(): Promise<void> {
  if (DataStore.settings.writeSyncLog === true) {
    const outputNote = await getOrMakeNote(SYNC_NOTE_TITLE, DataStore.settings.baseFolder)
    await outputNote?.insertHeading(SYNC_LOG_TOKEN, 1, 2)
  }
}

export async function writeReadwiseSyncLogLine(title: string, count: number): Promise<void> {
  if (DataStore.settings.writeSyncLog === true) {
    const outputNote = await getOrMakeNote(SYNC_NOTE_TITLE, DataStore.settings.baseFolder)
    await outputNote?.addParagraphBelowHeadingTitle(`${count} highlights from [[${title}]]`, 'list', SYNC_LOG_TOKEN, true, false)
  }
}

export async function finishReadwiseSyncLog(downloadHighlightCount: number, updatedSourceCount: number): Promise<void> {
  if (DataStore.settings.writeSyncLog === true) {
    const outputNote = await getOrMakeNote(SYNC_NOTE_TITLE, DataStore.settings.baseFolder, '')
    const dateString =
      `[[${getLocalDate()}]] ${new Date().toLocaleTimeString([], { timeStyle: 'short' })} ` +
      `— synced ${downloadHighlightCount} highlights from ${updatedSourceCount} documents.`
    outputNote.content = outputNote?.content?.replace(SYNC_LOG_TOKEN, dateString)
  }
}
