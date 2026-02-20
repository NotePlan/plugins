export const noteWIthOpenAndCancelledTasks = {
  paragraphs: [
    { type: 'title', lineIndex: 0, content: 'Title', headingLevel: 1 },
    { type: 'empty', lineIndex: 1 },
    { type: 'title', lineIndex: 2, content: 'Tasks for 3.4.22', headingLevel: 2 },
    { type: 'open', lineIndex: 3, content: 'task 1' },
    { type: 'title', lineIndex: 4, content: 'Journal for 3.4.22' },
    { type: 'list', lineIndex: 5, content: 'first journal entry' },
    { type: 'list', lineIndex: 6, content: 'second journal entry' },
    { type: 'empty', lineIndex: 7 },
    { type: 'title', lineIndex: 8, content: 'Done ...', headingLevel: 2 },
    { type: 'title', lineIndex: 9, content: 'Cancelled', headingLevel: 2 },
    { type: 'cancelled', lineIndex: 10, content: 'task cancelled' },
  ],
}

export const noteWIthDoneAndScheduledTasks = {
    paragraphs: [
      { type: 'title', lineIndex: 0, content: 'Title', headingLevel: 1 },
      { type: 'empty', lineIndex: 1 },
      { type: 'title', lineIndex: 2, content: 'Tasks for 3.4.22', headingLevel: 2 },
      { type: 'scheduled', lineIndex: 3, content: 'task 1' },
      { type: 'title', lineIndex: 4, content: 'Journal for 3.4.22' },
      { type: 'list', lineIndex: 5, content: 'first journal entry' },
      { type: 'list', lineIndex: 6, content: 'second journal entry' },
      { type: 'empty', lineIndex: 7 },
      { type: 'title', lineIndex: 8, content: 'Done ...', headingLevel: 2 },
      { type: 'done', lineIndex: 10, content: 'task finished' },
    ],
  }

  export const noteWithOpenAndDoneTasks = {
    paragraphs: [
      { type: 'title', lineIndex: 0, content: 'Title', headingLevel: 1 },
      { type: 'empty', lineIndex: 1 },
      { type: 'open', lineIndex: 2, content: 'Open task 1' },
      { type: 'open', lineIndex: 3, content: 'Open task 2' },
      { type: 'done', lineIndex: 4, content: 'Done task' },
    ],
  }

export const noteWithOneTaskOfEachType = {
  paragraphs: [
    { type: 'title', lineIndex: 0, content: 'Title', headingLevel: 1 },
    { type: 'empty', lineIndex: 1 },
    { type: 'open', lineIndex: 2, content: 'Open task 1' },
    { type: 'scheduled', lineIndex: 3, content: 'Scheduled task 2' },
    { type: 'done', lineIndex: 4, content: 'Done task' },
    { type: 'cancelled', lineIndex: 5, content: 'Cancelled task' },
    { type: 'checklist', lineIndex: 6, content: 'checklist' },
    { type: 'checklistDone', lineIndex: 7, content: 'checklistDone' },
    { type: 'checklistCancelled', lineIndex: 8, content: 'checklistCancelled' },
    { type: 'checklistScheduled', lineIndex: 9, content: 'checklistScheduled' },
  ],
}