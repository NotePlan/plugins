const todo_api = "https://api.todoist.com/rest/v2"

// set some defaults that can be changed in settings
const api = {
    "token": '',

    set newToken(passedToken) {
        this.token = passedToken
    }
}

const folder = {
    "folder": 'Todoist',

    set newFolder(passedFolder) {
        this.folder = passedFolder
    }
}

const closed = []
const existing = []

// Will sync all projects (lists) from Todoists to a matching named note in Noteplan
async function syncAll() {

    // get the settings and set some process variables
    let settings = DataStore.settings
    //console.log(JSON.stringify(settings))
    if ("apiToken" in settings) {
        api.newToken = settings.apiToken
    } else {
        console.log('Missing API Token')
        process.exit(1)
    }
    if ("folderToUse" in settings && settings.folderToUse !== "") {
        let folders = DataStore.folders.filter((f) => f.startsWith(settings.folderToUse))
        folder.newFolder =settings.folderToUse
        console.log("New folder has been set: " + folder.folder)
        // if we can't find a matching folder, create it
        if (folders.length === 0) {
            try {
                DataStore.createFolder(folder.folder)
                console.log("New folder has been created (" + folder.folder + ")")
            } catch (error) {
                console.log("Unable to create new folder (" + folder.folder + ") in Noteplan (" + JSON.stringify(error) + ")")
                process.exit(1)
            }
        }
    }
    let projects = await getTodoistProjects()
    projects.forEach((project) => {

        console.log("Working on " + project.name)

        // see if there is an existing note or create it if not
        let note = getExistingNote(project.name)

        // get the completed tasks in noteplan and close them in todoist
        reviewExistingNoteplanTasks(note)
        closed.forEach((t) => { closeTodoistTask(t)} )

        // grab the tasks and write them out with sections
        getAndWriteTasks(project.id, note.note)
    })
    // completed correctly (in theory)
    console.log("Plugin completed without errors")
}

/** grab all tasks per Todoist project.
 * Will do the following per project
 * - check the priority in Todoist and match that to Noteplan priority
 * - attach a due date if available
 * - check if the task is in a section in Todoist, will put it under header in Noteplan
 * - check to see if the task is already in Noteplan, will skip these
**/
async function getAndWriteTasks(project_id, note_name) {
    try {
        fetch(todo_api + '/tasks?project_id=' + project_id,
            {
                method: 'GET',
                headers: {
                    'Authorization': 'Bearer ' + api.token,
                    'Content-Type': 'application/json'
                }
            }).then((response) => {
            let tasks = JSON.parse(response)
            tasks.forEach((task) => {

                let task_write = ''
                // get the priority
                if (task.priority === 4) {
                    task_write = "!!! " + task.content
                } else if (task.priority === 3) {
                    task_write = "!! " + task.content
                } else if (task.priority === 2) {
                    task_write = "! " + task.content
                } else {
                    task_write = task.content
                }

                task_write = task_write + "[^](" + task.url + ")"

                if (task.due !== null) {
                    task_write = task_write + " >" + task.due.date
                }

                let note = DataStore.projectNoteByFilename(note_name)
                if (task.section_id !== null) {
                    fetch(todo_api + '/sections/' + task.section_id,
                        {
                            method: 'GET',
                            headers: {
                                'Authorization': 'Bearer ' + api.token,
                                'Content-Type': 'application/json'
                            }
                        }).then((response) => {
                        let section = JSON.parse(response)
                        if (!existing.includes(task.id)) {
                            note.addTodoBelowHeadingTitle(task_write, section.name, true, true)
                        }
                    })
                } else {
                    if (!existing.includes(task.id)) {
                        note.prependTodo(task_write)
                    }
                }
            })
        })
    } catch (error) {
        console.log("Error in getting tasks from Todoist (" + JSON.stringify(error) + ")")
    }
    console.log("Tasks synced for " + note_name)
}

/**
 * Will search Noteplan in the set folder for a note that matches the Todoist project name.
 * Will create if it does not exist
 * @param project_name
 * @return object
 */
