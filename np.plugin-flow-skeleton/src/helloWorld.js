// @flow
// If you're not up for Flow typechecking (it's quite an undertaking), delete the line above
// Plugin code goes in files like this. Can be one per command, or several in a file.
// export default async function [name of the function called by Noteplan]
// Type checking reference: https://flow.org/
// Specific how-to re: Noteplan: https://github.com/NotePlan/plugins/blob/main/Flow_Guide.md

export async function helloWorld(): Promise<void> {
  const message = 'Hello World from {{pluginName}}!'

  // this will appear in NotePlan Plugin Console (NotePlan > Help > Plugin Console)
  console.log(message)

  // this will be inserted at cursor position
  await Editor.insertTextAtCursor(message)
}
