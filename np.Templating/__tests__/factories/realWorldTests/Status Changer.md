---
title: Status Changer
type: meeting-note, empty-note, template-fragment 
---
<% prompt('newStatus','Status?', [🟡 - Review, 🟠 - Waiting on info,🟢 - Bound,🔵 - Quoted,🔴 - Declined,⚫ - Closed]) -%>
```templatejs
const statuses = ["🟡 - Review", "🟠 - Waiting on info", "🟢 - Bound", "🔵 - Quoted", "🔴 - Declined", "⚫ - Closed"];
let newContent = Editor.content.slice();
let contentContainsStatus = false;
statuses.forEach(s=>{
	if (newContent.includes(s)) {
		newContent = newContent.replace(s,newStatus);
		Editor.content = newContent;
		console.log(`\n\nNEW CONTENT:\n${newContent}`);
		contentContainsStatus = true;
	}
});

```