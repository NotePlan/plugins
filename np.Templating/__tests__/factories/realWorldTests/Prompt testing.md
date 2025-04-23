---
title: _All Prompt testing
type: meeting-note, empty-note
launchLink: noteplan://x-callback-url/runPlugin?pluginID=np.Templating&command=Create%20new%20note%20using%20template&arg0=_All%20Prompt%20testing&arg1=DELETEME
---
<% import("zCurrentTest/All Prompts/Standard Prompt") %>
<% import("zCurrentTest/All Prompts/Prompt Date") %>
<% import("zCurrentTest/All Prompts/Prompt Date Interval") %>
<% import("zCurrentTest/All Prompts/Prompt Key") %>
<% import("zCurrentTest/All Prompts/Prompt Mention") %>
<% import("zCurrentTest/All Prompts/Prompt Tag") %>
<% import("zCurrentTest/All Prompts/Prompt Mixed") %>
## Notes
1. Variable names are automatically converted to have underscores instead of spaces.
2. Question marks are removed from variable names.
3. The templating system correctly handles quotes (both single and double) and commas inside quoted parameters.
4. Array parameters (with square brackets) are properly preserved during parsing.
5. Each prompt type saves its result to a variable in the session data.