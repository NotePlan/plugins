// @flow
//-----------------------------------------------------------------------------
// Statistic commands
// Jonathan Clark & Eduard Metzger
// v0.1.2, 15.5.2021
//-----------------------------------------------------------------------------

function init() {
    // Anything you need to do to setup the script. You can keep it empty or delete the function, too.
}

// IDEAS TODO:
//	- Task counts across time frames, like this week, this month, this year.
//	- Task counts in projects
// 	- Overdue counts
//	- Upcoming counts

//-----------------------------------------------------------------------------
// Helper function
function percent (value, total) {
	return value + " (" + Math.round(value / total * 100) + "%)"
}

//-----------------------------------------------------------------------------
// Show note counts
async function showNoteCount() {
	var calNotes = DataStore.calendarNotes
	var projNotes = DataStore.projectNotes
	var total = calNotes.length + projNotes.length
	var createdLastMonth = projNotes.filter(n => Calendar.unitsAgoFromNow(n.createdDate, "month") < 1)
	var createdLastQuarter = projNotes.filter(n => Calendar.unitsAgoFromNow(n.createdDate, "month") < 3)
	var updatedLastMonth = projNotes.filter(n => Calendar.unitsAgoFromNow(n.changedDate, "month") < 1)
	var updatedLastQuarter = projNotes.filter(n => Calendar.unitsAgoFromNow(n.changedDate, "month") < 3)

	var display = [
		"🔢 Total: " + total,
		"📅 Calendar notes: " + calNotes.length + " (equivalent to " + Math.round(calNotes.length / 36.5)/10.0 + " years)",
		"🛠 Project notes: " + projNotes.length,
		"      - created in last month: " + percent(createdLastMonth.length, projNotes.length),
		"      - created in last quarter: " + percent(createdLastQuarter.length, projNotes.length),
		"      - updated in last month: " + percent(updatedLastMonth.length, projNotes.length),
		"      - updated in last quarter: " + percent(updatedLastQuarter.length, projNotes.length)
	]

	var re = await CommandBar.showOptions(display, "Notes count. Select anything to copy.")
	if (re !== null) {
		Clipboard.string = display.join("\n")
	}
}

//-----------------------------------------------------------------------------
// Show task counts for currently displayed note
async function showTaskCount() {
	var paragraphs = Editor.paragraphs

	var countParagraphs = function(types) {
		return paragraphs.filter(p => types.includes(p.type)).length
	}

	var total = countParagraphs(["open", "done", "scheduled", "cancelled"])

	var display = [
					"🔢 Total: " + total,
					"✅ Done: " + percent(countParagraphs(["done"]), total), 
				 	"⚪️ Open: " + percent(countParagraphs(["open"]), total), 
  			 	"🚫 Canceled: " + percent(countParagraphs(["cancelled"]), total), 
  			 	"📆 Scheduled: " + percent(countParagraphs(["scheduled"]), total),  
  			 	"📤 Closed: " + percent(countParagraphs(["done", "scheduled", "cancelled"]), total), 
  ]

	var re = await CommandBar.showOptions(display, "Task count. Select anything to copy.")
	if(re !== null) {
		Clipboard.string = display.join("\n")
	}
}

//-----------------------------------------------------------------------------
// Show word counts etc. for currently displayed note
async function showWordCount() {
  var paragraphs = Editor.paragraphs
  var note = Editor.note

  var charCount = 0
  var wordCount = 0
  var lineCount = 0
  var mentionCount = note.mentions.length
  var tagCount = note.hashtags.length

	var bulletCount = 0
	var prefixCount = 0

  paragraphs.forEach((p) => {
  	charCount += p.content.length

  	if(p.content.length > 0) {
			var match = p.content.match(/\w+/g)
  		if(match != null) {
  			wordCount += match.length
			}
  	}
  	
  	lineCount += 1
  })

  var selectedCharCount = Editor.selectedText.length
  var selectedWordCount = 0

  if(selectedCharCount > 0) {
  	selectedWordCount = Editor.selectedText.match(/\w+/g).length
  }

  var selectedLines = Editor.selectedLinesText.length

  var display = ["Characters: " + (selectedCharCount > 0 ? selectedCharCount + "/" + charCount : charCount), 
  				 "Words: " + (selectedWordCount > 0 ? selectedWordCount + "/" + wordCount : wordCount), 
  				 "Lines: " + (selectedLines > 1 ? selectedLines + "/" + lineCount : lineCount), 
  				 "Mentions: " + mentionCount, 
  				 "Hashtags: " + tagCount]

  var re = await CommandBar.showOptions(display, "Word count. Select anything to copy.")
  if(re !== null) {
  	Clipboard.string = display.join("\n")
  }
}
