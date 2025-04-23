---
title: authorstamp
note: "not working yet. says EOF. but i am not sure why"
author: dbw
time: <%- timestamp() %>
lastEditField: Last Edit
lastEditValue: "Last Edit: by <%- author %> @ <%- time %>"
type: meeting-note, empty-note
Last Edit: foo
---
```templatejs
const content = Editor.content;
const regex = new RegExp(`${lastEditField}: .*$`);

// Replace the text after lastEditField with the replacementString
const outputString = content.replace(regex, lastEditValue);
if (outputString) { Editor.content = outputString; }

```
