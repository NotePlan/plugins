---
title: Chat via template without DataStore
type: ignore 
---
# 
noteplan://x-callback-url/runPlugin?pluginID=shared.AI&command=Get%20Chat%20Response&arg0=Provide%20a%20journal%20prompt%20question&arg1=true

<%- invokePluginCommandByName("shared.AI","Get Chat Response",["Provide a journal prompt question","true"])  %>

noteplan://x-callback-url/runPlugin?pluginID=shared.AI&command=Get%20Chat%20Response&arg0=Provide%20a%20journal%20prompt%20question&arg1=false

<%- invokePluginCommandByName("shared.AI","Get Chat Response",["Provide a journal prompt question","false"])  %>





