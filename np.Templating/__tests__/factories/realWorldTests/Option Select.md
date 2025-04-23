---
title: Option Select
type: meeting-note, empty-note
---
```templatejs
const choices = ["article a","article b","article c"];
const values = ["Workout Upper Body","Workout Lower Body","Rest Day"];
const chosen = await CommandBar.showOptions(choices)

``` 
Option chosen: <%- chosen.value %>
Corresponding value: <%- values[chosen.index] %>
  