function getExistingNote(project_name) {
    let name = ''
    let title = ''
    let existing_notes = DataStore.projectNotes.filter((n => n.filename.startsWith(folder.folder + '/' + project_name)))
    if (existing_notes.length > 0) {
        console.log("Pulling existing note matching project: " + project_name + ".  Note found: " + existing_notes[0].filename)
        name = existing_notes[0].filename
        title = existing_notes[0].title
    } else {
        console.log("Creating note: " + project_name + " in: " + folder.folder)
        try {
            name = DataStore.newNote(project_name, folder.folder)
            title = project_name
        } catch (error) {
            console.log("Unable to create new note (" + JSON.stringify(error))
        }
    }
    return ({"note": name, "title": title})
}

/**
 * Check the existing Noteplan note and check for tasks.
 * - if closed will add to array to be closed in Todoist
 * - if open, will check to see if Todoist task is closed. Will close in Noteplan if so.  THIS IS NOT CURRENTLY WORKING.
 * - will track list of other open tasks so they are not repeated
 * @param note
 */
function reviewExistingNoteplanTasks(note) {
    // we only need to work on the ones that have a page associated with them
    if ("note" in note) {

        try {
            let note_to_check = DataStore.projectNoteByFilename(note.note)
            let paragraphs = note_to_check.paragraphs

            paragraphs.forEach((paragraph) => {
                if (paragraph.type === "done" || paragraph.type === "cancelled") {
                    let content = paragraph.content

                    // close these ones in Todoist if they are closed in Noteplan and are todoist tasks
                    let found = content.match(/showTask\?id=(.*)\)/)
                    if (found) {
                        if (found.length > 1) {
                            closed.push(found[1])
                            // add to existing as well so they do not get rewritten if the timing on closing them is slow
                            existing.push(found[1])
                        }
                    }
                } else if (paragraph.type === "open") {
                    let content = paragraph.content
                    let found = content.match(/showTask\?id=(.*)\)/)
                    if (found) {
                        if (found.length > 1) {
                            // check to see if it is already closed in Todoist.
                            fetch(todo_api + '/tasks/' + found[1],
                                {
                                    method: 'GET',
                                    headers: {
                                        'Authorization': 'Bearer ' + api.token,
                                        'Content-Type': 'application/json'
                                    }
                                }).then((response) => {
                                let task_info = JSON.parse(response)
                                if (task_info.is_completed === true) {
                                    console.log("Going to mark this one closed in Noteplan: " + task_info.content)
                                    paragraph.type = "done"
                                    note_to_check.updateParagraph(paragraph)
                                }
                            })
                            existing.push(found[1])
                        }
                    }
                }
            })
        } catch (error) {
            console.log("There is an issue getting tasks from " + note.note + " (" + JSON.stringify(error) + ")")
        }
    }
}

/**
 * Get a list of Todoist projects (lists)
 * @return {Promise<*[]>}
 */
async function getTodoistProjects() {
    try {
        let response = await fetch(todo_api + '/projects',
            {
                method: 'GET',
                headers: {
                    'Authorization': 'Bearer ' + api.token,
                    'Content-Type': 'application/json'
                }
            })

        let project_list = []
        let projects = JSON.parse(response)
        projects.forEach((project) => {
            console.log("Project name: " + project.name + " Project ID: " + project.id)
            project_list.push({"name": project.name, "id": project.id})
        })
        return project_list
    } catch (error) {
        console.log("Unable to retrieve project list from Todoist (" + JSON.stringify(error) + ")")
        process.exit(1)
    }
}

/**
 * Close a task in Todoist
 * @param task_id
 * @return {Promise<void>}
 */
async function closeTodoistTask(task_id) {
    //console.log("Closing this one: " + task_id)
    let response = await fetch(todo_api + '/tasks/' + task_id + '/close',
        {
            method: 'POST',
            headers: {
                'Authorization': 'Bearer ' + api.token
            }
        })
    // need to figure out how to get the status code correctly
    /*
    if (response.ok) {
        console.log('Closed Todoist task ' + task_id + ' correctly')
    } else {
        console.log('There was an issue closing Todoist task ' + task_id)
    }
    */
}

function onUpdateOrInstall() {
    let settings = DataStore.settings
    if ("apiToken" in settings) {
        api.newToken = settings.apiToken
    }
    if ("folderToUse" in settings) {
        folder.newFolder = settings.folderToUse
    }
}