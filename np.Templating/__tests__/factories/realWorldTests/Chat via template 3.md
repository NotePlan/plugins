---
title: Chat via template with FM
type: ignore 
journalProm: <%- DataStore.invokePluginCommandByName("Get Chat Response","shared.AI",["Provide a journal prompt question","true"])  %>
---
<%- journalProm %>


