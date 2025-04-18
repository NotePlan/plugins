---
title: Chat via template
type: ignore 
---
### Calling from X-Callback Link:
#### Including Question with Output
noteplan://x-callback-url/runPlugin?pluginID=shared.AI&command=Get%20Chat%20Response&arg0=Provide%20a%20journal%20prompt%20question&arg1=true
#### Not Including Question with Output
noteplan://x-callback-url/runPlugin?pluginID=shared.AI&command=Get%20Chat%20Response&arg0=Provide%20a%20journal%20prompt%20question&arg1=false

### Calling via Template:
#### Including Question with Output
<%- await DataStore.invokePluginCommandByName("Get Chat Response","shared.AI",["Provide a journal prompt question","true"])  %>
#### Not Including Question with Output
<%- await DataStore.invokePluginCommandByName("Get Chat Response","shared.AI",["Provide a journal prompt question","false"])  %>

### Start An Ongoing Chat via Template
<% await DataStore.invokePluginCommandByName("NotePlan AI: Create Chat in New Document","shared.AI",["is this thing on?"])  %>

noteplan://x-callback-url/runPlugin?pluginID=shared.AI&command=NotePlan%20AI%3A%20Create%20Chat%20in%20New%20Document&arg0=Is%20this%20thing%20on%3F

---
