---
title: TemplateRunner: Replace current weather
type: templateRunner
getNoteTitled: <current>
writeUnderHeading: Current Weather
location: replace
launchLink: noteplan://x-callback-url/runPlugin?pluginID=np.Templating&command=templateRunner&arg0=TemplateRunner%3A%20Replace%20current%20weather&arg1=true
---
<%- await web.weather() %>