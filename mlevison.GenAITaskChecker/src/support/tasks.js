// @flow

import { getTasksByType } from '@helpers/sorting'


// This is a good way to do much of your plugin work in isolation, with tests, and then the NPxxx files can be smaller
// And just focus on NotePlan input/output, with the majority of the work happening here
// Reminder:
// About Flow: https://flow.org/en/docs/usage/#toc-write-flow-code
// Getting started with Flow in NotePlan: https://github.com/NotePlan/plugins/blob/main/Flow_Guide.md

export function getAllTasksFromCurrentNote(currentNote) {
  // This function will extract all tasks from the current note and return them grouped by type
  // It uses the getTasksByType function to categorize the tasks
 const groupedTasks =  getTasksByType(currentNote.paragraphs)

 return groupedTasks.open.concat(groupedTasks.done)
}