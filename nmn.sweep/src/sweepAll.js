// @flow strict

import { filenameDateString } from './dateHelpers';
import sweepCalendarNote from './sweepCalendarNote';
import sweepProjectNote from './sweepProjectNote';
import { chooseOption, showMessage } from './userInput';

type Option1 = $ReadOnly<{
  num: number,
  unit: 'day' | 'month' | 'year',
}>;

const OPTIONS = [
  { label: '7 days', value: { num: 7, unit: 'day' } },
  { label: '14 days', value: { num: 14, unit: 'day' } },
  { label: '21 days', value: { num: 21, unit: 'day' } },
  { label: '1 month', value: { num: 1, unit: 'month' } },
  { label: '3 months', value: { num: 3, unit: 'month' } },
  { label: '6 months', value: { num: 6, unit: 'month' } },
  { label: '1 year', value: { num: 1, unit: 'year' } },
  { label: '❌ Cancel', value: { num: 0, unit: 'day' } },
];
const DEFAULT_OPTION: Option1 = { unit: 'day', num: 0 };

/**
 * TODO:
 * 1. Add option to move all tasks silently
 * 2. Add option to reschedule instead of move Calendar notes
 * 3. Add option to change target date from "Today" to something you can choose
 *  */
export default async function sweepAll(): Promise<void> {
  const { unit, num } = await chooseOption<Option1>(
    '🧹 Reschedule tasks to today of the last...',
    OPTIONS,
    DEFAULT_OPTION,
  );

  const afterDateFileName = filenameDateString(
    Calendar.addUnitToDate(new Date(), unit, -num),
  );
  await CommandBar.showInput('Dealing with your Project Notes First', 'OK');

  for (const note of DataStore.projectNotes) {
    await sweepProjectNote(note, true, afterDateFileName, false);
  }

  await showMessage(`Now let's look at your Daily Notes`);

  const todayFileName = filenameDateString(new Date());
  const recentCalNotes = DataStore.calendarNotes.filter(
    (note) =>
      note.filename < todayFileName && note.filename >= afterDateFileName,
  );

  for (const note of recentCalNotes) {
    await sweepCalendarNote(note, true, false);
  }

  await showMessage(`All Done!`);
}
