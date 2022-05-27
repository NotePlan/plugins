// @flow
import { clo, log } from '@helpers/dev'

export async function pluginTester(): Promise<void> {
  const test = 'Evaluation is ' ?? 'NOT '
  const test2 = ['working', 'correctly ']?.join(' ')
  console.log(`1) Test of ??: ${test}${test2}`)
  console.log(
    'The previous line should read "Test of ??: Evaluation is working correctly"',
  )
  console.log(
    '2) pluginTester: About to await Editor.insertTextAtCursor. You should get another output line after this one.',
  )

  await Editor.insertTextAtCursor(
    `[Plugins must be working...a plugin put this text here!]`,
  )
  console.log(
    `3) pluginTester: Just inserted some text in the Editor, and here is some text in the plugin console: Noteplan > Help > Plugin Console`,
  )
}

/**
 * Test writing to a calendar date that doesn't exist yet
 * @author @jgclark
 */
export function writeToNewCalendarNote(): void {
  let cf = "20220609.md"
  let n = DataStore.calendarNoteByDateString(cf)
  n?.insertParagraph('new text line', 0, 'text')
  log('tester', `written a new line to ${cf}`)
}
