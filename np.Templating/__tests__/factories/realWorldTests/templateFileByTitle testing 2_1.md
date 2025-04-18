---
title: todayTask
type: self-runner
writeNoteTitle: <TODAY>
writeUnderHeading-old: "Tasks"
location: prepend
exampleWithOpen: Needs udating noteplan://x-callback-url/runPlugin?pluginID=np.Templating&command=templateRunner&arg0=cdjournal&arg1=true&arg2=journalEntry%3Dweek%20that%20worked
exampleSilent: noteplan://x-callback-url/runPlugin?pluginID=np.Templating&command=templateRunner&arg0=todayTask&arg1=false&arg2=param1%3Dsomething
---
* <%- param1 %>