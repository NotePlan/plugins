# NotePlan Plugin Documentation
**FIRST DRAFT**

*****
## Complete Before Final Release
- [ ] Run Spelling and Grammar Checker
- [ ] Create Links in Plugins README accordingly
*****

## Overview
NotePlan Plugin CLI provides a command which can be used to auto generate documentation for your plugins.

```bash
np-cli plugin:dev <plugin> --docs
```

You can use this command to start your documentation, whether it be complete plugin documentation, or as a starting point for overall documentation.

All documentation will be created in the following directory structure

```bash
<plugin>
|____ docs
| |____ images
| | |____ command.png
|____ INDEX.md
```

**images**
Contains and screenshots which are associated with each command (see template for information on supply screenshots for each command)

### Plugin Overview
Provides overview of plugin suite

### Command Reference Overview
Each plugin command will have a docblock at above the command method, and will contain information about command which will displayed when users view plugin documentation

The following tags are available when creating you plugin command docblock.

**trigger (required)**
keyboard shortcut which will trigger your plugin command

**inline**
command trigger can be used inline (within note while editing)

**screenshot**
command screenshot (you can have one screenshot per command).
- If this tag is not supplied, the documentation generation tool will also automatically include a screenshot in your documentation if one is found in the following path.
	 `/docs/images/<command>.png`

*Note: If you don’t want this command to contain a screenshot, regardless of existence in images directly, you can include `@screenshot  false`*

**description (required)**
detailed information about your plugin command
- first line will be command subject
- lines 2..n will be command description, and may include common markdown tags (#headings, **bold** _italic_, etc.)

#### Command Template
Each plugin command will be documented using the following docblock template

```js
/**
 * @trigger     <trigger>
 * @inline      <true | false>
 * @screenshot  <path_to_screenshot> || false // see param above
 * @description
 * Summary
 * Detail rest of docblock
 */
function CommandName() {
}
```

#### Command Example w/ docblock
The following example demonstrates how a plugin command docblock can be constructed.

```js
/**
 * @trigger     /helloWorld
 * @inline      true
 * @screeenshot docs/hello-world.png
 * @description
 * Inserts `Hello World` at cursor position
 * You can provide as many lines as you wish to describe your command
 * Each line must start with asterisk and will stop at end of docblock
 * May include markdown tags such as #heading **bold** or _underline_
 */

export async function helloWorld(): Promise<void> {
  // this will be echo'd to plugin console
  console.log('Hello World')

  // this will be inserted at cursor position
  Editor.insertTextAtCursor('Hello World')
}

```

## References
The following references provide additional context for tooling used to create NotePlan Plugin Documentation

[Use JSDoc: Getting Started with JSDoc 3](https://jsdoc.app/about-getting-started.html)
