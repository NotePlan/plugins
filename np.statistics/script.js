
function init() {
    // Anything you need to do to setup the script. You can keep it empty or delete the function, too.
}

// IDEAS:
//	- Task counts across time frames, like this week, this month, this year.
//	- Task counts in projects
//	- Note counts
// 	- Overdue counts
//	- Upcoming counts

async function showTaskCount() {
	var paragraphs = Editor.paragraphs

	var countParagraphs = function(types) {
		return paragraphs.filter(p => types.includes(p.type)).length
	}

	var percent = function(value, total) {
		return value + " ("+ Math.round(value/total*100) + "%)"
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

async function showWordCount() {
  var paragraphs = Editor.paragraphs
  var note = Editor.note

  var charCount = 0
  var wordCount = 0
  var lineCount = 0
  var mentionCount = note.mentions.length
  var tagCount = note.hashtags.length

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

  var display = ["Characters: " + charCount, 
  				 "Words: " + wordCount, 
  				 "Lines: " + lineCount, 
  				 "Mentions: " + mentionCount, 
  				 "Hashtags: " + tagCount]

  var re = await CommandBar.showOptions(display, "Word count. Select anything to copy.")
  if(re !== null) {
  	Clipboard.string = display.join("\n")
  }
}

