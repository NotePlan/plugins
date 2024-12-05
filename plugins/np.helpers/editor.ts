/**
 * Run Editor.save() if active Editor is dirty and needs saving
 * Does nothing if Editor and Editor.note are the same (has been saved)
 * If they don't match, it saves
 * @usage await saveEditorIfNecessary()
 * @dwertheimer sometimes found that calling Editor.save() on a note which didn't need saving would crash the plugin
 */
export async function saveEditorIfNecessary() {
  if (!Editor?.note) throw 'There is no active Editor.note'
  if (Editor.note?.content !== Editor.content) await Editor.save() // ensure recent/unsaved changes get saved first
}
