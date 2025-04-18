---
title: Account Status
type:
  - meeting-note
  - empty-note
  - template-fragment
---
<% prompt('newStatus','Status?', [🟡 - Review, 🟠 - Waiting on info,🟢 - Bound,🔵 - Quoted,🔴 - Declined,⚫ - Closed]) -%>
```templatejs
async function changeStatus() {
	const statuses = ["🟡 - Review", "🟠 - Waiting on info", "🟢 - Bound", "🔵 - Quoted", "🔴 - Declined", "⚫ - Closed"];
	const holderFolder = "💎 Nirvana/Accounts"; // The containing folder the items are moved to based on their status
	let newContent = Editor.content.slice();
	const existingStatus = statuses.find(status => newContent.includes(status)) || null;

	if (existingStatus) {
		// Move the note to a folder based on the status name
		const folderToMoveTo = `${holderFolder}/${newStatus}`;
	    const newFilename = await DataStore.moveNote(Editor.filename, folderToMoveTo, "Notes");
	   await Editor.openNoteByFilename(newFilename); // re-open the moved note
		newContent = newContent.replace(existingStatus,newStatus);
		Editor.content = newContent;
	}
}
changeStatus()
```