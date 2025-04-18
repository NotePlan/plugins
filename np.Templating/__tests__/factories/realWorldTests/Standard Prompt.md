---
title: Standard Prompt
type: meeting-note, empty-note
---
## Standard Prompt
```
prompt-00: (should be empty)<%# prompt('variableName01', 'You should not see this:') %>
prompt-00a: (should be empty)<% prompt("variableName00a", "This had double quotes") %>
prompt-01: <%- prompt('variableName01', 'Enter your value 01:') %>
prompt-02: <%- prompt('variableName02', 'Enter your value 02:', 'default value') %>
prompt-03: <%- prompt('variableName03', 'Enter your value:', ['option1', 'option2', 'option3']) %>
prompt-04: <%- prompt('variableName04', 'Enter a value with, commas:', 'default, with commas 04') %>
prompt-05: <%- prompt('variableName05', 'Enter a value with "quotes"', 'default "quoted" value 05') %>
prompt-06: <%- prompt('variableName06', "Enter a value with 'quotes'", "default 'quoted' value 06") %>
prompt-07: <%- prompt('variable_name_with_underscores07', 'Enter your value: 07') %>
prompt-08: <%- prompt('variable_name08?', 'Include question mark?') %>
prompt-09 (const): <% const var9 = prompt('Enter your value 09:') %> <%- var9 %>
prompt-10 (await): <%- await prompt('Enter your value 09:') %> 
```
