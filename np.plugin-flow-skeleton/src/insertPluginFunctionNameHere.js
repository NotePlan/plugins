// @flow
// If you're not up for Flow typechecking (it's quite an undertaking), delete the line above
// Plugin code goes in files like this. Can be one per command, or several in a file.
// export default async function [name of the function called by Noteplan]
// Type checking reference: https://flow.org/
// Specific how-to re: Noteplan: https://github.com/NotePlan/plugins/blob/main/Flow_Guide.md
export async function insertPluginFunctionNameHere(): Promise<void> {
  // write code here
  console.log(
    `Hello World. This text shows up in the Noteplan > Help > Plugin Console`,
  )
  Editor.insertTextAtCursor(
    `This text shows up at the cursor in the note you're editing`,
  )
}
