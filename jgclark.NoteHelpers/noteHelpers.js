//--------------------------------------------------------------------------------------------------------------------
// Note Helpers plugin for NotePlan
// Jonathan Clark
// v0.3.0, 28.4.2021
//--------------------------------------------------------------------------------------------------------------------

// Globals
var todaysDate = new Date().toISOString().slice(0, 10)
var defaultTodoMarker = (DataStore.preference("defaultTodoCharacter") != undefined) ? DataStore.preference("defaultTodoCharacter") : "*"

//------------------------------------------------------------------
// TODO: separate out helpers into a separate file?
//------------------------------------------------------------------
// Helper function, not called by a command
function printNote(note) {
  if (note == undefined) {
    console.log("Note not found!")
    return
  }

  if (note.type == "Notes") {
    console.log(
      "title: " + note.title +
      "\n\tfilename: " + note.filename +
      "\n\thashtags: " + note.hashtags +
      "\n\tmentions: " + note.mentions +
      "\n\tcreated: " + note.createdDate +
      "\n\tchanged: " + note.changedDate)
  } else {
    console.log(
      "date: " + note.date +
      "\n\tfilename: " + note.filename +
      "\n\thashtags: " + note.hashtags +
      "\n\tmentions: " + note.mentions)
  }
}

//------------------------------------------------------------------
// Global variables for following helper functions -- hopefully now not needed
// var workingNote = ""
// var line_count
// var lines = []
// var line_number // needed ?

//------------------------------------------------------------------
// NOTE: shouldn't now be needed, as EM has provided
//   note.insertParapgrahBeforeParagraph(todoTitle, heading, "list") etc.
//
// Insert 'new_line' into position 'line_number'.
// don't go beyond current size of @lines
// function insert_new_line_at_line(new_line, line_number) {
//   var n = (line_number >= lines.length) ? lines.length : line_number
//   console.log(". insert_new_line_at_line " + n + " ...")
//   // break line up into separate lines(on "\n") -- will often be overkill
//   var line_a = new_line.split("\n")
//   line_a.forEach(lineToAdd)
//   function lineToAdd(value) {
//     lines.splice(n, 0, value)
//     n += 1
//   }
//   line_count = lines.length
// }

//------------------------------------------------------------------
// NOTE: shouldn't now be needed, as EM has provided
//   note.insertParapgrahBeforeParagraph(todoTitle, heading, "list") etc.
//
// Insert 'new_line' into position 'line_number'.
// don't go beyond current size of @lines
// function updateNoteInDataStore(noteToUpdate) {
//   noteToUpdate.content = lines.join("\n")
//   console.log("  -> updated content for " + noteToUpdate.filename + " (" + line_count + " lines)")
// }

//------------------------------------------------------------------
// Create new note in current folder, and optionally with currently selected text
async function newNote() {
  console.log("\nnewNote:")

  var sel = Editor.selectedText
  // console.log("\tCurrent cursor position: " + sel.start + " for " + sel.length + " chars")
  // selectedText = (sel.length > 0) ? Editor.content.slice(sel.start, sel.start + sel.length) : "" // NB: There's a bug in sel.start, and it misses out some URLs.
  console.log("\tSelected text: " + sel)
  reArray = Editor.filename.match(/(.*)\/.*/)
  var currentFolder = (reArray != undefined) ? reArray[1] : ""
  // Handily, if we're in a daily note, then the currentFolder is empty, 
  // the following will create the new note in the top-level notes directory.
  console.log("\tCurrent folder: " + currentFolder)

  var title = await CommandBar.showInput("Enter title of the new note", "Create a new note with title '%@'")
  if (title != undefined && title != "") {
    let filename = DataStore.newNote(title, currentFolder)
    console.log("\tCreated note with title: " + title + "\tfilename: " + filename)
    // If we had a current text selection then add as content
    await Editor.openNoteByFilename(filename)
    if (sel != undefined && sel != "") {
      Editor.content = "# " + title + "\n" + sel
    }
  } else {
    console.error("\tError: Reply undefined or empty (" + err + ")")
    // stop somehow?
  }
}

//------------------------------------------------------------------
// Write out a statistical summary to the console.log
// TODO: In time write to a UI panel
function statistics() {
  n = Editor.note
  console.log("Statistics for '" + n.title + "': " + todaysDate)
  var byteCount = n.content.length
  var lines = n.content.split("\n")
  var lineCount = lines.length
  var wordCount = n.content.match(/\w+/g).length // TODO: remove task and bullet markers
  var mentionCount = n.mentions.length
  var tagCount = n.hashtags.length
  console.log("\tCharacters:\t" + byteCount)
  console.log("\tWords:\t" + wordCount)
  console.log("\tLines:\t" + lineCount)
  console.log("\tMentions:\t" + mentionCount)
  console.log("\tTags:\t" + tagCount)

  // Do task counts
  // Definition of Regular Expressions
  if (defaultTodoMarker == "-") {
    var RE_TASK = new RegExp(/^\s*\-\s*/)
  }
  else {
    var RE_TASK = new RegExp(/^\s*\*\s*/)
  }
  var taskCount = 0
  var openTaskCount = 0
  var completedTaskCount = 0
  var cancelledTaskCount = 0
  var futureTaskCount = 0
  for (var i = 0; i < lineCount; i++) {
    let l = lines[i]
    if (l.match(RE_TASK)) {
      taskCount += 1
      if (l.match(/\s\[x\]\s/)) {
        completedTaskCount += 1
      } else if (l.match(/\s\[-\]\s/)) {
        cancelledTaskCount += 1
      } else {
        var rer = l.match(/>(\d{4}-[01]\d-\d{2})/)
        if (rer != undefined && rer.length > 0) { // we have a date; is it in the future?
          if (rer[1] > todaysDate) {
            futureTaskCount += 1
          }
        }
      }
    }
  }
  openTaskCount = taskCount - completedTaskCount - cancelledTaskCount
  console.log("\tOpen tasks:\t" + openTaskCount + " (of which " + futureTaskCount + " are future)")
  console.log("\tCompleted tasks:\t" + completedTaskCount)
  console.log("\tCancelled tasks:\t" + cancelledTaskCount)
}

//------------------------------------------------------------------
// Insert 'new_line' at start of a section headed 'section_heading'
// If this is blank, then insert after start of note metadata

// NOTE: not currently working because of bug in release 625/6

// TODO: add following back into plugin.json to active this again:
// {
//   "name": "Set title from YAML",
//     "description": "Set the note's title from the YAML or frontmatter block, not the first line",
//       "jsFunction": "setTitleFromYAML"
// },

function setTitleFromYAML() {
  console.log("setTitleFromYAML:\n\told title = " + Editor.note.title)
  var lines = Editor.content.split("\n")
  var n = 0
  var newTitle = ""
  while (n < lines.length) {
    if (lines[n].match(/^[Tt]itle:\s*.*/)) {
      var rer = lines[n].match(/^[Tt]itle:\s*(.*)/)
      newTitle = rer[1]
    }
    if (lines[n] == "" || lines[n] == "...") {
      break
    }
    n += 1
  }
  console.log("\tnew title = " + newTitle)
  if (newTitle != "") {
    Editor.note.title = newTitle // FIXME: setter doesn't work in 625 or 626
  } 
  printNote(Editor.note)
}
