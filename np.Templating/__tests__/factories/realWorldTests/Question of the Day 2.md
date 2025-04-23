---
title: Quote from List snippet
type: snippet 
---
<%# place the following lines in any note with the title of the source document and then import this note -%>
<%# const n = DataStore.projectNoteByTitle("Question List")[0] -%>
<% const p = n.paragraphs.slice(1) -%>
<% const q = `${p[Math.floor(Math.random() * (p.length - 1))].content}` -%>
<% const a = await CommandBar.textPrompt('Question of the Day',q,'') -%>
> <%- q %>