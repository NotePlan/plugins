---
title:  README
type: readme, ignore
description: Template Snippets can be `included` in any template and the associated helpers, etc. will be available during rendering
---
# np.Templating Helpers
*The following contains helper functions or helper objects which can be used in any template by simply importing the contenting `<% import(/* path to helper */) %>`*

## Overview
If you find yourself reusing functions in more than one template, you can simplify your templates and store these commonly used helpers in separate `template-helper` templates and import them wherever you wish.

### Filter `template-helper` templates from np.Templating Chooser
When creating a helper template, set the `type` attribute to `template-helper` so that it does not appear in the np. Templating Template Chooser interface (see the example helpers below)

### Example Template Helpers
The following are some basic template helpers

[[strings]]
*standard JavaScript functions*

[[strings-obj]]
*JavaScript code module*
