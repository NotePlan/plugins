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

const staticTemplateFolder = '📋 Templates';

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
      [
        ['title:', note.title ?? 'Untitled'].join(' '),
        ['filename:', note.filename].join(' '),
        ['hashtags:', note.hashtags].join(' '),
        ['mentions:', note.mentions].join(' '),
        ['created:', note.createdDate].join(' '),
        ['changed:', note.changedDate].join(' '),
      ].join('\n\t'),
    );
  } else {
    console.log(
      [
        ['date:', note.date].join(' '),
        ['filename:', note.filename].join(' '),
        ['hashtags:', note.hashtags].join(' '),
        ['mentions:', note.mentions].join(' '),
      ].join('\n\t'),
    );
  }
}

async function selectFolder() {
  if (Editor.type == 'Notes') {
    // [String] list of options, placeholder text, callback function with selection
    const folder = await CommandBar.showOptions(
      DataStore.folders,
      "Select new folder for '" + (Editor.title ?? 'Untitled') + "'",
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
    return;
  }
  console.log(`move ${title} (filename = ${filename}) to ${selectedFolder}`);

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
  let currentFolder = '';
  const { content, filename } = Editor;

  if (content != null && filename != null) {
    const reArray = filename.match(/(.*)\/.*/);
    console.log(filename);
    console.log(reArray);
    currentFolder = reArray && reArray?.length > 0 ? reArray[1] : '';
  }

  console.log('\tCurrent folder: ' + currentFolder);

  // Get title for this note
  const title = await CommandBar.showInput(
    'Enter title of the new note',
    "Create a new note with title '%@'",
  );

  await createTemplateFolderIfNeeded();
  let templateText = await selectTemplateContent(true);
  console.log(templateText);
  if (templateText == null) {
    templateText = '';
  }

  if (title !== undefined && title != '') {
    // Create new note in the specific folder
    const filename = DataStore.newNote(
      title + '\n' + templateText,
      currentFolder,
    );
    if (filename == null) {
      return;
    }
    console.log(
      '\tCreated note with title: ' + title + '\tfilename: ' + filename,
    );
    await Editor.openNoteByFilename(filename);
  } else {
    console.log('\tError: undefined or empty title');
  }
}
globalThis.newNote = newNote;

//------------------------------------------------------------------
// Create new note in current folder, and optionally with currently selected text
// Also now offers to use one of a number of Templates
async function applyTemplate() {
  // The Editor object is not always open, so have to handle possible error here
  // If it isn't open, then just carry on; all it means is that there won't be a selection.

  // TODO: Reported to EM that this is a bit of a hack, and it would be good to be able to
  // test for Editor?.content or similar.
  // Something is now available, according to Discord.
  // try {
  //   console.log("\napplyTemplate for note " + Editor.filename)

  //   // If template(s) are defined, then ask which one to use, unless there's just one defined
  //   var templateText = ""
  //   if (pref_templateName.length == 1) {
  //     templateText = pref_templateText[0]
  //   } else if (pref_templateName.length > 1) {
  //     var names = pref_templateName
  //     var re = await CommandBar.showOptions(names, "Select template to use:")
  //     templateText = pref_templateText[re.index]
  //     console.log("\tTemplate name to use: " + pref_templateName[re.index])
  //   } else {
  //     throw "No templates configured."
  //   }

  //   // Insert template text after note's title (or at the top if a daily note)
  //   pos = (Editor.type == "Notes") ? 1 : 0
  //   Editor.note.insertParagraph(templateText, pos, "empty")
  // }
  // catch (err) {
  //   console.log("Error in applyTemplate: " + err)
  // }

  await createTemplateFolderIfNeeded();
  const content = await selectTemplateContent();

  if (content != null) {
    Editor.prependParagraph(content, 'empty');
  }
}
globalThis.applyTemplate = applyTemplate;

function templateFolder() {
  return DataStore.folders.filter((f) => f.includes(staticTemplateFolder))[0];
}

async function selectTemplateContent(shouldIncludeNone) {
  const folder = templateFolder();

  const templateNotes = DataStore.projectNotes.filter((n) =>
    n.filename.includes(folder),
  );
  let options = templateNotes.map((n) => n.title).filter(Boolean);
  if (shouldIncludeNone != null && shouldIncludeNone == true) {
    options = ['(none)', ...options];
  }

  let templateIndex = (
    await CommandBar.showOptions(options, 'Select a template:')
  ).index;

  if (shouldIncludeNone == true) {
    if (templateIndex == 0) {
      return null;
    }
    templateIndex -= 1; // We need to decrement the index because we need to fetch the note from the original array which has not the "none" option.
  }

  const templateNote = templateNotes[templateIndex];

  // Now cut out everything above "---" (second line), which is there so we can have a more meaningful title for the template note
  if (templateNote != null) {
    const lines = templateNote.paragraphs.map((para) => para.duplicate());

    if (lines.length > 0 && lines[1].content == '---') {
      lines.splice(1, 1);
      lines.splice(0, 1);
    }

    return lines.map((l) => l.rawContent).join('\n');
  } else {
    console.log('Failed to get the template note from the index');
  }
}

async function createTemplateFolderIfNeeded() {
  let folder = templateFolder();

  if (folder == null) {
    // No templates folder yet, create one with a sample template
    console.log('template folder not found');

    if (
      (
        await CommandBar.showOptions(
          [
            "✅ Create '" + staticTemplateFolder + "' with samples",
            '❌ Cancel',
          ],
          'No templates folder found.',
        )
      ).index == 1
    ) {
      return;
    }

    const subfolder = (
      await CommandBar.showOptions(
        DataStore.folders,
        'Select a location for the templates folder.',
      )
    ).value;
    folder = subfolder + '/' + staticTemplateFolder;

    // Now create a sample note in that folder, then we got the folder also created
    DataStore.newNote(
      'Daily Note Template\n---\n## Tasks\n\n## Media\n\n## Journal\n',
      folder,
    );
    DataStore.newNote(
      'Meeting Note Template\n---\n## Project X Meeting on [[date]] with @Y and @Z\n\n## Notes\n\n## Actions',
      folder,
    );

    await CommandBar.showInput(
      "Folder '" + staticTemplateFolder + "' created with samples.",
      'OK, choose a template',
    );
  }
}

//------------------------------------------------------------------
// Jumps the cursor to the heading of the current note that the user selects
// NB: need to update to allow this to work with sub-windows, when EM updates API
async function jumpToHeading() {
  const paras = Editor.paragraphs;
  // Extract list of headings
  // function isHeading(p) {
  //   return p.prefix.includes('#');
  // }
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
  const paras = Editor.note?.paragraphs ?? [];
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
    return;
  }
  const title = note.title ?? 'Untitled';
  console.log('setTitleFromYAML:\n\told title = ' + title);
  const lines = content.split('\n');
  let n = 0;
  let newTitle = '';
  while (n < lines.length) {
    if (lines[n].match(/^[Tt]itle:\s*.*/)) {
      const rer = lines[n].match(/^[Tt]itle:\s*(.*)/);
      if (rer) {
        newTitle = rer[1];
      }
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
  printNote(note);
}
globalThis.setTitleFromYAML = setTitleFromYAML;
