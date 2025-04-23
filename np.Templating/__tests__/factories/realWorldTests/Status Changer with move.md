---
title: Status Changer (with move)
type: meeting-note, empty-note, template-fragment 
---
<% prompt('newStatus','Status?', [🟡 - Review, 🟠 - Waiting on info,🟢 - Bound,🔵 - Quoted,🔴 - Declined,⚫ - Closed]) -%>
```templatejs
const statuses = ["🟡 - Review", "🟠 - Waiting on info", "🟢 - Bound", "🔵 - Quoted", "🔴 - Declined", "⚫ - Closed"];
let newContent = Editor.content.slice();
statuses.forEach(async s=>{
	if (newContent.includes(s)) {
		newContent = newContent.replace(s,newStatus);
		Editor.note.content = newContent;
		// Move the note to a folder based on the status name (everything after the dot and the -), e.g. "Bound"
		const folderToMoveTo = newStatus.split(" - ")[1].trim();
        const newFilename = DataStore.moveNote(Editor.filename, folderToMoveTo, "Notes");
        await Editor.openNoteByFilename(newFilename); // re-open the moved note
	}
});
```