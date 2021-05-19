// @flow strict

import { filenameDateString } from './dateHelpers';
import sweepCalendarNote from './sweepCalendarNote';
import sweepProjectNote from './sweepProjectNote';

const OPTIONS = [
  { label: '7 days', value: 7, unit: 'day' },
  { label: '14 days', value: 14, unit: 'day' },
  { label: '21 days', value: 21, unit: 'day' },
  { label: '1 month', value: 1, unit: 'month' },
  { label: '3 months', value: 3, unit: 'month' },
  { label: '6 months', value: 6, unit: 'month' },
  { label: '1 year', value: 1, unit: 'year' },
  { label: '❌ Cancel', value: 0, unit: 'day' },
];
const DEFAULT_OPTION = { unit: 'day', value: 0 };

/**
 * TODO:
 * 1. Add option to move all tasks silently
 * 2. Add option to reschedule instead of move Calendar notes
 * 3. Add option to change target date from "Today" to something you can choose
 *  */
export default async function sweepAll(): Promise<void> {
  const { index } = await CommandBar.showOptions(
    OPTIONS.map((option) => option.label),
    '🧹 Reschedule tasks to today of the last...',
  );

  if (index < 0 || index >= 7) {
    // Invalid option
    return;
  }

  const { unit, value } = OPTIONS[index] ?? DEFAULT_OPTION;

  const afterDateFileName = filenameDateString(
    Calendar.addUnitToDate(new Date(), unit, -value),
  );
  await CommandBar.showInput('Dealing with your Project Notes First', 'OK');

  for (const note of DataStore.projectNotes) {
    await sweepProjectNote(note, true, afterDateFileName, false);
  }

  await CommandBar.showInput(`Now let's look at your Daily Notes`, 'OK');

  const todayFileName = filenameDateString(new Date());
  const recentCalNotes = DataStore.calendarNotes.filter(
    (note) =>
      note.filename < todayFileName && note.filename >= afterDateFileName,
  );

  for (const note of recentCalNotes) {
    await sweepCalendarNote(note, true, false);
  }

  await CommandBar.showInput(`All Done!`, 'OK');
}
