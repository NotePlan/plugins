// @flow
//--------------------------------------------------------------------------------------------------------------------
// Note Helpers plugin for NotePlan
// Jonathan Clark
// v0.8.0, 26.5.2021
//--------------------------------------------------------------------------------------------------------------------

// Globals
// eslint-disable-next-line no-unused-vars
const todaysDate = new Date().toISOString().slice(0, 10);
// eslint-disable-next-line no-unused-vars
const defaultTodoMarker =
  DataStore.preference('defaultTodoCharacter') !== undefined
    ? DataStore.preference('defaultTodoCharacter')
    : '*';
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
    console.log("\tWarning: I can't move calendar notes.");
    CommandBar.hide();
  }
}
globalThis.selectFolder = selectFolder;

function templateFolder() {
  return DataStore.folders.find((f) => f.includes(staticTemplateFolder));
}

async function selectTemplateContent(shouldIncludeNone = false) {
  const folder = templateFolder();
  if (folder == null) {
    // template folder not found
    return;
  }

  const templateNotes = DataStore.projectNotes.filter((n) =>
    n.filename.includes(folder),
  );
  const options = templateNotes.map((n) => n.title ?? 'Untitled');
  if (shouldIncludeNone) {
    options.splice(0, 0, '(none)');
  }

  let templateIndex = (
    await CommandBar.showOptions(options, 'Select a template:')
  ).index;

  if (shouldIncludeNone) {
    if (templateIndex == 0) {
      return null;
    }
    templateIndex -= 1; // We need to decrement the index because we need to fetch the note from the original array which has not the "none" option.
  }

  const templateNote = templateNotes[templateIndex];

  // Now cut out everything above "---" (second line), which is there so we can have a more meaningful title for the template note
  if (templateNote != null) {
    const lines = [...templateNote.paragraphs];

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
// Command from Eduard to move a note to a different folder
function moveNote(selectedFolder) {
  const { title, filename } = Editor;
  if (title == null || filename == null) {
    // No note open, so don't do anything.
    console.log('moveNote: warning: No note open.');
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
  console.log('\nnewNote:');
  const sel = '';
  let currentFolder = '';

  // Get title for this note
  const title = await CommandBar.showInput(
    'Enter title of the new note',
    "Create a new note with title '%@'",
  );

  // If template(s) are defined, then ask which one to use, unless there is only one
  await createTemplateFolderIfNeeded();
  let templateText = await selectTemplateContent(true);
  if (templateText == null) {
    templateText = '';
  }
  console.log('Template text: ' + templateText);

  // let templateText = '';
  // if (pref_templateName.length == 1) {
  //   templateText = pref_templateText[0];
  // } else if (pref_templateName.length > 1) {
  //   const defaultNone = ['(None)'];
  //   const names = defaultNone.concat(pref_templateName);
  //   const re = await CommandBar.showOptions(names, 'Select template to use:');
  //   if (re.index != 0) {
  //     templateText = pref_templateText[re.index - 1];
  //     console.log(
  //       "Template name to use: '" + pref_templateName[re.index - 1],
  //     );
  //   }
  // }

  // Eduard's template-folder-and-files version of the above:
  const folders = DataStore.folders; // excludes Trash and Archive
  if (folders.length > 0) {
    const re = await CommandBar.showOptions(
      folders,
      'Select folder to add note in:',
    );
    currentFolder = folders[re.index];
  } else {
    // no Folders so go to root
    currentFolder = '/';
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
globalThis.newNote = newNote;

//------------------------------------------------------------------
// Apply template to the current note
// TODO: Change to using a Template/*.md directory to source templates from
async function applyTemplate() {
  // const { filename } = Editor;
  // if (filename == null) {
  //   // No note open, so nothing to do.
  //   console.log('applyTemplate: warning: No note open.');
  //   return;
  // }
  // console.log('\napplyTemplate for note ' + filename);

  // // If template(s) are defined, then ask which one to use, unless there's just one defined
  // let templateText = '';
  // if (pref_templateName.length == 1) {
  //   templateText = pref_templateText[0];
  // } else if (pref_templateName.length > 1) {
  //   const names = pref_templateName;
  //   const re = await CommandBar.showOptions(names, 'Select template to use:');
  //   templateText = pref_templateText[re.index];
  //   console.log('\tTemplate name to use: ' + pref_templateName[re.index]);
  // } else {
  //   throw 'applyTemplate: error: No templates configured.';
  // }

  // // Insert template text after note's title (or at the top if a daily note)
  // const pos = Editor.type == 'Notes' ? 1 : 0;
  // Editor.insertParagraph(templateText, pos, 'empty');

  // Eduard's template-folder-and-files version of the above:
  await createTemplateFolderIfNeeded();
  const content = await selectTemplateContent();

  if (content != null) {
    Editor.prependParagraph(content, 'empty');
  }
}
globalThis.applyTemplate = applyTemplate;

//------------------------------------------------------------------
// Jumps the cursor to the heading of the current note that the user selects
// NB: need to update to allow this to work with sub-windows, when EM updates API
async function jumpToHeading() {
  const paras = Editor?.paragraphs;
  if (paras == null) {
    // No note open
    return;
  }

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
  const paras = Editor?.paragraphs;
  if (paras == null) {
    // No note open
    return;
  }
  const paraCount = paras.length;

  // Find the line of interest from all the paragraphs
  for (let i = 0; i < paraCount; i++) {
    const p = paras[i];
    if (
      (p.content == 'Done' || p.content == 'Done …') &&
      p.headingLevel === 2
    ) {
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
