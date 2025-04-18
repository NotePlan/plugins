---
title: Search in a note
type: ignore 
---
<% const res = await DataStore.search("pool")  -%> 
Found: <%- res.length %> results
Example: 
<%- res.length && res[0].content %>
 
Found:  results
Example: 

