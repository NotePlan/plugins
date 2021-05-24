// @flow
//-----------------------------------------------------------------------------
// Statistic commands
// Jonathan Clark & Eduard Metzger
// v0.2.0, 15.5.2021
//-----------------------------------------------------------------------------

function init() {
  // Anything you need to do to setup the script. You can keep it empty or delete the function, too.
}
globalThis.init = init;

// IDEAS TODO:
//	- Task counts across time frames, like this week, this month, this year.
// 	- Overdue counts
//	- Upcoming counts

//-----------------------------------------------------------------------------
// Helper function
function percent(value, total) {
  return value + ' (' + Math.round((value / total) * 100) + '%)';
}

//-----------------------------------------------------------------------------
// Show note counts
async function showNoteCount() {
  const calNotes = DataStore.calendarNotes;
  const projNotes = DataStore.projectNotes;
  const total = calNotes.length + projNotes.length;
  const createdLastMonth = projNotes.filter(
    (n) => Calendar.unitsAgoFromNow(n.createdDate, 'month') < 1,
  );
  const createdLastQuarter = projNotes.filter(
    (n) => Calendar.unitsAgoFromNow(n.createdDate, 'month') < 3,
  );
  const updatedLastMonth = projNotes.filter(
    (n) => Calendar.unitsAgoFromNow(n.changedDate, 'month') < 1,
  );
  const updatedLastQuarter = projNotes.filter(
    (n) => Calendar.unitsAgoFromNow(n.changedDate, 'month') < 3,
  );

  const display = [
    '🔢 Total: ' + total,
    '📅 Calendar notes: ' +
      calNotes.length +
      ' (equivalent to ' +
      Math.round(calNotes.length / 36.5) / 10.0 +
      ' years)',
    '🛠 Project notes: ' + projNotes.length,
    '    - created in last month: ' +
      percent(createdLastMonth.length, projNotes.length),
    '    - created in last quarter: ' +
      percent(createdLastQuarter.length, projNotes.length),
    '    - updated in last month: ' +
      percent(updatedLastMonth.length, projNotes.length),
    '    - updated in last quarter: ' +
      percent(updatedLastQuarter.length, projNotes.length),
  ];

  const re = await CommandBar.showOptions(
    display,
    'Notes count. Select anything to copy.',
  );
  if (re !== null) {
    Clipboard.string = display.join('\n');
  }
}
globalThis.showNoteCount = showNoteCount;

//-----------------------------------------------------------------------------
// Shows task statistics for project notes
async function showTaskCountProjects() {
  const projNotes = DataStore.projectNotes;
  const projNotesCount = projNotes.length;
  let doneTotal = 0;
  let openTotal = 0;
  let cancelledTotal = 0;
  let scheduledTotal = 0;
  const open = new Map(); // track the open totals as an object

  // Count task type for a single note
  const countTaskTypeInNote = function (inType) {
    // paragraphs is not defined here...
    return Editor.paragraphs.filter((p) => p.type == inType).length;
  };

  // Iterate over all project notes, counting
  for (let i = 0; i < projNotesCount; i += 1) {
    const n = projNotes[i];
    doneTotal += countTaskTypeInNote('done');
    openTotal += countTaskTypeInNote('open');
    open.set(n.title, countTaskTypeInNote('open'));
    cancelledTotal += countTaskTypeInNote('cancelled');
    scheduledTotal += countTaskTypeInNote('scheduled');
  }

  const closedTotal = doneTotal + scheduledTotal + cancelledTotal;
  const total = openTotal + closedTotal;
  const display = [
    'Task statistics from ' + projNotes.length + ' project notes:',
    '\t✅ Done: ' +
      percent(doneTotal, total) +
      '\t🚫 Cancelled: ' +
      percent(cancelledTotal, total),
    '\t⚪️ Open: ' + percent(openTotal, total),
    '\t📆 Scheduled: ' + percent(scheduledTotal, total),
    '\t📤 Closed: ' + percent(closedTotal, total),
  ];

  // Now find top 3 project notes by open tasks
  const openSorted = new Map([...open.entries()].sort((a, b) => b[1] - a[1]));
  display.push('Projects with most open tasks:');
  let i = 0;
  for (const elem of openSorted.entries()) {
    i += 1;
    display.push(`\t${elem[0] ?? ''} (${elem[1]} open)`);
    if (i >= 3) {
      break;
    }
  }

  const re = await CommandBar.showOptions(
    display,
    'Task stats. Select anything to copy.',
  );
  if (re !== null) {
    Clipboard.string = display.join('\n');
  }
}
globalThis.showTaskCountProjects = showTaskCountProjects;

//-----------------------------------------------------------------------------
// Show task counts for currently displayed note
async function showTaskCountNote() {
  const paragraphs = Editor.paragraphs;

  const countParagraphs = function (types) {
    return paragraphs.filter((p) => types.includes(p.type)).length;
  };

  const total = countParagraphs(['open', 'done', 'scheduled', 'cancelled']);

  const display = [
    '🔢 Total: ' + total,
    '✅ Done: ' + percent(countParagraphs(['done']), total),
    '⚪️ Open: ' + percent(countParagraphs(['open']), total),
    '🚫 Cancelled: ' + percent(countParagraphs(['cancelled']), total),
    '📆 Scheduled: ' + percent(countParagraphs(['scheduled']), total),
    '📤 Closed: ' +
      percent(countParagraphs(['done', 'scheduled', 'cancelled']), total),
  ];

  const re = await CommandBar.showOptions(
    display,
    'Task count. Select anything to copy.',
  );
  if (re !== null) {
    Clipboard.string = display.join('\n');
  }
}
globalThis.showTaskCountNote = showTaskCountNote;

//-----------------------------------------------------------------------------
// Show word counts etc. for currently displayed note
async function showWordCount() {
  const paragraphs = Editor.paragraphs;
  const note = Editor.note;
  if (note == null) {
    // No note open.
    return;
  }

  let charCount = 0;
  let wordCount = 0;
  let lineCount = 0;
  const mentionCount = note.mentions.length;
  const tagCount = note.hashtags.length;

  paragraphs.forEach((p) => {
    charCount += p.content.length;

    if (p.content.length > 0) {
      const match = p.content.match(/\w+/g);
      if (match != null) {
        wordCount += match.length;
      }
    }

    lineCount += 1;
  });

  const selectedCharCount = Editor.selectedText?.length ?? 0;
  let selectedWordCount = 0;

  if (selectedCharCount > 0) {
    selectedWordCount = Editor.selectedText?.match(/\w+/g)?.length ?? 0;
  }

  const selectedLines = Editor.selectedLinesText.length;

  const display = [
    'Characters: ' +
      (selectedCharCount > 0 ? selectedCharCount + '/' + charCount : charCount),
    'Words: ' +
      (selectedWordCount > 0 ? selectedWordCount + '/' + wordCount : wordCount),
    'Lines: ' +
      (selectedLines > 1 ? selectedLines + '/' + lineCount : lineCount),
    'Mentions: ' + mentionCount,
    'Hashtags: ' + tagCount,
  ];

  const re = await CommandBar.showOptions(
    display,
    'Word count. Select anything to copy.',
  );
  if (re !== null) {
    Clipboard.string = display.join('\n');
  }
}
globalThis.showWordCount = showWordCount;
