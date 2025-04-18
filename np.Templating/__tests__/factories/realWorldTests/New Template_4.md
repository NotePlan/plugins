---
title: Prompt Mention
type: meeting-note, empty-note
---
## PromptMention
```
promptMention-01: <%- promptMention() %>
promptMention-02: <%- promptMention('Select a mention:') %>
promptMention-03: <%- promptMention('Select a mention:', 'a.*') %>
promptMention-04: <%- promptMention('Select a mention:', '', 'test') %>
promptMention-05: <%- promptMention('Select a mention:', 'w.*', 'test', true) %>
promptMention-06: <%- promptMention('Select a mention with, comma in message') %>
promptMention-07: <%- promptMention('Select a mention with "quotes"') %>
promptMention-08: <%- promptMention("Select a mention with 'quotes'") %>
promptMention-09 (var): <% var mention = promptMention('Select your mention:') %><%- mention %>
promptMention-10 (await): <% var mention = await promptMention('Select your mention:') %><%- mention %>
promptMention-11 (await): <% await promptMention('Select any mention:') %>
```