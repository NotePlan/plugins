export function moveNote(
  selectFolder: { index: number; value: string } | undefined
) {
  if (selectFolder) {
    // @ts-ignore
    const newFilename = DataStore.moveNote(Editor.filename, selectFolder);

    if (newFilename) {
      Editor.openNoteByFilename(newFilename, false, 0, 0);
      console.log("moving note was successful");
    } else {
      console.log("moving note was not successful");
    }
  }
}
