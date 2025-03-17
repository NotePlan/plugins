# Prompt Tags List

This document lists all available prompt tags and their permutations for testing purposes.

## Standard Prompt

```
prompt-01: <%- prompt('variableName01', 'Enter your value:') %>
prompt-02: <%- prompt('variableName02', 'Enter your value:', 'default value') %>
prompt-03: <%- prompt('variableName03', 'Enter your value:', ['option1', 'option2', 'option3']) %>
prompt-04: <%- prompt('variableName04', 'Enter a value with, commas:', 'default, with commas') %>
prompt-05: <%- prompt('variableName05', 'Enter a value with "quotes"', 'default "quoted" value') %>
prompt-06: <%- prompt('variableName06', "Enter a value with 'quotes'", "default 'quoted' value") %>
prompt-07: <%- prompt('variable_name_with_underscores07', 'Enter your value:') %>
prompt-08: <%- prompt('variable_name08?', 'Include question mark?') %>
```

## Prompt Key

```
promptKey-01: <%- promptKey('keyVariableName01') %>
promptKey-02: <%- promptKey('keyVariableName02', 'Press any key:') %>
promptKey-03: <%- promptKey('keyVarName03', 'Press y/n:', ['y', 'n']) %>
promptKey-04: <%- promptKey('keyVarName04', 'Press a key with, comma message') %>
promptKey-05: <%- promptKey('keyVarName05', 'Press a key with "quotes"') %>
promptKey-06: <%- promptKey('keyVarName06', "Press a key with 'quotes'") %>
```

## Prompt Date

```
promptDate-01: <%- promptDate('dateVariable01') %>
promptDate-02: <%- promptDate('dateVariable02', 'Select a date:') %>
promptDate-03: <%- promptDate('dateVariable03', 'Select a date:', '{dateStyle: "full"}') %>
promptDate-04: <%- promptDate('dateVariable04', 'Select a date:', '{dateStyle: "medium", locale: "en-US"}') %>
promptDate-05: <%- promptDate('dateVariable05', 'Select a date with, comma:') %>
promptDate-06: <%- promptDate('dateVariable06', 'Select a date with "quotes":') %>
promptDate-07: <%- promptDate('dateVariable07', "Select a date with 'quotes':") %>
promptDate-08: <%- promptDate('dateVariable08', 'Select date:', '{dateFormat: "YYYY-MM-DD"}') %>
```

## Prompt Date Interval

```
promptDateInterval-01: <%- promptDateInterval('intervalVariable01') %>
promptDateInterval-02: <%- promptDateInterval('intervalVariable02', 'Select date range:') %>
promptDateInterval-03: <%- promptDateInterval('intervalVariable03', 'Select date range:', '{format: "YYYY-MM-DD"}') %>
promptDateInterval-04: <%- promptDateInterval('intervalVariable04', 'Select date range:', '{separator: " to "}') %>
promptDateInterval-05: <%- promptDateInterval('intervalVariable05', 'Select date range:', '{format: "YYYY-MM-DD", separator: " to "}') %>
promptDateInterval-06: <%- promptDateInterval('intervalVariable06', 'Select date range with, comma:') %>
promptDateInterval-07: <%- promptDateInterval('intervalVariable07', 'Select date range with "quotes":') %>
promptDateInterval-08: <%- promptDateInterval('intervalVariable08', "Select date range with 'quotes':") %>
```

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

## Nested Expressions (if supported)

```
nested-01: <%- prompt('outerVar01', 'Outer prompt: ' + prompt('innerVar01', 'Inner prompt:')) %>
nested-02: <%- prompt('conditionalVar01', promptKey('condition01', 'Choose y/n:', ['y', 'n']) === 'y' ? 'You chose yes' : 'You chose no') %>
```

## Notes

1. Variable names are automatically converted to have underscores instead of spaces.
2. Question marks are removed from variable names.
3. The templating system correctly handles quotes (both single and double) and commas inside quoted parameters.
4. Array parameters (with square brackets) are properly preserved during parsing.
5. Each prompt type saves its result to a variable in the session data. 