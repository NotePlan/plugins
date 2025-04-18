---
title: promptKey with var
type: meeting-note, empty-note
---
out: <%- promptKey("category") -%>
const: <% const category2 = promptKey("category") -%>
let: <% let category3 = await promptKey("category") -%> var: <% var category4 = await promptKey("category") -%>
<%- category2 %>
<%- category3 %>
<%- category4 %>


