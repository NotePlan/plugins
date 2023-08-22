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
- **/todoist sync today** (alias **/tost**): sync tasks due today from Todoist to your daily note in Noteplan. A header can be configured in settings.
- **/todoist sync project** (alias **/tosp**): link a single list from Todoist to a note in Note plan using Frontmatter.  This command will sync the current project you have open.
- **/todoist sync all projects** (alias **/tosa**): this will sync all projects that have been linked using Frontmatter.

## Configuration
- This plug in requires an API token from Todoist.  These are available on the free and paid plans. To get the token follow the instructions [here](https://todoist.com/help/articles/find-your-api-token)
- You can configure a folder to use for syncing everything, headings that tasks will fall under and what details are synced.  
- Currently the API token is required, everything else is optional.
- To link a Todoist list to a Noteplan note, you need the list ID from Todoist.  To get the ID, open www.todoist.com in a web browser and sign in so you can see your lists.  Open the list you want to link to a Noteplan note.  The list ID is at the end of the URL.  For example, if the end of the Todoist.com URL is /app/project/2317353827, then you want the list ID of 2317353827. You would add frontmatter to the top of your note that would look like (see https://help.noteplan.co/article/136-templates for more information on frontmatter):
```
---
todoist_id: 2317353827
---
```

## Caveats, Warnings and Notes
- The sync relies on the Todoist ID being present in Noteplan.  This is stored at the end of a synced task in the form of a link to www.todoist.com.
  - These links can be used to view the Todoist task on the web.
  - WARNING: if the link is modified or deleted, the ability to sync will be lost.
- There is no automated clean up of completed tasks in Noteplan.  They are just marked as completed.  We can see what people think is best and enhance clean up in the future.

## Coming Next
- Possible detailed sync back to Todoist.  Currently will only sync closed (or cancelled) status. If demand is there, can sync back changes in priorities, due dates, tags. Will need to have a setting to decide which application is the source of truth.
