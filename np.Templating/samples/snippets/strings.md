---
title: strings
type: template-helper
description: string functions
---
```javascript
const name = 'Mike'

// example 1: Functional Express
const reverseString = (str = '') => {
  return (str === '') ? '' : reverseString(str.substr(1)) + str.charAt(0)
}

// example 2: Standard Function
function uppercase(str) {
  return str.toUpperCase()
}
```
