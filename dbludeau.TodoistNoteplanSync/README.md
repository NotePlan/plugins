# Todoist Noteplan Sync Noteplan Plugin

## Latest Updates

See [CHANGELOG](https://github.com/NotePlan/plugins/blob/main/dbludeau.TodoistNoteplanSync/CHANGELOG.md) for latest updates/changes to this plugin.

## About
Commands to allow tasks from Todoist to sync to Noteplan.  Noteplan is great for almost everything, but if you want to use it to control your task lists it lacks good quick entry ability from anywhere.  Todoist has great quick entry capabilities from mac, windows, mobile and elsewhere.  While there are many apps that have these capabilities, Todoist also has an easy to use API for pulling data.  This will work with both the free and paid version of Todoist (I have not paid and was able to do everything in this plugin). 

### Current Sync Actions
NOTE: All sync actions (other then content and status) can be turned on and off in settings.  Everything not in this list (like task descriptions and reminders will be ignored).
- From Todoist to Noteplan
    - Task content
    - Due dates
    - Priority
    - Status (open/closed)
    - Tags (coming soon)
- From Noteplan to Todoist
    - Status (open/closed)


## Available Commands
- **/todoist sync everything** (alias **/tosa**): sync everything in Todoist to a folder in Noteplan.  Every list in todoist will become a note in Noteplan.  Use this if you want to use Todoist just as a conduit to get tasks into Noteplan.  The folder can be configured in settings.
- **/todoist sync today** (alias **/tost): sync tasks due today from Todoist to your daily note in Noteplan. A header can be configured in settings.

## Configuration
- This plug in requires an API token from Todoist.  These are available on the free and paid plans. To get the token follow the instructions [here](https://todoist.com/help/articles/find-your-api-token)
- You can configure a folder to use for syncing everything, headings that tasks will fall under and what details are synced.  
- Currently the API token is required, everything else is optional.

## Caveats, Warnings and Notes
- The sync relies on the Todoist ID being present in Noteplan.  This is stored at the end of a synced task in the form of a link to www.todoist.com.
  - These links can be used to view the Todoist task on the web.
  - WARNING: if the link is modified or deleted, the ability to sync will be lost.
- This has not been tested on subtasks.  Noteplan does not really handle subtasks, so best not to use them in Todoist for anything you want to sync.
- This will pull in the next instance of a repeating task.  The behaivor should mimic Todoist with those tasks.

## Coming Next
- Syncing Tags from Todoist to Noteplan (will be optional)
- Ability to link a note in Noteplan to a list in Todoist (probably using Frontmatter). 
    - Command to sync just the current note that is linked
    - command to sync all notes that are linked in this way (this will be different then the current sync everything, as this will sync just everything that is specifically linked)
- Possible detailed sync back to Todoist.  Currently will only sync closed (or cancelled) status. If demand is there, can sync back changes in priorities, due dates, tags.
