# Theme Chooser Noteplan Plugin

[Click Here](https://discord.com/channels/763107030223290449/989752996583858217/989753000622977034) for Help/Support/Questions

## Overview

This plugin is designed to make switching themes fast and easy without having to open the NotePlan Preferences Panel.

<img src="https://user-images.githubusercontent.com/8949588/175463159-c7ef1aa9-6178-4853-90d6-9102dd306859.gif" width="500">

You can switch to any theme at any time using the command:
`/Choose Theme`

<img src="https://user-images.githubusercontent.com/8949588/175463052-7de07037-f8d0-43a8-be5b-cc26eafa8b85.jpg" width="500">

And you can set five preset themes to be listed in your CMD-J Command Bar for quick access using the command:
`/Change Theme Preset`

<img src="https://user-images.githubusercontent.com/8949588/175463091-c57f76ae-34d3-4120-8ef2-e8cc75c9baf0.jpg" width="500">

After you set them as presets, switching to that theme will be its own plugin command (one step), e.g.:
`/toothbleach`
or
`/dracula-pro`

This will also list the presets you choose in your NotePlan > Plugins menu bar, so you can assign your own keyboard shortcut using Keyboard Maestro or Apple's Keyboard System Settings.

```
NOTE: When you set one of the 5 presets using the `/Change Theme Preset` command, the theme is
immediately available to you in the Command Bar. However, because NotePlan only generates the 
menu bar items once (at start-up), you will not see them in the menu bar until you restart
NotePlan.
```

Use `/Change Theme Preset` again to change any preset you already set to another theme instead.

## Toggling Themes

If you tend to go back/forth between light and dark themes and want a quick way to toggle, run the command:
`Toggle Light/Dark`

<img src="https://user-images.githubusercontent.com/8949588/175557720-3a1066d3-1006-4ccd-b40f-2643fb28aa94.jpg" width="500">

If you haven't set up your defaults, the plugin will prompt you to do so when you run the `Toggle Light/Dark` command.

You can change or set you light/dark theme using the command:
`Set Toggleable Light/Dark Theme (for this device)`

```
NOTE: As you can see from the name, Light/Dark theme settings are set on a per-device basis, 
so your Mac will have one set and your iPhone will have another (this is by design). 
You will need to set the defaults on each device.
```

## Changing Theme Per Note (from frontmatter)

You can have NotePlan load a specific theme for any note by adding frontmatter to that note. 
> **Note:**
> There is a command that will help you create the frontmatter (see below). 

Whether you use the command or write the frontmatter by-hand, the relevant frontmatter fields are:

```
---
triggers: onOpen => np.ThemeChooser.setTheme
theme: Apple Spark
---
```

The "triggers" line does not need to be changed and just calls the ThemeChooser plugin when the file is opened.

The "theme" field should match the exact name of the theme you want to open with this document. You can see the theme names in the NotePlan Preferences > Themes panel.

### Command: /Add/Change This Note’s Theme in Frontmatter

The command `/Add/Change This Note’s Theme in Frontmatter` can be used to add/change the frontmatter for the open document to include a theme of your choosing.

### Frontmatter Setting via Template:

If you want to use theme changes broadly, it may make sense for you to include the frontmatter fields in a template. The following is a sample template note that could be in your @Templates folder:

```
---
title: Template with Theme Setting
type: meeting-note, empty-note 
---
--
triggers: onOpen => np.ThemeChooser.setTheme
theme: Apple Spark
--

```

In this example, the top frontmatter is the frontmatter of the template itself. Note that the "trigger" frontmatter is at the very top of the template (under the template note frontmatter) and has two dashes at the top and bottom (instead of 3). This is how you can add frontmatter that will be inserted by a template.
