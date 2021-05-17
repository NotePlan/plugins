// @flow

async function sweepFile(): void {
  const type = Editor.type
  const note = Editor.note

  if (type === 'Calendar') {
    const todayNoteFileName = filenameDateString(new Date()) + "." + DataStore.defaultFileExtension;
    if (Editor.filename == todayNoteFileName) {
      await CommandBar.showInput("Open a different note than today", "OK")
      return;
    }
    return sweepCalendarNote(note)
  } else {
    return sweepProjectNote(note)
  }
}

async function sweepAll(): void {
  let re = await CommandBar.showOptions(["7 days", "14 days", "21 days", "1 month", "3 months", "6 months", "1 year", "❌ Cancel"], "🧹 Reschedule tasks to today of the last...");

  var num = 0;
  var unit = "day"
  switch(re.index) {
    case 0: num = 7; break;
    case 1: num = 14; break;
    case 2: num = 21; break;
    case 3: num = 1; unit = "month";  break;
    case 4: num = 3; unit = "month"; break;
    case 5: num = 6; unit = "month"; break;
    case 6: num = 1; unit = "year"; break;
    default: return;
  }
  
  // TODO: Something not working here.
  let afterDateFileName = filenameDateString(Calendar.addUnitToDate(new Date(), unit, -num));
  DataStore.projectNotes.forEach(n => sweepProjectNote(n, false, afterDateFileName))

  const todayFileName = filenameDateString(new Date());
  DataStore.calendarNotes
    .filter(note => note.filename < todayFileName && note.filename >= afterDateFileName)
    .forEach(n => sweepCalendarNote(n, false))
}

// Helpers

async function sweepCalendarNote(note: TNote, withUserConfirm: Boolean = true): void {
  const paragraphs = note.paragraphs

  const paragraphsToMove: Array<Paragraph> = [];
  const paragraphsToRemove: Array<Paragraph> = [];

  const moveableTypes = ["open", "title"];
  const mainItemTypes = ["open"];
  const nonMovableTypes = ["scheduled", "cancelled", "done"];
  const resetTypes = ["title", "empty"];
  let lastRootItem: Paragraph = null;

  paragraphs.forEach((p, index) => {
    if(nonMovableTypes.includes(p.type)) { return; }

    // Remember the last item which is not indented and open, or a bullet
    if(mainItemTypes.includes(p.type) && p.indents == 0) {
      lastRootItem = p
    }

    // Reset the root item to null if a heading comes in between
    if(resetTypes.includes(p.type) && p.indents == 0) {
      lastRootItem = null
    }

    // Either all movable types, or anything indented, if the parent is indented as well.
    if(moveableTypes.includes(p.type) || ((p.indents > 0 || p.type == "empty") && lastRootItem != null)) { 
      paragraphsToMove.push(p)

      if(!["title", "empty"].includes(p.type)) {
        paragraphsToRemove.push(p)
      }
    }
  })

  // TODO: Match existing headings
  // TODO: Add back non-todo main types if it has indented todos
  // TODO: Filter out "empty" headings
  // TODO: Don't remove root tasks or bullets, if they have at least one closed item below, indented as child. Rather, check it off

  const todayNote = DataStore.calendarNoteByDate(new Date());
  if (todayNote == null) {
    return;
  }

  let numTasksToMove = paragraphsToMove.filter(p => p.type == "open").length;
  if(numTasksToMove > 0) {
    var re = { index: 0 };
    if(withUserConfirm) {
      re = await CommandBar.showOptions(["✂️ Move (cut & paste) " + numTasksToMove + " task(s) to today", "❌ Cancel"], "🧹 Ready to sweep?");
    }

    if(re.index == 0) {
      // Add Tasks to Today
      todayNote.paragraphs = [...todayNote.paragraphs, ...paragraphsToMove]

      // Remove Tasks from the open day. Use 'Editor', since we apply this to the opened note (or day). Then you can use undo to revert changes.
      if(Editor.filename == note.filename) {
        Editor.paragraphs = note.paragraphs
          .filter((_, index) => !(paragraphsToRemove.map(p => p.lineIndex)).includes(index))
      } else {
        note.paragraphs = note.paragraphs
          .filter((_, index) => !(paragraphsToRemove.map(p => p.lineIndex)).includes(index))
      }
    }
  } else {
    if(withUserConfirm) {
      await CommandBar.showInput("There are no open tasks to move in this note.", "OK, I'll open another date.");
    }
  }
}

async function sweepProjectNote(note: TNote, withUserConfirm: Boolean = true, afterDateFileName: String = ""): void {
  const paragraphs = note.paragraphs
  const todayDateString = hyphenatedDateString(new Date());

  let numTasksToUpdate = paragraphs.filter((p) => {
    return p.type == "open" && p.date != null && hyphenatedDateString(p.date) < todayDateString &&
    hyphenatedDateString(p.date) >= afterDateFileName
  }).length;

  if(numTasksToUpdate > 0) {
    var re = { index: 0 };
    if(withUserConfirm) {
      re = await CommandBar.showOptions(["🔗 Yes, Reschedule (update '>date') " + numTasksToUpdate + " task(s) to today", "❌ No, Cancel"], "🧹 Ready to sweep?");
    }

    if(re.index == 0) {
      paragraphs.forEach(para => {
        if (para.type === 'open' && para.date != null) {
          const paraDateString = hyphenatedDateString(para.date);
    
          if (paraDateString < todayDateString && paraDateString >= afterDateFileName) {
            para.content = para.content.replace(paraDateString, todayDateString)
          }
        }
      })
    
      if(Editor.filename == note.filename) {
        Editor.paragraphs = paragraphs
      } else {
        note.paragraphs = paragraphs
      }
    }
    
  } else {
    if(withUserConfirm) {
      await CommandBar.showInput("Everything is up to date here!", "OK, I'll open another note.");
    }
  }
}

function getYearMonthDate(dateObj: Date) {
  const year = dateObj.getFullYear()
  const month = dateObj.getMonth() + 1
  const date = dateObj.getDate()
  return {year, month, date};
}

function hyphenatedDateString(dateObj: Date) {
  const {year, month, date} = getYearMonthDate(dateObj);
  return `${year}-${month < 10 ? '0' : ''}${month}-${date < 10 ? '0' : ''}${date}`
}

function filenameDateString(dateObj: Date) {
  const {year, month, date} = getYearMonthDate(dateObj);
  return `${year}${month < 10 ? '0' : ''}${month}${date < 10 ? '0' : ''}${date}`
}
