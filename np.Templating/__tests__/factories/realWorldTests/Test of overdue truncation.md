---
title: Test of overdue truncation
type: meeting-note, empty-note 
---
```templatejs
const overdues = await DataStore.listOverdueTasks()
const socksTask = overdues.filter(t=>/socks/.test(t.content))
clo(socksTask)

```


