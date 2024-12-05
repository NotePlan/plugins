---
title: Test (Execute)
type: empty-note
---
# np.Templating Execute
*The following rules are required for each code block when np.Templating execute code blocks located in template files.*

- Code blocks are "fenced" code that has the following characteristics
	- start with three backticks, immediately followed by either `javascript` or `js`
	- followed by valid JavaScript code
	- end with three backticks
- If you want the resulting output into note when invoking the template, a `return` statement should be at the end of the code block (before closing backticks)
- Each code block is considered isolated, thus any methods which may have been declared in one block may not be used in any subsequent blocks
- If a code block other than `javascript` or `js` is found, it will be returned as static template content and will not be executed

---
## Todo
*The following items need to be implemented*

#### Version 1.5
* Using np.Templating Modules
* Add `np:execute` command
	* Try out @dwertheimer theme switcher
* [x] Need to strip out all comments from non-ignored blocks
* Create example using web services, fetch, etc.
	- Using JIRA Example
---
## Examples
*The following examples demonstrate how np.Templating executes various code blocks*

#### Block 1: Lowercase
*The following block will lowercase `name` and output `mike` when the template is rendered*
```javascript
const lowercase = (inString = '') => {
  return inString.toLowerCase()
}

const name = 'Mike'

let result = lowercase(name)
```
Lowercase Name: *<%- result %>*

#### Block 2: Uppercase
*The following block will uppercase `name` and output `MIKE` when the template is rendered*
```javascript

const uppercase = (inString = '') => {
  return inString.toUpperCase()
}

const name2 = 'mike'

result = uppercase(name2)
```
Uppercase Name: *<%- result %>*

#### Block 3: Object Processing
*The following block will perform the operation on object literal*
```javascript
const fullName = (nameObj) => {
  return `${nameObj.fname} ${nameObj.lname}`
}

const user = {fname: 'Mike', lname: 'Erickson'}

result = JSON.stringify(user)

result += '\n' + fullName(user)
```
Full Name:
<%- result %>

#### Block 4: Returning object
*The following example demonstrates how to return an object with one or more key/value pairs.*

- When returning an object, each of the "keys" will be available to any code block which may follow
- When this block is processed, it will be removed from the template completely, thus this next section will not exist.
```javascript
const fullName2 = (nameObj) => {
  return `${nameObj.fname} ${nameObj.lname}`
}

const reverseString = (str) => {
  return str.split('').reverse().join('')
}


const nameObj2 = {fname: 'Mike', lname: 'Erickson'}


const fullNameResult = fullName2(nameObj2)

const reverseResult = reverseString(fullNameResult)

const namedObj = { fullName: fullNameResult, reversed: reverseResult }
```
#### Block 5: Using data from previous code blocks
*The following will access the `reversed` parameter from the code block in Block 4*
- all parameters can be accessed from the `params` object

Reversed: *<%- namedObj.reversed %>*

#### Block 6: Using NotePlan API
The following demonstrates how to use the [NotePlan API ](https://help.noteplan.co/article/70-javascript-plugin-api) within code blocks
```javascript
const city = await CommandBar.textPrompt('NotePlan Prompt','Enter your city')
```
City: *<%- city %>*

#### Block 8: Ignore block
*The following block will be ignored when processing the template*

```javascript
/* template: ignore */

const uppercase = (inString = '') => {
  return inString.toUpperCase()
}

const name3 = 'mike'

result = uppercase(name3)

return result
```

#### Block 9: Alternate Ignore Block
*The following alternate ignore block will be ignored when processing the template*

```javascript
// template:ignore

const uppercase = (inString = '') => {
  return inString.toUpperCase()
}

const name4 = 'mike'

result = uppercase(name4)

return result
```
