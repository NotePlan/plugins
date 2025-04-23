---
title: weekstart weekof weekend
type: meeting-note, empty-note
---


```
Week <%- date.weekNumber("") %> - <%- date.startOfWeek("", "", 1) %> .. <%- date.endOfWeek("", "", 1) %>
weekOf: <%- date.weekOf(1,7,"2024-04-14") %>
```
YIELDS:

Week 16 - 4/14/25 .. 4/20/25
weekOf: W16 (2025-04-14..2025-04-20)

