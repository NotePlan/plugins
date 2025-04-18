---
title: Prompt Date Interval
type: meeting-note, empty-note
---
## Standard Prompt

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
promptDateInterval-09 (let): <% let var9 = promptDateInterval('Enter your value 09:') %> <%- var9 %>
promptDateInterval-10 (let): <% let var10 = await promptDateInterval('Enter your value 10:') -%> <%- var10 %>
promptDateInterval-11 (let): <%- await promptDateInterval('Enter your value 10:') %> 
```
