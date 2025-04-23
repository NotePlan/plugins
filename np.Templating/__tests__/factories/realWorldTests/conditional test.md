---
title: conditional test
type: ignore 
---
# Conditional Test
--
<%  let tagValue = "## insert data with newlines before and after" -%>
<%- `${Boolean(tagValue) ? `\n${tagValue}` : "" }` -%>
<%# now let's use the same tag, but set the variable to empty and see it does not output anything -%>
<%  tagValue = "" -%>
<%- `${Boolean(tagValue) ? `\n${tagValue}` : "" }` %>
--
