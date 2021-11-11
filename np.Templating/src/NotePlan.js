// @flow

export async function testInsertTexAtCursor(text: string = ''): Promise<void> {
  Editor.insertTextAtCursor(text)
}
