---
title: All Templates Tester
type: template-runner
getNoteTitled: All Templates Test Results
startIndex: 0
endIndex: 0
writeUnderHeading: Templates
createList: true
appendHere: noteplan://x-callback-url/runPlugin?pluginID=np.Templating&command=Append%20template%20to%20end%20of%20current%20note&arg0=All%20Templates%20Tester
launchLink: noteplan://x-callback-url/runPlugin?pluginID=np.Templating&command=templateRunner&arg0=All%20Templates%20Tester&arg1=true
---
```templatejs
const templates = DataStore.projectNotes.filter(f=>f.filename.startsWith("@Templates")).filter(f=>f.frontmatterTypes)
const templateList = templates.map(t=>t.title)
```
```javascript
const templatesToTest = <%- JSON.stringify(templateList,null,2) %>

```
