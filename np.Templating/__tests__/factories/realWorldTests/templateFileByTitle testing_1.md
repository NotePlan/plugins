---
title: cdjournal
type: self-runner
ABOUTwriteNoteTitle: <THISWEEK> or <NEXTWEEK>
writeNoteTitle: <NEXTWEEK>
1openNoteTitle: <TODAY>
writeUnderHeading: "📝 Journal"
location: append
exampleWithOpen: noteplan://x-callback-url/runPlugin?pluginID=np.Templating&command=templateRunner&arg0=cdjournal&arg1=true&arg2=journalEntry%3Dweek%20that%20worked
exampleSilent: noteplan://x-callback-url/runPlugin?pluginID=np.Templating&command=templateRunner&arg0=cdjournal&arg1=false&arg2=journalEntry%3Dweek%20that%20worked
---
- <%- journalEntry %> (<%- date.timestamp() %>)
some content here
