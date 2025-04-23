---
title: JSON API Test
type: ignore 
---
```javascript
const response = await fetch('https://jsonplaceholder.typicode.com/todos/1')
clo(response)
const responseObj = JSON.parse(response)
const detail = responseObj.title ? `, ${responseObj.title}` : ''
const outputText = `${responseObj.id}: ${detail} ${responseObj.completed}`

```
<%- outputText %>
