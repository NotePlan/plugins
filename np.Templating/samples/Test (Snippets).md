---
title: Test (Snippets)
type: empty-note
---
# Test (Snippets)
*The following demonstrates how to integrate snippets into templates*
---
#### Standard JavaScript Functions
The following examples will use standard JavaScript  functions and modules, located in the "@Templates/🧩 Snippets" folder

Using the new `import` command, you can import code snippets, helpers, etc.  You can format them as standard or fenced template commands (I personally like to reference all "code" type commands as `fenced` code so that it is easily identified as a code-related tag.

`<% import('🧩 Snippets/strings') %>`
`<% import('🧩 Snippets/strings-obj') %>`

#### Use functions in [[strings]] module
variable access (`name`): *<%- name %>*
reverse string: *<%- reverseString(name) %>*

#### Use functions in [[strings-obj]] module
reverseString: *<%- strings.reverseString(name) %>*
uppercase: *<%- strings.uppercase(name) %>*
