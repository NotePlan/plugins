---
title: PromptKey tag test
type: meeting-note, empty-note
new note: noteplan://x-callback-url/runPlugin?pluginID=np.Templating&command=Create%20new%20note%20using%20template&arg0=PromptKey%20tag%20test&arg1=DELETEME
append: noteplan://x-callback-url/runPlugin?pluginID=np.Templating&command=Append%20template%20to%20end%20of%20current%20note&arg0=PromptKey%20tag%20test
bgc: 
---
--
bg-color: <%- promptKey("bg-color", "Choose the bg-color tag","Notes",true,"folder1",false) -%> 
bg-color-dark: <%- promptKey("bg-color-dark", "Choose the bg-color-dark tag","Notes",true,"DELETEME",false) -%>
--
<% const category = promptKey("category") -%>
<% if (category === "Work") { -%>
Work project: <%- promptKey("project", "Select work project", "Notes", false, "Work") -%>
<% } else { -%>
Personal project: <%- promptKey("project", "Select personal project", "Notes", false, "Personal") -%>
<% } -%>
---
bg-color: #ddd 
bg-color-dark: #180E01
---
promptKey(category)
Personal project: abc
