import Callout from '@/components/Callout'
import Link from 'next/link'

# Fewer steps: many prompts on one Command Bar form

When you use **Templating** in **NotePlan 3.21 or newer**, several questions can sometimes appear **together on a single Command Bar form** instead of one popup after another. That means less clicking when a template asks for multiple simple answers.

This page describes **which questions can share one form**, **what forces separate steps**, and **how to line up your template** so you get as many fields as possible in one go.

<Callout type="info" title="What you need">
- **NotePlan 3.21+** for this combined-form behavior.
- Only **plain text/choice prompts** (`prompt`) and **date prompts** (`promptDate`) can be merged this way. Other specialized prompts always use their own step.
- On older versions of NotePlan, everything behaves as before: **one question at a time**.
</Callout>

## How “one form” vs “several steps” is decided

Think of your template as a **list of prompt tags in order, top to bottom**.

The template looks for **groups** of **back-to-back** `prompt` and `promptDate` tags that are allowed to share one screen. **Two or more** in a row under the rules below → **one** form with that many fields. **Only one** such tag in a row → the usual single-question flow (no combined form for that tag).

If something **in between** breaks the group, the next `prompt` or `promptDate` **starts a new group** that may combine with the tags that follow it.

## What always gets its **own** step (and splits groups)

These prompt types **never** join a combined form; they also **break** a group, so anything after them starts fresh:

- **`promptDateInterval`** (repeat-style interval)
- **`promptTag`**
- **`promptMention`**
- **`promptKey`**

**Example:** You have one normal prompt, then an interval prompt, then two more normal prompts. You’ll typically see: **one** question, then **the interval picker**, then **one form** with the last two questions—not five fields at once.

Other **non-prompt** pieces of the template (for example **executable script blocks** or **other tags**) that sit **between** two `prompt` / `promptDate` tags can also **end** a group, so plan the **order** of lines if you want as many fields as possible on one screen.

## When the **next** question **depends** on the **previous** answer

A combined form is only built when questions **don’t need** an answer from **another field on that same form** (for example a **dropdown list** that only exists **after** the user picks something earlier).

**Won’t combine** — the second line needs `region`, which the first question would set on the same form:

```markdown
<%- prompt('region', 'Region', ['North', 'South']) %>
<%- prompt('city', 'City', region) %>
```

**Can combine** — the list for cities is already known (here, from frontmatter) before the form opens:

```markdown
---
cityChoices: <%- ['A', 'B', 'C'] %>
---
<%- prompt('region', 'Region', ['North', 'South']) %>
<%- prompt('city', 'City', cityChoices) %>
```

## How questions show up on the form

- **`prompt`** → a text line, or a **dropdown** if you passed a list of choices.
- **`promptDate`** → a **date** control. The usual display pattern is **year-month-day** in a compact form. You can customize that with an optional third argument using **`dateFormat`** or **`format`** inside a small JSON-style block, for example:  
  `promptDate('due', 'Due', '{ dateFormat: "MM/dd/yyyy" }')`.

<Callout type="warning" title="Date display wording">
If you format dates elsewhere in templates with **different** patterns, the **form’s** date line may use **slightly different** letters or symbols in its pattern string. For custom layouts, set **`dateFormat`** (or **`format`**) on the `promptDate` itself so the form matches what you want.
</Callout>

## Explicit multi-field form (`promptForm`)

Use one tag when you want a **single** `CommandBar.showForm` and full control over **title**, **submit** label, and **fields**—without depending on **back-to-back** `prompt` / `promptDate` tags.

- **NotePlan 3.21+** with Command Bar forms (`usersVersionHas('commandBarForms')`). If forms are not available, Templating **asks each field in order** (text, choices, date, etc.) like separate prompts.
- The argument must be a **single object literal** inside `promptForm( ... )`. You can use **JSON5** syntax (unquoted keys, trailing commas, single-quoted strings).
- Each field **`key`** is written to **session data** (and a cleaned key when needed), same idea as other prompts—use `<%- yourKey %>` later in the template.
- The **`promptForm` tag itself** produces **no visible text** after preprocessing; place your summary lines where you want using the keys you declared.

### Object shape

| Property | Required | Description |
| -------- | -------- | ----------- |
| `fields` | **yes** | Non-empty array of field objects (see below). |
| `title` | no | Form title in the Command Bar. Default: `Template`. |
| `submitText` | no | Submit button label. Default: `Continue`. |

### Field objects

| Property | Required | Description |
| -------- | -------- | ----------- |
| `type` | **yes** | `string`, `number`, `bool`, `date`, or `hidden`. |
| `key` | **yes** | Session variable name for this value. |
| `title` or `label` | recommended | Label shown on the form (defaults to `key`). |
| `choices` | no | String array → dropdown (`string` type). |
| `default` | no | Default value (required for `hidden`). |
| `required` | no | If true, user must fill the field (where the form API supports it). |
| `placeholder` | no | Hint text for text fields. |
| `description` | no | Help text (info button in Command Bar). |
| `format` | no | For `type: 'date'`, Swift-style pattern (e.g. `yyyy-MM-dd`). |
| `boxHeight` | no | Multi-line text area height for `string`. |

### Example

```markdown
<%- promptForm({
  title: 'Project setup',
  submitText: 'Continue',
  fields: [
    { type: 'string', key: 'docName', title: 'Document name', required: true },
    { type: 'string', key: 'priority', title: 'Priority', choices: ['High', 'Medium', 'Low'] },
    { type: 'date', key: 'due', title: 'Due date', format: 'yyyy-MM-dd', required: false },
    { type: 'hidden', key: 'source', default: 'template' },
  ],
}) %>

- **Name:** <%- docName %>
- **Priority:** <%- priority %>
- **Due:** <%- due %>
```

**Authoring tip:** You can paste a skeleton like the above into an AI assistant and ask it to fill in `fields` for your use case; keep **`key`** names valid for template variables (letters, numbers, underscore).

### Cancel and errors

- **Cancel** on the form stops template prompt processing (**same** as other prompts).
- A **bad** `promptForm` object (missing `fields`, invalid JSON, unknown `type`, etc.) yields an **HTML error comment** in the preprocessed template instead of opening a form.

## Tips: get **more** fields on **one** form

1. Put all the **`prompt`** and **`promptDate`** lines you want on **one** screen **next to each other**, with **no** interval / tag / mention / key prompts **between** them.
2. Build **dropdown lists** in **frontmatter** (or anything evaluated **before** those prompts) when the list should **not** wait on another answer from the **same** form.
3. Place **interval**, **tag**, **mention**, and **key** prompts **before** or **after** the block you want as a single form, so they don’t sit **in the middle** of a group of plain prompts and dates.

Whether you use a **silent** prompt line (`<% ... -%>`) or one that **prints** the value (`<%- ... %>`) does not change whether it can join a group; **order** and **dependencies** matter most.

## If the user cancels or something goes wrong

- **Cancel** on the combined form stops the template’s prompts for that pass, similar to canceling a single question.
- If the app can’t show a combined form, Templating **falls back** to asking **one question at a time** so your template still works.

## See also

- <Link href="./PromptCommands">Prompt commands overview</Link> — how to write `prompt`, `promptDate`, intervals, tags, and more.
- [Command Bar forms (NotePlan)](https://help.noteplan.co/article/281-commandbar-forms-plugin) — how forms work in the Command Bar.
- [Templating documentation](https://noteplan.co/templates/docs) — full templating reference.
