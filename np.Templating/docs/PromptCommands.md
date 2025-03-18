import Callout from '@/components/Callout'
import Link from 'next/link'

import promptdefault from '@/images/prompt-default.png'
import prompt2 from '@/images/prompt2.png'

# Prompts

`Templating` provides the ability to ask the user questions through prompts when rendering templates.

<Callout
  type="warning"
  title="Single Quotes">

Use single quotes inside the prompt command, like `prompt('question')`. 

</Callout>

### Example 1: Simple text input `prompt`

For example, if you have a display tag `<%@` in your template which is not in your template data, a prompt will be displayed

```markdown
<%- prompt('What is your first name?') %>
```

<img src={promptdefault.src} alt="Prompt Default" />

### Example 2: `prompt` with list of choices

Alternatively, the **`prompt` command** can accept optional prompt message and well as choices (for use with choice list prompt)

<Callout
  type="warning"
  title="PROMPT PLACEHOLDER">

When using <code>prompt</code> command, you must supply a valid placeholder name (e.g. <code>name</code>) and the variable must contain valid characters:

<ul>
  <li>must start with an alpha character (a..z, A..Z)</li>
  <li>may only contain alphanumeric characters (a..z, A..Z, 0..9)</li>
  <li>
    may <b>not</b> contain spaces
  </li>
</ul>

</Callout>

Using the following template

```markdown
Task Priority: <%- prompt('priority','What is task priority?',['high','medium','low']) %>
```

You can then use the same variable anywhere else in template `<%- priority %>`. When the template is rendered, it will display a choice list prompt

<img src={prompt2.src} alt="Prompt" />

### Example: Define early; use later

The following example demonstrates how you can place prompts at the top of templates, and then use somewhere else in the template

```markdown
<% prompt('lastName','What is your last name?') -%>

The rest of this could be your template code
And then finally use the `lastName` variable
<%- lastName %>
```

The template would render as follows, with the `lastName` value result from prompt on first line (assuming entered `lastName` Erickson)

```markdown
The rest of this could be your template code
And then finally use the `lastName` variable
Erickson
```

## Asking for dates or date intervals

There are two further commands available:

- **`promptDate('question','message')`**, which accepts dates of form `YYYY-MM-DD`
- **`promptDateInterval('question','message')`**, which accepts date intervals of form `nnn[bdwmqy]`, as used and documented further in the <Link href="../jgclark.RepeatExtensions">Repeat Extensions</Link> plugin.

Both require the first parameter to be 'question', but accept an optional prompt message. They must be placed where the text is to be used. For example:

```markdown
Project start date: <%- promptDate('question','Enter start date:') %>
Review frequency: <%- promptDateInterval('question','Enter review interval:') %>
```

## Working with Frontmatter Keys and Values

### promptKey

`promptKey` allows you to prompt the user to select a value from existing frontmatter keys in your notes.

#### Syntax

```markdown
<%- promptKey('key', 'message', 'noteType', caseSensitive, 'folder', fullPathMatch, ['options']) %>
```

#### Parameters

- **key** (string): The frontmatter key to search for values (required)
- **message** (string): Custom prompt message to display to the user (optional)
- **noteType** (string): Type of notes to search - 'Notes', 'Calendar', or 'All' (default: 'All')
- **caseSensitive** (boolean): Whether to perform case-sensitive search (default: false)
- **folder** (string): Folder to limit search to (optional)
- **fullPathMatch** (boolean): Whether to match the full path (default: false)
- **options** (array): Array of predefined options to show instead of extracting from frontmatter (optional)

#### Examples

Basic usage:
```markdown
Project status: <%- promptKey('projectStatus', 'Select project status:') %>
```

With folder restriction and case sensitivity:
```markdown
Tag: <%- promptKey('tags', 'Select a tag:', 'Notes', true, '/Projects') %>
```

With predefined options:
```markdown
Priority: <%- promptKey('priority', 'Set priority:', 'All', false, '', false, ['High', 'Medium', 'Low']) %>
```

## Working with Tags and Mentions

### promptTag

`promptTag` allows you to prompt the user to select from existing hashtags in your notes or create a new one.

#### Syntax

```markdown
<%- promptTag('Select a hashtag:', 'includePattern', 'excludePattern', allowCreate) %>
```

#### Parameters

- **promptMessage** (string): The message to display in the prompt (required)
- **includePattern** (string): Regex pattern to include only matching hashtags (optional)
- **excludePattern** (string): Regex pattern to exclude matching hashtags (optional)
- **allowCreate** (boolean): Whether to allow creating a new hashtag if not found (default: true)

#### Examples

Basic usage:
```markdown
#<%- promptTag('Select a hashtag:') %>
```

Filter tags to include only those containing "project":
```markdown
#<%- promptTag('Select a project tag:', 'project') %>
```

Filter to include "priority" tags and exclude "low" tags:
```markdown
#<%- promptTag('Select priority:', 'priority', 'low') %>
```

Don't allow creating new tags:
```markdown
#<%- promptTag('Select from existing tags only:', '', '', false) %>
```

### promptMention

`promptMention` allows you to prompt the user to select from existing @ mentions in your notes or create a new one.

#### Syntax

```markdown
<%- promptMention('Select a mention:', 'includePattern', 'excludePattern', allowCreate) %>
```

#### Parameters

- **promptMessage** (string): The message to display in the prompt (required)
- **includePattern** (string): Regex pattern to include only matching mentions (optional)
- **excludePattern** (string): Regex pattern to exclude matching mentions (optional)
- **allowCreate** (boolean): Whether to allow creating a new mention if not found (default: true)

#### Examples

Basic usage:
```markdown
@<%- promptMention('Select a person:') %>
```

Filter mentions to include only those containing "team":
```markdown
@<%- promptMention('Select a team member:', 'team') %>
```

Filter to include "client" mentions and exclude "former" clients:
```markdown
@<%- promptMention('Select client:', 'client', 'former') %>
```

Don't allow creating new mentions:
```markdown
@<%- promptMention('Select from existing mentions only:', '', '', false) %>
```

## Usage Tips

- Both `promptTag` and `promptMention` will automatically handle the `#` and `@` prefixes, respectively. You only need to add them in your template if needed for formatting.
- When using `includePattern` and `excludePattern`, these are converted to regular expressions, so you can use regex syntax for more advanced filtering.
- The `allowCreate` parameter is particularly useful when you want to limit selections to existing values only. 