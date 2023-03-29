# 🎛 Dashboard plugin
This plugin provides a **dashboard window** that in one place shows a compact list of just the:
- open tasks and checklists from today's note
- scheduled open tasks and checklists from other notes to today
- open tasks and checklists from this week's note
- scheduled open tasks and checklists from other notes to this week
- next few notes to review (if you use the "Projects and Reviews" plugin)

To open this run the **/show dashboard** command.

![](dashboard-v0.2@2x.jpg)

All tasks and checklists can be marked as completed by clicking in its usual open circle or square. The item is then completed in NotePlan, and removed from view in this list.

Note: _It provides this in a view that doesn't use NotePlan's normal editor, but a more flexible HTML-based display that mimics your current NotePlan theme._

If already open, the dashboard window will now automatically update when a change is made in the relevant calendar note(s). This requires [adding a trigger to the frontmatter](https://help.noteplan.co/article/173-plugin-note-triggers) of the relevant daily/weekly note(s):

```yaml
---
triggers: onEditorWillSave => jgclark.Dashboard.decideWhetherToUpdateDasboard
---
```

Other notes:
- when the window is wide enough, it will switch to a multi-column display
- it de-dupes items that would appear twice in a list where the lines are sync'd together.

## Getting started
This requires the 'Shared' plugin to be installed as well. It should automatically offer to install it if it isn't already.

## Support
If you find an issue with this plugin, or would like to suggest new features for it, please raise a [Bug or Feature 'Issue'](https://github.com/NotePlan/plugins/issues).

If you would like to support my late-night work extending NotePlan through writing these plugins, you can through:

[<img width="200px" alt="Buy Me A Coffee" src="https://www.buymeacoffee.com/assets/img/guidelines/download-assets-sm-2.svg">](https://www.buymeacoffee.com/revjgc)

Thanks!

## History
Please see the [CHANGELOG](CHANGELOG.md).
