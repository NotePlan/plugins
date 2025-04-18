---
title: Accounts - New Biz
type: ignore
accountname:
- <%- prompt('accountName'
- '''What is the account name?'') %>'
effdate:
- <%- prompt('effDate'
- '''What is the effective date?'') %>'
status:
- <%- prompt('status'
- '''Current Status:'') %>'
newnotetitle: '<%- accountName %> | Effective: <%- effDate %>'
folder: <select>
---
* <%- accountName %> | <%- effDate %> | <%- status %>
[Move Note](   )
+ Review
+ Rate
+ Price
+ Discuss With UW
+ OFAC check Decision:
+ Quoted + QNA
+ Bound + Declined
+ Upload Correspondence
+ Update Log
+ CompleteApplicationWF
+ Update Application Disposition
+ Complete Filings
+ Upload Filings
+ Receive/Upload Signed Forms
+ Upload Correspondence
+ Update Pricing
+ Update Account Log