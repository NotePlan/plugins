---
title: Daily Timeblocks Snippet
type: meeting-note, empty-note 
---
## Blocks
<% if (isWeekday) { // monday-fri -%>
+ 🕑 06:00-07:00 #Getup
+ 🕑 07:00-09:00 #Workout
+ 🕑 10:00-11:00 #NotePlan
+ 🕑 11:00-12:00 #HolyRoller
+ 🕑 14:00-16:00 #GreenCap
+ 🕑 20:00-21:00 #Home
+ 🕑 21:00-22:00 #WindDown
<% } else { // weekend -%>
+ 🕑 08:00-09:00 #Getup
+ 🕑 11:00-13:00 #Workout
+ 🕑 15:00-16:00 #FixIts
+ 🕑 21:00-22:00 #WindDown
<% }  -%>