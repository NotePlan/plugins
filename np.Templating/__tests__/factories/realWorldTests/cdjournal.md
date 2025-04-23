---
title: Hileotech Assignment Self Running Template
type: ignore
openNoteTitle:  <CHOOSE>
writeUnderHeading: <CHOOSE>
location: append
text: <%- prompt('text',"What text do you want to add?") -%>
url: noteplan://x-callback-url/runPlugin?pluginID=np.Templating&command=templateRunner&arg0=Hileotech%20Assignment%20Self%20Running%20Template&arg1=true
---
-  <%- date8601() %>: <%- text %>
- 