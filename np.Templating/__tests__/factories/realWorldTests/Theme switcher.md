---
title: Theme Chooser
type: ignore
metadata: 
---
<% const themes = Editor.availableThemes -%>
<% const selected = await CommandBar.showOptions(themes,'Choose a Theme') -%>
<% Editor.setTheme(selected.value) -%>

