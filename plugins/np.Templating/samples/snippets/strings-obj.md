---
title: strings-obj
type: template-helper
description: Example using a JavaScript object literal
---
```javascript
// object literal
const strings = {
  reverseString: (str = '') => {
    return (str === '') ? '' : reverseString(str.substr(1)) + str.charAt(0)
  },

  uppercase: (str = '') => {
    return str.toUpperCase()
  }

}
```
