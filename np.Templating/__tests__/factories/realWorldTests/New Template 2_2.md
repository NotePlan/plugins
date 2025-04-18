---
title: Prompt Tag
type: meeting-note, empty-note
---
## Prompt Tag
```
promptTag-01: <%- promptTag() %>
promptTag-02: <%- promptTag('Select a tag:') %>
promptTag-03: <%- promptTag('Select a tag:', 'work.*') %>
promptTag-04: <%- promptTag('Select a tag:', '', 'personal') %>
promptTag-05: <%- promptTag('Select a tag:', 'proj.*', 'test', true) %>
promptTag-06: <%- promptTag('Select a tag with, comma in message') %>
promptTag-07: <%- promptTag('Select a tag with "quotes"') %>
promptTag-08: <%- promptTag("Select a tag with 'quotes'") %>
promptTag-09 (var): <% var tag = promptTag('Select your tag:') %><%- tag %>
promptTag-10 (await var): <% var tag = await promptTag('Select your tag:') %><%- tag %>
promptTag-11 (await): <% await promptTag('Select any tag:') %>
```