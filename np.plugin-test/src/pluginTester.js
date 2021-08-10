// @flow
// If you're not up for Flow typechecking (it's quite an undertaking), delete the line above
// Plugin code goes in files like this. Can be one per command, or several in a file.
// export default async function [name of the function called by Noteplan]
// Type checking reference: https://flow.org/
// Specific how-to re: Noteplan: https://github.com/NotePlan/plugins/blob/main/Flow_Guide.md
export async function pluginTester(): Promise<void> {
  // write code here

  await Editor.insertTextAtCursor(
    `[Plugins must be working...a plugin put this text here!]`,
  )
  console.log(
    `pluginTester: Hello World. Just inserted some text in the Editor, and here is some text in the plugin console: Noteplan > Help > Plugin Console`,
  )
}
