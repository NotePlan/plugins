---
title: Question of the day
type: snippet 
---
<%# place the following line in any note and then import this one %>
<%# const n = DataStore.projectNoteByTitle("Question List")[0] -%>
<% const p = n.paragraphs.slice(1) -%>
<% const q = `${p[Math.floor(Math.random() * (p.length - 1))].content}` -%>
<% const a = await CommandBar.textPrompt('Question of the Day',q,'') -%>
> Q: <%- q %>
> A: <%- a %>