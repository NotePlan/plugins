# Theme Chooser Noteplan Plugin

## Overview
This plugin is designed to make switching themes fast and easy without having to open the NotePlan Preferences Panel.

You can switch to any theme at any time using the command:
`/Choose Theme`

And you can set five preset themes to be listed in your CMD-J Command Bar for quick access using the command:
`/Change Theme Preset`

After you set them as presets, switching to that theme will be its own plugin command (one step), e.g.:
`/toothbleach`
or
`/dracula-pro`

This will also list the presets you choose in your NotePlan > Plugins menu bar, so you can assign your own keyboard shortcut using Keyboard Maestro or Apple's Keyboard System Settings.

NOTE: When you set one of the 5 presets using the `/Change Theme Preset` command, the theme is immediately available to you in the Command Bar. However, because NotePlan only generates the menu bar items once (at start-up), you will not see them in the menu bar until you restart NotePlan.
