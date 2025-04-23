---
title: Remove blank/empty Lines
type: meeting-note, empty-note
getNoteTitled: <current>
location: replace
runLink: noteplan://x-callback-url/runPlugin?pluginID=np.Templating&command=templateRunner&arg0=Remove%20blank%2Fempty%20Lines&arg1=true
---
<% Editor.content = Editor.paragraphs.filter(p=>p.type!=="empty").map(p=>p.rawContent).join("\n") -%>