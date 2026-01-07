# Documentation Update Instructions: triggerTemplateRunner Feature

## Overview
Add documentation for the new `triggerTemplateRunner` feature that allows templates to automatically execute when a note is opened.

## IMPORTANT: Previous Documentation Error
**There is an existing section in the documentation that is INCORRECT and needs to be removed or corrected.**

The documentation currently states that you can use `templateRunner` with triggers like this:
```yaml
---
templateTitle: write modified time to frontmatter
triggers: onEditorWillSave => np.Templating.templateRunner
---
```

**This does NOT work.** The `templateRunner` command does not check for `templateTitle` in frontmatter when called from triggers. 

**Action Required:**
- Remove or correct this incorrect documentation section
- Replace it with the correct `triggerTemplateRunner` approach documented below

## Feature Description
The `triggerTemplateRunner` command automatically runs a template when a note is opened. This is useful for notes that need dynamic content generated or calculations updated on open.

## How It Works
1. Add `runTemplateOnOpen` attribute to a note's frontmatter with the template title
2. Add a trigger in the frontmatter: `triggers: onOpen => np.Templating.triggerTemplateRunner`
3. When the note is opened, the specified template is automatically executed

## Required Frontmatter Format

```yaml
---
runTemplateOnOpen: Template Title Here
triggers: onOpen => np.Templating.triggerTemplateRunner
---
```

**Important Notes:**
- The template title in `runTemplateOnOpen` must exactly match the template file title (without `.md` extension)
- No quotes are needed around the template title
- The trigger line is required for this feature to work
- If `runTemplateOnOpen` is empty or missing, the trigger will silently skip execution

## Example: Age Calculation Note

This example shows a note that automatically updates an age calculation when opened.

### The Note (with trigger in frontmatter):

```yaml
---
Bday: 1980-05-15
runTemplateOnOpen: Update Age
triggers: onOpen => np.Templating.triggerTemplateRunner
---

## Age
(as of 2026-01-XX)
```

**Note:** The callback URL is no longer needed in the note body since the template runs automatically when the note is opened via the trigger.

### The Template (`Update Age` in @Templates folder):

```yaml
---
title: Update Age
type: template-runner
getNoteTitled: <current>
writeUnderHeading: Age
location: replace
---
<%
// Get frontmatter attributes to access Bday
const bday = Editor.frontmatterAttributes.Bday || attrs.bday || '';
// Calculate age
let age = '';
if (bday) {
  const daysBetween = date.daysBetween(date.now("YYYY-MM-DD"), bday);
  age = Math.floor(daysBetween / -365);
}
// Get today's date for the "as of" text
const today = date.now("YYYY-MM-DD");
%>
<%- age %> (as of <%- today %>)
```

### How It Works:
When this note is opened, it automatically runs the "Update Age" template, which:
1. Reads the `Bday` value from the note's frontmatter
2. Calculates the current age based on today's date
3. Gets today's date for the "as of" text
4. Replaces the content under the "Age" heading with the updated age and today's date

This ensures the age is always current whenever the note is opened, and shows when it was last updated.

**Note:** Since the template runs automatically via the trigger, there's no need for a manual "Update" link or callback URL in the note body.

## Technical Details

- **Command**: `triggerTemplateRunner` (hidden command, invoked via trigger)
- **Plugin**: `np.Templating`
- **Trigger Type**: `onOpen`
- **Frontmatter Attribute**: `runTemplateOnOpen` (string, required)
- **Template Execution**: Uses `templateRunner` internally

## Where to Add This Documentation

Add this as a new section in the TemplateRunner documentation. Suggested location:
- After the existing TemplateRunner documentation
- Before or after the "Trigger-Based Template Runner" section (if it exists)
- Title: "Automatic Template Execution on Note Open" or "triggerTemplateRunner"

## Key Points to Emphasize

1. This is a separate command from `templateRunner` - it's specifically designed for trigger-based execution
2. The template title must match exactly (case-sensitive)
3. The template runs using the same TemplateRunner mechanism, so it supports all TemplateRunner features including `location: replace` to update existing content
4. This feature is similar to the Forms plugin's `triggerOpenForm` functionality, but designed specifically for template execution

## Troubleshooting Section

Include these troubleshooting tips:
- **Template not running?** Check that:
  - The template title in `runTemplateOnOpen` exactly matches your template file title
  - The trigger line is present in frontmatter: `triggers: onOpen => np.Templating.triggerTemplateRunner`
  - The template exists in your `@Templates` folder
  - The note is actually being opened (not just viewed)
- **Template found but not executing?** Check the Plugin Console (Help → Plugin Console) for detailed error messages.

