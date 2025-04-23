---
title: Readwise
type: ignore
openNoteTitle: <TODAY>
location: replace
writeUnderHeading: "Quotes to Remember"
---
<% const authToken = 'drr3XZIGG3zN0k21ZS46bVOkm9ofubI1MIfgZlDUV7g7ZPUJl5' -%>
<% let url = "https://readwise.io/api/v2/highlights?page_size=1&page=" + Math.floor(Math.random() * 1000) -%>
<% const rwHResult = await fetch(url, { method: 'GET', contentType: 'application/json', headers: { 'Authorization': 'Token ' + authToken } }) -%>
<% var rwHParsed = null -%>
<% try { -%>
<% rwHParsed = JSON.parse(rwHResult) -%>
<% } catch (error) { -%>
<%   console.log(`${error.toString()}\n\n${url}\n\n${rwHResult}`) -%>
<% }	<% var rwBParsed = null -%>
<% try { -%>
<% rwBParsed = JSON.parse(rwBResult) -%>
<% } catch (error) { -%>
<%   console.log(`${error.toString()}\n\n${url}\n\n${rwBResult}`) -%>
<% } -%>
<% const rwAuthor = !rwBParsed?.author ? "(unknown author)" : "-- " + rwBParsed.author -%>
> <%- rwText %> <%- rwAuthor -%>  
> [refresh](noteplan://x-callback-url/runPlugin?pluginID=np.Templating&command=np:tr&arg0=Readwise&arg1=true) <%# MAKE SURE THERE ARE NO LINE RETURNS AFTER THIS -%>