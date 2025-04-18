---
title: Prompt Date
type: meeting-note, empty-note
---
## Prompt Date
```
promptDate-01: <%- promptDate('dateVariable01') %>
promptDate-02: <%- promptDate('dateVariable02', 'Select a date:') %>
promptDate-03: <%- promptDate('dateVariable03', 'Select a date:', '{dateStyle: "full"}') %>
promptDate-04: <%- promptDate('dateVariable04', 'Select a date:', '{dateStyle: "medium", locale: "en-US"}') %>
promptDate-05: <%- promptDate('dateVariable05', 'Select a date with, comma:') %>
promptDate-06: <%- promptDate('dateVariable06', 'Select a date with "quotes":') %>
promptDate-07: <%- promptDate('dateVariable07', "Select a date with 'quotes':") %>
promptDate-08: <%- promptDate('dateVariable08', 'Select date:', '{dateFormat: "YYYY-MM-DD"}') %>
promptDate-09 (var): <% var var9 = promptDate('Enter your value 09:') %> <%- var9 %>


```
