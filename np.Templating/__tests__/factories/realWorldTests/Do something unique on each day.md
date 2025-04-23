---
title: Do something unique on each day
type: ignore 
note: Remove the blank lines in the task lines you are not using or you may get lots of whitespace in your output on those days
---
<% const dayNum = date.dayNumber(`${date.format('YYYY-MM-DD',Editor.note.title)}`) %>
#### <%- date.format('dddd, YYYY-MM-DD',Editor.note.title) %>
dayNum is: <%- dayNum %>

<% if (dayNum === 0) { // sunday -%>
* sunday task
<% } else if (dayNum === 1) { // monday -%>
* monday task
<% } else if (dayNum === 2) { // tuesday -%>
* tuesday task
<% } else if (dayNum == 3) { // wednesday task -%>
* wednesday task
<% } else if (dayNum == 4) { // thursday task -%>
* thursday task
<% } else if (dayNum == 5) { // friday task -%>
* friday task
<% } else if (dayNum == 6) { // saturday task -%>
* saturday task
<% } -%>
<% if (dayNum === 0 || dayNum === 6) { // weekend (sat/sun) -%>
* weekend task
<% } else if (dayNum > 0 && dayNum < 6) { // weekday (mon-fri) -%>
* weekday task
<% } -%>


