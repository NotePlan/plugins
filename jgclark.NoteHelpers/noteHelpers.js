// @flow
//--------------------------------------------------------------------------------------------------------------------
// Note Helpers plugin for NotePlan
// Jonathan Clark
// v0.7.0, 14.5.2021
//--------------------------------------------------------------------------------------------------------------------

// Globals
var todaysDate = new Date().toISOString().slice(0, 10)
var defaultTodoMarker = (DataStore.preference("defaultTodoCharacter") !== undefined) ? DataStore.preference("defaultTodoCharacter") : "*"
var pref_templateName = []
var pref_templateText = []

// Items that should come from the Preference framework in time:
pref_templateName.push("Daily note structure")
pref_templateText.push("### Tasks\n\n### Media\n\n### Journal\n")
pref_templateName.push("Project Meeting note")
pref_templateText.push("### Project X Meeting on [[date]] with @Y and @Z\n\n### Notes\n\n### Actions\n")


//------------------------------------------------------------------
// Helper functions
//------------------------------------------------------------------
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

async function selectFolder() {
  if (Editor.type == "Notes") {

    // [String] list of options, placeholder text, callback function with selection
    let folder = await CommandBar.showOptions(DataStore.folders, "Select new folder for '" + Editor.title + "'")
    moveNote(folder.value)

  } else {
    console.log("\t can't move calendar notes.")
    CommandBar.hide()
  }
}

//------------------------------------------------------------------
// Command from Eduard to move a note to a different folder
function moveNote(selectedFolder) {
  console.log("move " + Editor.title + " (filename = '" + Editor.filename + "')" + " to " + selectedFolder)
  var newFilename = DataStore.moveNote(Editor.filename, selectedFolder)

  if (newFilename != undefined) {
    Editor.openNoteByFilename(newFilename)
    console.log("\tmoving note was successful")
  } else {
    console.log("\tmoving note was NOT successful")
  }
}

//------------------------------------------------------------------
// Create new note in current folder, and optionally with currently selected text
// Also now offers to use one of a number of Templates
async function newNote() {
  console.log("\nnewNote:")
  var sel = ""
  var currentFolder = ""
  // The Editor object is not always open, so have to handle possible error here
  // If it isn't open, then just carry on; all it means is that there won't be a selection.
  // TODO: Reported to EM that this is a bit of a hack, and it would be good to be able to
  // test for Editor?.content or similar.
  try { 
    sel = Editor.selectedText
    // console.log("\tCurrent cursor position: " + sel.start + " for " + sel.length + " chars")
    console.log("\tSelected text: " + sel)
    // Work out current folder name
    // NB: Handily, if we're in a daily note, then the currentFolder is empty
    let reArray = Editor.filename.match(/(.*)\/.*/)
    currentFolder = (reArray !== undefined) ? reArray[1] : ""
  }
  catch (err) {
    sel = "" // shouldn't be needed, but seems to be
  }
  finally {

    console.log("\tCurrent folder: " + currentFolder)

    // Get title for this note
    var title = await CommandBar.showInput("Enter title of the new note", "Create a new note with title '%@'")

    // If template(s) are defined, then ask which one to use, unless there is only one
    var templateText = ""
    if (pref_templateName.length == 1) {
      templateText = pref_templateText[0]
    } else if (pref_templateName.length > 1) {
      var defaultNone = ["(None)"]
      var names = defaultNone.concat(pref_templateName)
      var re = await CommandBar.showOptions(names, "Select template to use:")
      if (re.index != 0) {
        templateText = pref_templateText[re.index - 1]
        console.log("\Template name to use: '" + pref_templateName[re.index - 1])
      }
    }

    if (title !== undefined && title != "") {
      // Create new note in the specific folder
      let filename = DataStore.newNote(title, currentFolder)
      console.log("\tCreated note with title: " + title + "\tfilename: " + filename)
      // Add template text (if selected) then the previous selection (if present)
      await Editor.openNoteByFilename(filename)
      Editor.content = "# " + title + "\n" + templateText + sel
    } else {
      console.log("\tError: undefined or empty title")
    }
  }
}

//------------------------------------------------------------------
// Create new note in current folder, and optionally with currently selected text
// Also now offers to use one of a number of Templates
async function applyTemplate() {
  // The Editor object is not always open, so have to handle possible error here
  // If it isn't open, then just carry on; all it means is that there won't be a selection.
  // TODO: Reported to EM that this is a bit of a hack, and it would be good to be able to
  // test for Editor?.content or similar.
  try {
    console.log("\napplyTemplate for note " + Editor.filename)

    // If template(s) are defined, then ask which one to use, unless there's just one defined
    var templateText = ""
    if (pref_templateName.length == 1) {
      templateText = pref_templateText[0]
    } else if (pref_templateName.length > 1) {
      var names = pref_templateName
      var re = await CommandBar.showOptions(names, "Select template to use:")
      templateText = pref_templateText[re.index]
      console.log("\tTemplate name to use: " + pref_templateName[re.index])
    } else {
      throw "No templates configured."
    }

    // Insert template text after note's title (or at the top if a daily note)
    pos = (Editor.type == "Notes") ? 1 : 0
    Editor.note.insertParagraph(templateText, pos, "empty")
  }
  catch (err) {
    console.log("Error in applyTemplate: " + err)
  }
}

//------------------------------------------------------------------
// Jumps the cursor to the heading of the current note that the user selects
async function jumpToHeading() {
  var paras = Editor.paragraphs
  // Extract list of headings
  function isHeading(p) {
    return p.prefix.includes('#')
  }
  var headingParas = paras.filter(p => p.prefix.includes('#'))
  var headingValues = headingParas.map(p => p.content)

  // Present list of headingValues for user to choose from
  if (headingValues.length > 0) {
    let re = await CommandBar.showOptions(headingValues, "Select heading to jump to:")
    Editor.highlight(headingParas[re.index])
  } else {
    console.log("Warning: No headings found in this note")
  }
}

//------------------------------------------------------------------
// Jump cursor to the '## Done' heading in the current file
function jumpToDone() {
  var paras = Editor.note.paragraphs
  var paraCount = paras.length

  // Find the line of interest from all the paragraphs
  for (var i = 0; i < paraCount; i++) {
    var p = paras[i]
    console.log(i + ": " + p.content + " / "+ p.headingLevel)
    if (p.content == "Done" && p.headingLevel === 2) {
      // jump cursor to that paragraph
      Editor.highlight(p)
      break
    }
  }
  console.log("Warning: Couldn't find a ## Done section")
}

//------------------------------------------------------------------
// Set the title of a note from YAML, rather than the first line.
// NOTE: not currently working because of lack of API support yet (as of release 628)
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
    Editor.note.title = newTitle // TODO: setter not available not yet available (last checked on release 628)
  } 
  printNote(Editor.note)
}
