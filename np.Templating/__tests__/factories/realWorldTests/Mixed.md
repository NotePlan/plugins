---
title: Prompt Mixed
type: meeting-note, empty-note
---
## Mixed Prompt Types in One Template
```
mixed-01: <%- prompt('name01', 'Enter your name:') %>
mixed-02: Hello, <%- name01 %>! Today is <%- promptDate('today01', 'Select today\'s date:') %>.
mixed-03: Your appointment is scheduled for <%- promptDateInterval('appointment01', 'Select appointment range:') %>.
mixed-04: Press <%- promptKey('confirm01', 'Press Y to confirm:', ['Y']) %> to confirm.
```

## Prompts with Special Characters
```
special-01: <%- prompt('greeting01', 'Hello, world!', 'Default, with comma') %>
special-02: <%- prompt('complex01', 'Text with symbols: @#$%^&*()_+{}[]|\\:;"<>,.?/~`', 'Default with symbols: !@#$%^&*()') %>
special-03: <%- prompt('withQuotes01', 'Text with "double" and \'single\' quotes', 'Default with "quotes"') %>
special-04: <%- prompt('withBrackets01', 'Text with [brackets] and {braces}', 'Default with [brackets]') %>
special-05: <%- promptKey('specialKey01', 'Press key with symbols: !@#$%^&*()') %>
```

## Edge Cases
```
edge-01: <%- prompt('emptyDefault01', 'Enter value:', '') %>
edge-02: <%- prompt('spacesInName01', 'This will be converted to underscores') %>
edge-03: <%- prompt('very_long_variable_name01_that_tests_the_limits_of_the_system_with_many_characters', 'Very long variable name:') %>
edge-04: <%- promptKey('emptyName01', 'Empty variable name - should use a default or throw an error') %>
edge-05: <%- promptDate('dateWithTime01', 'Date with time:', '{dateStyle: "full", timeStyle: "medium"}') %>
```

## Nested Expressions (these don't work yet)
```
nested-01: <%# prompt('outerVar01', 'Outer prompt: ' + prompt('innerVar01', 'Inner prompt:')) %>
nested-02: <%# prompt('conditionalVar01', promptKey('condition01', 'Choose y/n:', ['y', 'n']) === 'y' ? 'You chose yes' : 'You chose no') %>
```

