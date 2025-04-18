---
title: Prompt Key
type: meeting-note, empty-note
---
## Prompt Key
```
promptKey-01: <%- promptKey('bg-color') %>
promptKey-02: <%- promptKey('bg-color', 'Press any key:') %>
promptKey-03: <%- promptKey('bg-color', 'Press y/n:', ['y', 'n']) %>
promptKey-04: <%- promptKey('type', 'Press a key with, comma message') %>
promptKey-05: <%- promptKey('foo', 'Press a key with "quotes"') %>
promptKey-06: <%- promptKey('bar', "Press a key with 'quotes'") %>
promptKey-09 (var): <% var var9 = promptKey('Enter your value 09:') %><%- var9 %>
await promptKey-10 (await): <% await promptKey('Enter your value 10:') %>
```
