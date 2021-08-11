// @flow
export async function pluginTester(): Promise<void> {
  console.log(
    'pluginTester: About to await Editor.insertTextAtCursor. You should get another output line after this one.',
  )
  const test = 'foo' ?? 'bar'
  const test2 = [1, 2]?.join('-')
  console.log(test + test2)

  await Editor.insertTextAtCursor(
    `[Plugins must be working...a plugin put this text here!]`,
  )
  console.log(
    `pluginTester: Just inserted some text in the Editor, and here is some text in the plugin console: Noteplan > Help > Plugin Console`,
  )
}
