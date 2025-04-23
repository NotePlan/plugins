---
title: SRT-SelectNote
getNoteTitled: <select>
should: "append output text to whatever note you select (probably best to pick this one)"
location: append
type: self-runner
example:  noteplan://x-callback-url/runPlugin?pluginID=np.Templating&command=templateRunner&arg0=SRT-SelectNote&arg1=true&arg2=var1%3Dfoo%3Bvar2%3Dbar
---
# <%- var1 %>