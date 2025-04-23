---
title: Complete a hashed task
type: templateRunner
getnotetitled: <today>
location: append
note: Put the tag you want to search for at the end of the line below. %23 is '#'
link: noteplan://x-callback-url/runPlugin?pluginID=np.Templating&command=templateRunner&arg0=Complete%20a%20hashed%20task&arg1=false&arg2=tag%3D%23t
---
```templatejs
const theNote = await Editor.openNoteByDate(new Date());
const thePara = theNote.paragraphs.find(p=>p.type === "open" && p.content.includes(tag));
if (thePara) {
  thePara.type = "done";
  thePara.note.updateParagraph(thePara)
} else {
  await CommandBar.prompt(`Did not find an open task with: ${tag}`);
}

```