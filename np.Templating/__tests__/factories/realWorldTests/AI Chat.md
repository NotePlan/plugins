---
NoteToChatGPT: Ignore this Frontmatter Section
type: templateRunner
location: append
launchLink: noteplan://x-callback-url/runPlugin?pluginID=np.Templating&command=templateRunner&arg0=AI%20Chat2&arg1=true
replyLink: noteplan://x-callback-url/runPlugin?pluginID=np.Templating&command=templateRunner&arg0=AI%20Chat2&arg1=true&arg2=var1%3Dreply=true
getNoteTitled: <current>
thisNoteTitle: <%- Editor.title %>
currentTime: <%- date.now("YYYY-MM-DD HH:mm") %>
isReply: <%- typeof reply !== 'undefined' %>
title: AI Chat2
---
#### Me:
> <%- prompt('question', 'Your question:') %>
<% const aiPrompt = isReply === "true" ? `Follow up question: "${question}".` : `Provide a thorough response to this question which is not related to any specific notes: "${question}, using bullet points for clarity. Keep it concise, practical, and helpful—avoid fluff and limit linebreaks to one per paragraph unless essential.` -%>
#### AI <%- currentTime %>:
<%- await NotePlan.ai(aiPrompt,[Editor.filename]) %>
[Reply](noteplan://x-callback-url/runPlugin?pluginID=np.Templating&command=templateRunner&arg0=AI%20Chat2&arg1=true&arg2=var1%3Dreply=true)
