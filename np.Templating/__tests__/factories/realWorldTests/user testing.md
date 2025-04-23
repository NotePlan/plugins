---
title: user testing
type: meeting-note, empty-note
discord: https://discord.com/channels/763107030223290449/1354373804327047178/1354373806881247413
---
```templatejs
async function listNotesStartingWith(prefix) {
  // Retrieve all regular notes
  const notes = DataStore.projectNotes;

  // Filter notes which title begins with the specified prefix.
  const filteredNotes = notes.filter(note => {
    if (!note.title || !note.title.startsWith(prefix)) return false;

    // Extract the path from the `filename` (everything before the last `/`)
    const folder = note.filename.includes("/") ? note.filename.substring(0, note.filename.lastIndexOf("/")) : "";
    
    return !folder.includes("@"); // Exclude notes in folders with a '@' in the name (like @recycle and @trash)
  });

   // Return no output if there are no such notes
   if (filteredNotes.length === 0) {
     return;
  }

  // Return a list of files starting with the specified prefix at the end of the note
  let output = `**Nicht abgeschlossene Themen**`;
  filteredNotes.forEach(note => output += `\n[[${note.title}]]`);
  return output;
}
```
<%- listNotesStartingWith("⬜︎") %>
