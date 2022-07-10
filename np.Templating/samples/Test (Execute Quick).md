---
title: Test (Execute Quick)
type: empty-note
---
# Quick
```javascript
const lname = 'Erickson'

const fullName = (fname = '', lname = '') => {
  return `${fname} ${lname}`
}
```
```javascript
const fname = await CommandBar.textPrompt('Enter First Name','')

const uppercase = (str) => {
  return str.toUpperCase()
}

const newName = uppercase(fname)
```
```javascript
// template: ignore
const temp = 'Mike'
```
<%# This section of code is referencing variables from above %>

first name: *<%- fname %>*
last name: *<%-lname %>*
uppercase first name: *<%- newName %>*
full name: *<%- fullName(fname, lname) %>*
