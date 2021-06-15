// @flow
// Type checking reference: https://flow.org/
// Specific how-to re: Noteplan: https://github.com/NotePlan/plugins/blob/main/Flow_Guide.md
import { showMessage, showMessageYesNo } from './noteHelpers'
import { getOverdueTasks, getTasksByType } from './taskHelpers'

async function sortTasksInNote(note) {
  if (note) {
    const paragraphs = note.paragraphs
    console.log(`\t${paragraphs.length} total lines in note`)
    if (paragraphs.length) {
      getTasksByType(paragraphs)
    }
  }
}

export default async function sortTasks(): Promise<void> {
  console.log('\nStarting sortTasks():')
  sortTasksInNote(Editor.note)
  console.log('Finished sortTasks():')
}
