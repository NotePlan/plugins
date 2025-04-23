---
title: "Tasks-Test taskSync"
type: ignore 
searchFor: "@everse/kyle"
searchInTypes: calendar, notes
includeTaskTypes: open
sortByFields: -priority, content
outputFilename: _TEST/Tasks-Test
inFolders: _TEST
notInFolders: zDELETEME
headings: noteTitle-TBD
WHEREAMI:
	- "search not working, check include/exclude. simplify search"
TODO: 
	- "trap for parens cuz they break the link"
---
<%# INSTRUCTIONS: -%>
<%# 1) EDIT the frontmatter fields above -%> <%# 2) Run np:append on this template to create a link -%> <%# 3) Click the link created at the bottom of this document -%>
<%# Note: Eventually np:invoke will work without the link -%>
<%# Don't touch these lines: -%>
<% const searchForEnc = encodeURIComponent(searchFor) -%>
<% const includeTaskTypesEnc = encodeURIComponent(includeTaskTypes) -%>
<% const searchInTypesEnc = encodeURIComponent(searchInTypes) -%>
<% const sortByFieldsEnc = encodeURIComponent(sortByFields) -%>
<% const outputFilenameEnc = encodeURIComponent(outputFilename) -%>
<% const inFoldersEnc = encodeURIComponent(inFolders) -%>
<% const notInFoldersEnc = encodeURIComponent(notInFolders) -%>
<% const headingsEnc = encodeURIComponent(headings) -%>
[Click Here to Generate Document for Above Configuration](noteplan://x-callback-url/runPlugin?pluginID=dwertheimer.TaskAutomations&command=task%20sync&arg0=<%- searchForEnc %>&arg1=<%- searchInTypesEnc %>&arg2=<%- includeTaskTypesEnc %>&arg3=<%- sortByFieldsEnc %>&arg4=<%- outputFilenameEnc %>&arg5=<%- inFoldersEnc %>&arg6=<%- notInFoldersEnc %>&arg7=<%- headingsEnc %>)
<%# ^^^ Don't touch these lines -%> 
**All tasks (Not DELETE,TEST, no filename set)** [Click Here to Generate Document for Above Configuration](noteplan://x-callback-url/runPlugin?pluginID=dwertheimer.TaskAutomations&command=task%20sync&arg0=%40everse%2Fkyle&arg1=calendar%2C%20notes&arg2=open&arg3=-priority%2C%20content&arg4=*&arg5=*&arg6=zDELETEME,_TEST&arg7=noteTitle-TBD

Same but With Filename
[Click Here to Generate Document for Above Configuration](noteplan://x-callback-url/runPlugin?pluginID=dwertheimer.TaskAutomations&command=task%20sync&arg0=%40everse%2Fkyle&arg1=calendar%2C%20notes&arg2=open&arg3=-priority%2C%20content&arg4=zDELETEME/TestOutFile&arg5=*&arg6=zDELETEME,_TEST&arg7=noteTitle-TBD

Missing args
[Click Here to Generate Document for Above Configuration](noteplan://x-callback-url/runPlugin?pluginID=dwertheimer.TaskAutomations&command=task%20sync&arg0=%40everse%2Fkyle&arg4=zDELETEME/TestOutFile&arg6=zDELETEME,_TEST

noteplan://x-callback-url/runPlugin?pluginID=dwertheimer.TaskAutomations&command=task%20sync&arg0=%40everse%2Fkyle&arg4=_TEST%2FTasks-Test&arg5=zDELETEME 

noteplan://x-callback-url/runPlugin?pluginID=dwertheimer.TaskAutomations&command=task%20sync&arg0=%40everse%2Fkyle&arg1=arg1&arg5=arg5

