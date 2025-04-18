---
title: Weekly Note Template Tag
---
@joshi [improved](https://discord.com/channels/763107030223290449/963950027946999828/1209896014094536754) my suggestion and included two numbers: 
<%
    let weekNumber = Calendar.weekNumber(new Date('2025-01-01'));
    let formattedWeekNumber = weekNumber < 10 ? '0' + weekNumber : weekNumber;
    return formattedWeekNumber;
%>
<%- Calendar.weekYear(Editor.note.date) %>-W<%- formattedWeekNumber %>]]

Using now/today, no matter where you are, this gives you the current weekly note:
[[<%- Calendar.weekYear(new Date()) %>-W<%- Calendar.weekNumber(new Date()) -%>]]
output: 2022-W49

Using week date (this is the best one if you want the weekly note corresponding to a Calendar note which doesn't have to be today):
[[<%- Calendar.weekYear(Editor.note.date) %>-W<%- Calendar.weekNumber(Editor.note.date) -%>]]

Using title (should normally work as above:
[[<%- Calendar.weekYear(new Date(Editor.note.title)) %>-W<%- Calendar.weekNumber(new Date(Editor.note.title)) -%>]]


