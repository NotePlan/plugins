---
title: Test (Include)
type: empty-note
---
# np.Templating Inheritance
*np.Templating supports note inheritance (calendar, note, template) when rendering the parent template*

There are 4 different methods that can be used to include content
- include
- template
- note
- calendar

<% console.log('test') %>
<% clo(`{fname: 'Mike'}`)%>

Rules
- You can use `include` for any type of include
- If you use `template` it will assume the parameter is a template
	- When the template is loaded, it will be rendered at the point where it exists in the parent template.
- If you use `note` it will assume the parameter is a project note
- If you use `calendar` it will assume the parameter is a calendar note
- If you use `include` with a project note, it will perform the same action as `note`
- If you use `include` with a calendar note, it will perform the same action as `calendar`
- If you use `include` with a template, it will perform the same action as `template`
- If you use it as a command, the note will be returned to the supplied variable
	- For example, the following will load the note and return into variable
		- `<% const restaurant = note('📝 Miscellaneous/restaurants') %>`

## Examples
*The following examples demonstrate the various methods you can inherit content from other project notes, calendar notes, or templates*

---
#### Include Template using include method
<%- include('🧩 Templating Samples/section1') %>
---

---
#### Include Template using template method
<%- template('🧩 Templating Samples/section1') -%>
<%# template('🧩 Templating Samples/section1') -%>
---

---
#### Include Template using template method, returning the result to a variable
<% const section1 = template('🧩 Templating Samples/Sample Template') -%>
<%- section1 %>
<% clo(section1) %>
---

---
#### Include Project Note using note method
<%- note('Test Note Included') %>
<%# note('Test Note Included') %>
---

---
#### Include Project Note using include method
*Performs the same action as the `note` method*

<%- include('Test Note Included') %>
---

---
#### Include Project Note using full path, returning the result to a variable
<% const restaurant = note('📝 Miscellaneous/restaurants') %>
<%- restaurant %>
---

---
#### Include Calendar Note using calendar method
<%- calendar('20220606') %>
---

---
#### Include Calendar Note using the include method
*Performs the same action as the `calendar` method*

<%- include('20220606') %>
---
