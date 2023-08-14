# Todoist Noteplan Sync plugin

This plugin will sync lists in Todoist (they call them projects) to notes in Noteplan.
This is close to 2 way sync (wth some caveats - see Warnings below).  Each list in Todoist will be matched to a Note in the set folder.  If the note does not exist, it will be created.
If the task in Todoist is under a section in the list, that section will become a Header in noteplan.
The sync will include due dates and priorities and carry those over to Noteplan.

I created this because I like the quick entry ability of Todoist.  Adding a task is simple on desktop, web and mobile.  Noteplan has quick add plugins, but they are not as robust as many dedicated todo apps.  I chose Todoist becuase they have the best and easiest API.
## Available Commands
- **/todoist sync all** (alias **/tsa**): sync all projects from Todoist to Noteplan

## Configuration
- This plug in requires an API token from Todoist.  These are available on the free and paid plans. To get the token follow the instructions [here](https://todoist.com/help/articles/find-your-api-token)
- You can also set a folder in Noteplan where the new pages will be stored.  This is optional.  If it is omitted, the program will look for a "Todoist" folder in the root folder, and create it if is does not exist.

## Caveats, Warnings and Notes
- The sync relies on the Todoist ID being present in Noteplan.  This is stored at the end of a synced task in the form of a link to www.todoist.com.
  - These links can be used to view the Todoist task on the web.
  - WARNING: if the link is modified or deleted, the ability to sync will be lost.
- This has not been tested on subtasks heavily.  They should show up in Noteplan, but they lose connection to their parent task.
- This only looks for the task content, the task due date, the task section and the task priority.
  - Things like descriptions, tags, and reminders set in Todoist will be ingnored at current.
- This will pull in the next instance of a repeating task.  The behaivor should mimic Todoist with those tasks.
- WARNING: The author is one of those programmers who years ago moved into management.  He does not like Javascript at all.  Things will get enhanced and fixed, but not without some curse words. 