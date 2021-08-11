// @flow
export async function pluginTester(): Promise<void> {
  console.log(
    'pluginTester: About to await Editor.insertTextAtCursor. You should get another output line after this one.',
  )
  await Editor.insertTextAtCursor(
    `[Plugins must be working...a plugin put this text here!]`,
  )
  console.log(
    `pluginTester: Just inserted some text in the Editor, and here is some text in the plugin console: Noteplan > Help > Plugin Console`,
  )
}
