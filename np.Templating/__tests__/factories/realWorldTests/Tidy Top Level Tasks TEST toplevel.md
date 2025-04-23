---
title: Tidy Top Level Tasks TEST toplevel
type:
- meeting-note
- empty-note
---
## Tasks
* 
<% const tasks = await DataStore.invokePluginCommandByName("Move top-level tasks in Editor to heading","np.Tidy",["",true,true]);  -%>
<%- tasks %>