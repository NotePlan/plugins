---
title: Prompt test
type: ignore
---

Task Priority: <%- prompt('priority','What is task priority?',['high','medium','low']) %>

Use the same variable anywhere else in template `<%- priority %>`