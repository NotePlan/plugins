var exports = (function (exports) {
  'use strict';

  //-------------------------------------------------------------------------------

  async function showMessage(message, confirmTitle = 'OK') {
    await CommandBar.showOptions([confirmTitle], message);
  } // Show feedback Yes/No Question via Command Bar (@dwertheimer)
  // Date functions
  // @jgclark except where shown

  const RE_DATE = '\\d{4}-[01]\\d{1}-\\d{2}'; // find dates of form YYYY-MM-DD

  new Date().toISOString().slice(0, 10); // TODO: make a friendlier string

  const nowShortDateTime = new Date().toISOString().slice(0, 16); // @nmn

  function getYearMonthDate(dateObj) {
    const year = dateObj.getFullYear();
    const month = dateObj.getMonth() + 1;
    const date = dateObj.getDate();
    return {
      year,
      month,
      date
    };
  }
  function hyphenatedDate(dateObj) {
    const {
      year,
      month,
      date
    } = getYearMonthDate(dateObj);
    return `${year}-${month < 10 ? '0' : ''}${month}-${date < 10 ? '0' : ''}${date}`;
  }

  //-----------------------------------------------------------------------------
  // Supporting GTD Reviews
  // by Jonathan Clark
  //-----------------------------------------------------------------------------
  //-----------------------------------------------------------------------------
  // User settings: TODO: move to proper preferences system, when available in NP
  const pref_metadataLineIndex = 1; //-----------------------------------------------------------------------------
  // Complete current review, then jump to the next one to review

  async function nextReview() {
    // First update @review(date) on current open note
    console.log('nextReview: stage 1');
    const openNote = await editorSetReviewDate();

    if (openNote == null) {
      return;
    } // Then update @review(date) in review list note


    console.log('nextReview: stage 2');
    await updateReviewListWithComplete(openNote); // Read review list to work out what's the next one to review

    console.log('nextReview: stage 3');
    const noteToReview = await getNextNoteToReview(); // Open that note in editor

    if (noteToReview != null) {
      console.log('nextReview: stage 4');
      Editor.openNoteByFilename(noteToReview.filename);
    } else {
      console.log('nextReview: 🎉 No more notes to review!');
      await showMessage('🎉 No more notes to review!');
    }
  } //-------------------------------------------------------------------------------
  // Complete current review, then jump to the next one to review

  async function updateReviewListWithComplete(note) {
    if (note == null || note.type === 'Calendar') {
      console.log('completeReviewUpdateList: error: called with null or Calendar note type');
    }

    console.log(`completeReviewUpdateList for '${note.title ?? ''}'`); // TODO: does this need to be async?
  } //-------------------------------------------------------------------------------
  // Complete current review, then jump to the next one to review


  async function getNextNoteToReview() {
    console.log(`getNextNoteToReview`); // TODO: does this need to be async?
  } //-------------------------------------------------------------------------------
  // Update the @reviewed(date) in the note in the Editor to today's date

  async function editorSetReviewDate() {
    const reviewMentionString = '@reviewed';
    const RE_REVIEW_MENTION = `${reviewMentionString}\\(${RE_DATE}\\)`;
    const reviewedTodayString = `${reviewMentionString}(${hyphenatedDate(new Date())})`; // only proceed if we're in a valid Project note // TODO: Need a minimum length too?

    if (Editor.note == null || Editor.note.type === 'Calendar') {
      return undefined;
    }

    let metadataPara; // get list of @mentions

    const firstReviewedMention = Editor.note?.mentions.find(m => m.match(RE_REVIEW_MENTION));

    if (firstReviewedMention != null) {
      // find line in currently open note containing @reviewed() mention
      const firstMatch = firstReviewedMention; // which line is this in?

      for (const para of Editor.paragraphs) {
        if (para.content.match(RE_REVIEW_MENTION)) {
          metadataPara = para;
          console.log(`\tFound existing ${reviewMentionString}(date) in line ${para.lineIndex}`);
        }
      }

      if (metadataPara == null) {
        // What if Editor.paragraphs is an empty array?
        return null;
      }

      const metaPara = metadataPara; // replace with today's date

      const older = metaPara.content;
      const newer = older.replace(firstMatch, reviewedTodayString);
      metaPara.content = newer;
      console.log(`\tupdating para to '${newer}'`); // send update to Editor

      await Editor.updateParagraph(metaPara);
    } else {
      // no existing mention, so append to note's default metadata line
      console.log(`\tno matching ${reviewMentionString}(date) string found. Will append to line ${pref_metadataLineIndex}`);
      const metadataPara = Editor.note?.paragraphs[pref_metadataLineIndex];

      if (metadataPara == null) {
        return null;
      }

      const metaPara = metadataPara;
      metaPara.content += ` ${reviewedTodayString}`; // send update to Editor

      await Editor.updateParagraph(metaPara);
    } // return current note, to help next function


    return Editor.note;
  }

  //-----------------------------------------------------------------------------
  // User settings: TODO: move to proper preferences system, when available in NP
  const pref_noteTypeTags = '#project'; //,#area,#archive'
  const pref_folderToStore = 'Summaries'; //-----------------------------------------------------------------------------

  function findMatchingNotesSortedByName(tag, folder) {
    let projectNotesInFolder; // If folder given (not empty) then filter using it

    if (folder !== '') {
      projectNotesInFolder = DataStore.projectNotes.slice().filter(n => n.filename.startsWith(`${folder}/`));
    } else {
      projectNotesInFolder = DataStore.projectNotes.slice();
    } // Filter by tag


    const projectNotesWithTag = projectNotesInFolder.filter(n => n.hashtags.includes(tag)); // Sort alphabetically on note's title

    const projectNotesSortedByName = projectNotesWithTag.sort((first, second) => (first.title ?? '').localeCompare(second.title ?? ''));
    return projectNotesSortedByName;
  } // Return line summarising a project note's status:
  // - title
  // TODO:
  // - # open tasks
  // - time until due
  // - time until next review


  function noteStatus(note) {
    const titleAsLink = note.title !== undefined ? `[[${note.title}]]` : '(error)';
    return `- ${titleAsLink}`; // due ... last reviewed ...
  } //-------------------------------------------------------------------------------
  // Define 'Project' class to use in GTD.
  // Holds title, last reviewed date, due date, review interval, completion date,
  // number of closed, open & waiting for tasks
  // NOTE: class syntax is likely not supported in Safari 11.


  class Project {
    // Types for the class properties
    // reviewInterval
    constructor(note) {
      this.note = note;
      this.title = note.title;
      this.dueDate = undefined; // TODO

      this.reviewedDate = undefined; // TODO
      // this.reviewInterval = ''

      this.completedDate = undefined;
      this.openTasks = 0;
      this.completedTasks = 0;
      this.waitingTasks = 0;
    }

    timeUntilDue() {
      return 'temp'; // this.dueDate TODO
    }

    timeUntilReview() {
      return '3w'; // TODO
    }

    basicSummaryLine() {
      const titleAsLink = this.title !== undefined ? `[[${this.title ?? ''}]]` : '(error)';
      return `- ${titleAsLink}`;
    }

    detailedSummaryLine() {
      // Class properties must always be used with `this.`
      const titleAsLink = this.note.title !== undefined ? `[[${this.note.title ?? ''}]]` : '(error)';
      return `- ${titleAsLink}\t${this.timeUntilDue()}\t${this.timeUntilReview()}`; // etc.
    }

  } //-------------------------------------------------------------------------------
  // Main function to create a summary note for each tag of interest


  async function noteTypeSummaries() {
    console.log(`\ntesting class Project`);
    const note = Editor.note;

    if (!note) {
      return;
    }

    const p1 = new Project(note);
    console.log(p1.detailedSummaryLine());
    console.log(`\nnoteTypeSummaries`);
    const destination = 'note'; // or 'note' or 'show'

    const tags = pref_noteTypeTags.split(',');

    for (const tag of tags) {
      // Do the main work
      const outputArray = makeNoteTypeSummary(tag);
      const tagName = tag.slice(1);
      const noteTitle = `'${tagName}' notes summary`;
      outputArray.unshift(`# ${noteTitle}`); // add note title to start
      // Save or show the results

      switch (destination) {
        case 'note':
          {
            let note; // first see if this note has already been created
            // (look only in active notes, not Archive or Trash)

            const existingNotes = DataStore.projectNoteByTitle(noteTitle, true, false) ?? [];
            console.log(`\tfound ${existingNotes.length} existing summary notes for this period`);

            if (existingNotes.length > 0) {
              note = existingNotes[0]; // pick the first if more than one

              console.log(`\tfilename of first matching note: ${note.filename}`);
            } else {
              // make a new note for this
              let noteFilename = await DataStore.newNote(noteTitle, pref_folderToStore);
              console.log(`\tnewNote filename: ${String(noteFilename)}`);
              noteFilename = `${pref_folderToStore}/${String(noteFilename)}` ?? '(error)'; // NB: filename here = folder + filename

              note = await DataStore.projectNoteByFilename(noteFilename);
              console.log(`\twriting results to the new note '${noteFilename}'`);
            }

            if (note != null) {
              // This is a bug in flow. Creating a temporary const is a workaround.
              const n = note;
              n.content = outputArray.join('\n');
            } else {
              console.log("makeNoteTypeSummary: error: shouldn't get here -- no valid note to write to");
              return;
            }

            console.log(`\twritten results to note '${noteTitle}'`);
            break;
          }

        case 'log':
          {
            console.log(outputArray.join('\n'));
            break;
          }

        default:
          {
            const re = await CommandBar.showOptions(outputArray, // you had noteTag here. But that variable is not defined
            `Summary for ${String(tag)} notes.  (Select anything to copy)`);

            if (re !== null) {
              Clipboard.string = outputArray.join('\n');
            }

            break;
          }
      }
    }
  } //-------------------------------------------------------------------------------
  // Return summary of notes that contain a particular tag, for all
  // relevant folders

  function makeNoteTypeSummary(noteTag) {
    console.log(`\nmakeNoteTypeSummary for ${noteTag}`);
    let noteCount = 0;
    const outputArray = []; // if we want a summary broken down by folder, create list of folders
    // otherwise use a single folder

    const folderList = DataStore.folders ;
    console.log(`${folderList.length} folders`); // Iterate over the folders

    for (const folder of folderList) {
      const notes = findMatchingNotesSortedByName(noteTag, folder); // console.log(notes.length)

      if (notes.length > 0) {
        {
          outputArray.push(`### ${folder} (${notes.length} notes)`);
        } // iterate over this folder's notes


        for (const note of notes) {
          outputArray.push(noteStatus(note));
        }

        noteCount += notes.length;
      }

      notes.length;
    } // Add a summary/ies onto the start

    outputArray.unshift(`Total: ${noteCount} notes. (Last updated: ${nowShortDateTime})`);
    return outputArray;
  }

  exports.editorSetReviewDate = editorSetReviewDate;
  exports.getNextNoteToReview = getNextNoteToReview;
  exports.makeNoteTypeSummary = makeNoteTypeSummary;
  exports.nextReview = nextReview;
  exports.noteTypeSummaries = noteTypeSummaries;

  Object.defineProperty(exports, '__esModule', { value: true });

  return exports;

}({}));
Object.assign(globalThis, exports)
