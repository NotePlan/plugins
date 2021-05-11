//      
function sweepFile()       {
  const type = Editor.type
  const note = Editor.note
  if (type === 'Calendar') {
    const todayNoteFileName = filenameDateString(new Date())
    if (Editor.filename?.startsWith(todayNoteFileName)) {
      console.log("This is already scheduled for today")
      return;
    }
    return sweepCalendarNote(note)
  } else {
    return sweepProjectNote(note)
  }
}

function sweepCalendarNote(note       )       {
  const paragraphs = note.paragraphs

  const indentsToMove                = [];

  let lastOpen = false;
  for (let i = 0; i < paragraphs.length; i++) {
    const para = paragraphs[i]
    if (para.indents > 0) {
      if (lastOpen) {
        indentsToMove.push(i);
      }
    } else {
      lastOpen = para.type === 'open';
      if (para.type === 'open') {
        indentsToMove.push(i);
      }
    }
    console.log(para.indents)
    console.log(para.type)
    console.log(para.rawContent)
    console.log('\n')
  }

  const paragraphCopies = paragraphs
    .filter((_, index) => indentsToMove.includes(index))
    .map(para => para.duplicate())

  const todayNote = DataStore.calendarNoteByDate(new Date());
  if (todayNote == null) {
    return;
  }

  // Add Tasks to Today
  todayNote.paragraphs = [...todayNote.paragraphs, ...paragraphCopies]

  // Remove Tasks from the open day
  note.paragraphs = note.paragraphs
    .filter((_, index) => !indentsToMove.includes(index))
}

function sweepProjectNote(note       )       {
  const paragraphs = note.paragraphs

  paragraphs.forEach(para => {
    if (para.type === 'open' && para.date != null) {
      const paraDateString = hyphenatedDateString(para.date);
      const todayDateString = hyphenatedDateString(new Date());

      if (paraDateString < todayDateString) {
        para.content = para.content.replace(paraDateString, todayDateString)
      }
    }
  })

  note.paragraphs = paragraphs
}

function sweepAll()       {
  DataStore.projectNotes.forEach(sweepProjectNote)

  const todayFileName = filenameDateString(new Date());
  DataStore.calendarNotes
    .filter(note => note.filename < todayFileName)
    .forEach(sweepCalendarNote)
}


// Helpers

function getToday() {
  return getYearMonthDate(new Date())
}

function getYearMonthDate(dateObj      ) {
  const year = dateObj.getFullYear()
  const month = dateObj.getMonth() + 1
  const date = dateObj.getDate()
  return {year, month, date};
}

function hyphenatedDateString(dateObj      ) {
  const {year, month, date} = getYearMonthDate(dateObj);
  return `${year}-${month < 10 ? '0' : ''}${month}-${date < 10 ? '0' : ''}${date}`
}
function filenameDateString(dateObj      ) {
  const {year, month, date} = getYearMonthDate(dateObj);
  return `${year}${month < 10 ? '0' : ''}${month}${date < 10 ? '0' : ''}${date}`
}

function isAsteriskTodo()          {
  return DataStore.preference('isAsteriskTodo') === true
}

function isDashTodo()          {
  return DataStore.preference('isDashTodo') === true
}

function isNumbersTodo()          {
  return DataStore.preference('isNumbersTodo') === true
}

function defaultTodoCharacter()            {
  return DataStore.preference('defaultTodoCharacter')
}
