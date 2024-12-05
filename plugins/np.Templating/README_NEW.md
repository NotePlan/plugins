# np.Templating 2.0
This document will serve as changes for np.Templating 2.0 before it makes it to final documentation

## What's New

### Template Code Block Execute
- added template code block execution
- added `import` statement for importing any type of helper modules

#### samples
Review the various samples in the `samples` folder
TODO: Need to add `samples` to `np:samples` command
TODO: Demonstrate how to use the following

1. np:append
2. select one of the following templates (need to be installed using `np:samples`)
	- Test (Snippets)
	- Test (Include)
	- Test (Execute)
	- Test (Execute Quick)

#### import
Import codeblocks which contain commonly used functions

### Template include, template, note, calendar
You can now include information from other NotePlan notes

#### include
Include existing NotePlan Notes or Templates

- added `include` method (will include project notes, calendar notes, templates)
    > when "including" template, it will be rendered automatically

#### template

- added `template` method
    > you can also use `include` with template and it will perform the same action as `include` method
    > when "including" template, it will be rendered automatically

#### note
- added `note` method
    > you can also use `include` with note and it will perform the same action as `note` method

#### calendar
- added `calendar` method
    > you can also use `include` with note and it will perform the same action as `calendar` method

### Debugging
- added `clo` helper which can be used to help debug more complex templates

### Template Runner
- added `np:gx` command to build x-callback for current template

### Miscellaneous Changes
- `getTemplateList` will now filter out any templates which have `type = ignore` (@dwertheimer)
