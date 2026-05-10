import { getTasksByType } from './sorting'

export function getAllTasksFromCurrentNote(currentNote) {
    // This function will extract all tasks from the current note and return them grouped by type
    // It uses the getTasksByType function to categorize the tasks
    const groupedTasks =  getTasksByType(currentNote.paragraphs)

    return groupedTasks.open.concat(groupedTasks.scheduled, groupedTasks.done, groupedTasks.cancelled, groupedTasks.checklist, groupedTasks.checklistScheduled,
      groupedTasks.checklistDone, groupedTasks.checklistCancelled)
}