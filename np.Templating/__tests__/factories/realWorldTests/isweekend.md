---
title: isweekend	
type: ignore 
---
## .isWeekend(US date)
date.isWeekend('2021-10-25') mon: <%- date.isWeekend('2021-10-25') %>
date.isWeekend('2021-10-26') tues: <%- date.isWeekend('2021-10-26') %>
date.isWeekend('2021-10-27') weds: <%- date.isWeekend('2021-10-27') %>
date.isWeekend('2021-10-28') thurs: <%- date.isWeekend('2021-10-28') %>
date.isWeekend('2021-10-29') fri: <%- date.isWeekend('2021-10-29') %>
date.isWeekend('2021-10-30') sat: <%- date.isWeekend('2021-10-30') %>
date.isWeekday('2021-10-31') sun: <%- date.isWeekend('2021-10-31') %>

## .isWeekend(euro dates)
date.isWeekend('2021-10-25') mon: <%- date.isWeekend('2021-25-10') %>
date.isWeekend('2021-10-26') tues: <%- date.isWeekend('2021-26-10') %>
date.isWeekend('2021-10-27') weds: <%- date.isWeekend('2021-27-10') %>
date.isWeekend('2021-10-28') thurs: <%- date.isWeekend('2021-28-10') %>
date.isWeekend('2021-10-29') fri: <%- date.isWeekend('2021-29-10') %>
date.isWeekend('2021-10-30') sat: <%- date.isWeekend('2021-30-10') %>
date.isWeekday('2021-10-31') sun: <%- date.isWeekend('2021-31-10') %>

note.date('YYYY-MM-DD'): <%- note.date('YYYY-MM-DD') %>

---

BEFORE:
## .isWeekend(US date)
date.isWeekend('2021-10-25') mon: false
date.isWeekend('2021-10-26') tues: false
date.isWeekend('2021-10-27') weds: false
date.isWeekend('2021-10-28') thurs: false
date.isWeekend('2021-10-29') fri: false
date.isWeekend('2021-10-30') sat: false
date.isWeekday('2021-10-31') sun: false

## .isWeekend(euro dates)
date.isWeekend('2021-10-25') mon: false
date.isWeekend('2021-10-26') tues: false
date.isWeekend('2021-10-27') weds: false
date.isWeekend('2021-10-28') thurs: false
date.isWeekend('2021-10-29') fri: false
date.isWeekend('2021-10-30') sat: false
date.isWeekday('2021-10-31') sun: false

note.date('YYYY-MM-DD'): 2023-02-05

---

AFTER: 

## .isWeekend(US date)
date.isWeekend('2021-10-25') mon: false
date.isWeekend('2021-10-26') tues: false
date.isWeekend('2021-10-27') weds: false
date.isWeekend('2021-10-28') thurs: false
date.isWeekend('2021-10-29') fri: false
date.isWeekend('2021-10-30') sat: true
date.isWeekday('2021-10-31') sun: true

## .isWeekend(euro dates)
date.isWeekend('2021-10-25') mon: true
date.isWeekend('2021-10-26') tues: true
date.isWeekend('2021-10-27') weds: true
date.isWeekend('2021-10-28') thurs: true
date.isWeekend('2021-10-29') fri: true
date.isWeekend('2021-10-30') sat: true
date.isWeekday('2021-10-31') sun: true

note.date('YYYY-MM-DD'): 2023-02-05

*****

BEFORE:
## .isWeekend(US date)
date.isWeekend('2021-10-25') mon: false
date.isWeekend('2021-10-26') tues: false
date.isWeekend('2021-10-27') weds: false
date.isWeekend('2021-10-28') thurs: false
date.isWeekend('2021-10-29') fri: false
date.isWeekend('2021-10-30') sat: false
date.isWeekday('2021-10-31') sun: false

## .isWeekend(euro dates)
date.isWeekend('2021-10-25') mon: false
date.isWeekend('2021-10-26') tues: false
date.isWeekend('2021-10-27') weds: false
date.isWeekend('2021-10-28') thurs: false
date.isWeekend('2021-10-29') fri: false
date.isWeekend('2021-10-30') sat: false
date.isWeekday('2021-10-31') sun: false

note.date('YYYY-MM-DD'): 2023-02-05

*****

AFTER: 

