// @flow
//--------------------------------------------------------------------------------------------------------------------
// Note Helpers plugin for NotePlan
// Jonathan Clark
// v0.7.1, 16.5.2021
//--------------------------------------------------------------------------------------------------------------------

// Globals
// eslint-disable-next-line no-unused-vars
const todaysDate = new Date().toISOString().slice(0, 10);
// eslint-disable-next-line no-unused-vars
const defaultTodoMarker =
  DataStore.preference('defaultTodoCharacter') !== undefined
    ? DataStore.preference('defaultTodoCharacter')
    : '*';
const pref_templateName = [];
const pref_templateText = [];

// Items that should come from the Preference framework in time:
pref_templateName.push('Daily note structure');
pref_templateText.push('### Tasks\n\n### Media\n\n### Journal\n');
pref_templateName.push('Project Meeting note');
pref_templateText.push(
  '### Project X Meeting on [[date]] with @Y and @Z\n\n### Notes\n\n### Actions\n',
);

//------------------------------------------------------------------
// Helper functions
//------------------------------------------------------------------
function printNote(note) {
  if (note == undefined) {
    console.log('Note not found!');
    return;
  }

  if (note.type == 'Notes') {
    console.log(
      'title: ' +
        (note.title ?? '') +
        '\n\tfilename: ' +
        (note.filename ?? '') +
        '\n\thashtags: ' +
        (note.hashtags?.join(',') ?? '') +
        '\n\tmentions: ' +
        (note.mentions?.join(',') ?? '') +
        '\n\tcreated: ' +
        (String(note.createdDate) ?? '') +
        '\n\tchanged: ' +
        (String(note.changedDate) ?? ''),
    );
  } else {
    console.log(
      'date: ' +
        (String(note.createdDate) ?? '') +
        '\n\tfilename: ' +
        (note.filename ?? '') +
        '\n\thashtags: ' +
        (note.hashtags?.join(',') ?? '') +
        '\n\tmentions: ' +
        (note.mentions?.join(',') ?? ''),
    );
  }
}

async function selectFolder() {
  if (Editor.type == 'Notes') {
    // [String] list of options, placeholder text, callback function with selection
    const folder = await CommandBar.showOptions(
      DataStore.folders,
      "Select new folder for '" + (Editor.title ?? '') + "'",
    );
    moveNote(folder.value);
  } else {
    console.log("\t can't move calendar notes.");
    CommandBar.hide();
  }
}
globalThis.selectFolder = selectFolder;

//------------------------------------------------------------------
// Command from Eduard to move a note to a different folder
function moveNote(selectedFolder) {
  const { title, filename } = Editor;
  if (title == null || filename == null) {
    console.log('No note open.');
    return;
  }
  console.log(
    'move ' +
      title +
      " (filename = '" +
      filename +
      "')" +
      ' to ' +
      selectedFolder,
  );
  const newFilename = DataStore.moveNote(filename, selectedFolder);

  if (newFilename != undefined) {
    Editor.openNoteByFilename(newFilename);
    console.log('\tmoving note was successful');
  } else {
    console.log('\tmoving note was NOT successful');
  }
}

//------------------------------------------------------------------
// Create new note in current folder, and optionally with currently selected text
// Also now offers to use one of a number of Templates
async function newNote() {
  const { filename, selectedText } = Editor;
  if (filename == null) {
    return;
  }
  console.log('\nnewNote:');
  let sel = '';
  let currentFolder = '';
  // The Editor object is not always open, so have to handle possible error here
  // If it isn't open, then just carry on; all it means is that there won't be a selection.
  // TODO: Reported to EM that this is a bit of a hack, and it would be good to be able to
  // test for Editor?.content or similar.
  try {
    sel = selectedText ?? '';
    // console.log("\tCurrent cursor position: " + sel.start + " for " + sel.length + " chars")
    console.log('\tSelected text: ' + sel);
    // Work out current folder name
    // NB: Handily, if we're in a daily note, then the currentFolder is empty
    const reArray = filename.match(/(.*)\/.*/);
    currentFolder = reArray !== undefined ? reArray?.[1] ?? '' : '';
  } catch (err) {
    sel = ''; // shouldn't be needed, but seems to be
  } finally {
    console.log('\tCurrent folder: ' + currentFolder);

    // Get title for this note
    const title = await CommandBar.showInput(
      'Enter title of the new note',
      "Create a new note with title '%@'",
    );

    // If template(s) are defined, then ask which one to use, unless there is only one
    let templateText = '';
    if (pref_templateName.length == 1) {
      templateText = pref_templateText[0];
    } else if (pref_templateName.length > 1) {
      const defaultNone = ['(None)'];
      const names = defaultNone.concat(pref_templateName);
      const re = await CommandBar.showOptions(names, 'Select template to use:');
      if (re.index != 0) {
        templateText = pref_templateText[re.index - 1];
        console.log(
          "Template name to use: '" + pref_templateName[re.index - 1],
        );
      }
    }

    if (title !== undefined && title != '') {
      // Create new note in the specific folder
      const filename = DataStore.newNote(title, currentFolder) ?? '';
      console.log(
        '\tCreated note with title: ' + title + '\tfilename: ' + filename,
      );
      // Add template text (if selected) then the previous selection (if present)
      await Editor.openNoteByFilename(filename);
      Editor.content = '# ' + title + '\n' + templateText + sel;
    } else {
      console.log('\tError: undefined or empty title');
    }
  }
}
globalThis.newNote = newNote;

