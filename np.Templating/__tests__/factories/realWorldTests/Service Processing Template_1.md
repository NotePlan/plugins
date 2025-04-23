---
title: Service Processing Template
isoDate: <%- serviceDate ? date.format("YYYY-MM-DD", serviceDate): '?' %>
localeDate: <%- serviceDate ? date.format("L",serviceDate): '?' %>
DDMM: <%- serviceDate ? date.format("D/M",serviceDate): '?' %>
topic: <%- serviceTitle + passages ? ' (' + passages + ')' : '' %>
displayTitle: <%- localeDate + ' ' + place + ' ' + serviceType + ' ' + '"' + serviceTitle + '" @' + isoDate + ' (' + startTime + ')' %>
getNoteTitled: <current>
type: template-runner
location: cursor
---
### <%- displayTitle %>
 <%- notes %>
* Music: liaise with ? {-12d}
* Prayers: liaise with ? {-5d}
* Reader: liaise with ? {-5d}
* write  <%- DDMM %> service plan {-3d}
* Children/Youth groups: liaise with ? {-3d}
* check HC supplies for <%- DDMM %> {-3d} @church
* confirm @admin prep name badges {-3d}
+ check in with chalist {-3d}
* decide <%- DDMM %> sermon point '<%- topic %>' {-5d} at 10:00-12:00
* write <%- DDMM %> sermon {-3d} at 13:00-17:00
* create any sermon presentations {-1d}
* write service leader segments plan Something Different for <%- DDMM %> {-3d} at 13:00-15:00