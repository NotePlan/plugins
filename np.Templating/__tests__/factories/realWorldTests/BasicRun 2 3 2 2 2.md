---
title: "SRT-NextWeek"
getNoteTitled: <NextWeek>
should: append output text to NextWeek's note (you will see a big foo below the tags)
location: append
type: self-runner
example:  noteplan://x-callback-url/runPlugin?pluginID=np.Templating&command=templateRunner&arg0=SRT-NextWeek&arg1=true&arg2=var1%3Dfoo%3Bvar2%3Dbar
---
# <%- var1 %>