//------------------------------------------------------------------
// Create new note in current folder, and optionally with currently selected text
// Also now offers to use one of a number of Templates
async function applyTemplate() {
  const { filename } = Editor;
  if (filename == null) {
    // No note open.
    return;
  }
  // The Editor object is not always open, so have to handle possible error here
  // If it isn't open, then just carry on; all it means is that there won't be a selection.

  // TODO: Reported to EM that this is a bit of a hack, and it would be good to be able to
  // test for Editor?.content or similar.
  // Something is now available, according to Discord.
  try {
    console.log('\napplyTemplate for note ' + filename);

    // If template(s) are defined, then ask which one to use, unless there's just one defined
    let templateText = '';
    if (pref_templateName.length == 1) {
      templateText = pref_templateText[0];
    } else if (pref_templateName.length > 1) {
      const names = pref_templateName;
      const re = await CommandBar.showOptions(names, 'Select template to use:');
      templateText = pref_templateText[re.index];
      console.log('\tTemplate name to use: ' + pref_templateName[re.index]);
    } else {
      throw 'No templates configured.';
    }

    // Insert template text after note's title (or at the top if a daily note)
    const pos = Editor.type == 'Notes' ? 1 : 0;
    Editor.insertParagraph(templateText, pos, 'empty');
  } catch (err) {
    console.log('Error in applyTemplate: ' + err);
  }
}
globalThis.applyTemplate = applyTemplate;

//------------------------------------------------------------------
// Jumps the cursor to the heading of the current note that the user selects
// NB: need to update to allow this to work with sub-windows, when EM updates API
async function jumpToHeading() {
  const paras = Editor.paragraphs;

  const headingParas = paras.filter((p) => p.type === 'title'); // = all headings, not just the top 'title'
  const headingValues = headingParas.map((p) => p.content);

  // Present list of headingValues for user to choose from
  if (headingValues.length > 0) {
    const re = await CommandBar.showOptions(
      headingValues,
      'Select heading to jump to:',
    );
    Editor.highlight(headingParas[re.index]);
  } else {
    console.log('Warning: No headings found in this note');
  }
}
globalThis.jumpToHeading = jumpToHeading;

//------------------------------------------------------------------
// Jump cursor to the '## Done' heading in the current file
// NB: need to update to allow this to work with sub-windows, when EM updates API
function jumpToDone() {
  const paras = Editor?.note?.paragraphs;
  if (paras == null) {
    // No note open
    return;
  }
  const paraCount = paras.length;

  // Find the line of interest from all the paragraphs
  for (let i = 0; i < paraCount; i++) {
    const p = paras[i];
    console.log(i + ': ' + p.content + ' / ' + p.headingLevel);
    if (p.content == 'Done' && p.headingLevel === 2) {
      // jump cursor to that paragraph
      Editor.highlight(p);
      break;
    }
  }
  console.log("Warning: Couldn't find a ## Done section");
}
globalThis.jumpToDone = jumpToDone;

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
  const { note, content } = Editor;
  if (note == null || content == null) {
    // no note open.
    return;
  }
  console.log('setTitleFromYAML:\n\told title = ' + (note.title ?? ''));
  const lines = content.split('\n');
  let n = 0;
  let newTitle = '';
  while (n < lines.length) {
    if (lines[n].match(/^[Tt]itle:\s*.*/)) {
      const rer = lines[n].match(/^[Tt]itle:\s*(.*)/);
      newTitle = rer?.[1] ?? '';
    }
    if (lines[n] == '' || lines[n] == '...') {
      break;
    }
    n += 1;
  }
  console.log('\tnew title = ' + newTitle);
  if (newTitle != '') {
    note.title = newTitle; // TODO: setter not available not yet available (last checked on release 628)
  }
  printNote(Editor.note);
}
globalThis.setTitleFromYAML = setTitleFromYAML;
