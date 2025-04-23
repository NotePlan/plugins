---
title: Daily Progress Bar
type: templateRunner
getNoteTitled: <current>
writeUnderHeading: [Task Progress](noteplan://x-callback-url/runPlugin?pluginID=np.Templating&command=templateRunner&arg0=Daily%20Progress%20Bar&arg1=false)
launchLink: noteplan://x-callback-url/runPlugin?pluginID=np.Templating&command=templateRunner&arg0=Daily%20Progress%20Bar&arg1=false
location: replace
---
```templatejs
/**************************************
 * DAILY PROGRESS BAR TEMPLATERUNNER SCRIPT (THE TOP LEVEL) *
 **************************************/
const openTasks = note.openTasks().filter(p=>p.type==="open"&&p.content.trim()).length;
const closedTasks = note.completedTasks().filter(p=>p.type==="done").length;
const progressBarWidth = 20; // boxes wide
const totalTasks = closedTasks+openTasks;
const progressBarProgress = totalTasks > 0 ? Math.ceil((closedTasks/(closedTasks+openTasks))*progressBarWidth) : 0;
const caption = totalTasks ? `(${closedTasks}/${totalTasks})` : `(0/0)`
function getOutputText() { // will be called by the templateRunner Refreshable Content fragment
	return getProgressBarString(progressBarWidth,progressBarProgress,caption);
}
```
<% import("@Templates/Snippets/Refreshable Content Section") -%>
<% import("@Templates/Snippets/Progress Bar") -%>