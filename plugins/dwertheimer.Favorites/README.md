# Favorites Plugin

## A temporary substitute for "pinned notes"

Somewhere on the Noteplan roadmap is (hopefully) the concept of pinned notes (see [Canny](https://noteplan.canny.io/general-feature-request/p/favorite-notesfolders-and-pinning-notes-to-the-top-of-the-list)). In the meantime, I thought I would create a poor man's substitute -- inspired by @stacey's idea of having an evergreen "Research This" note, which I wanted to have easy access to.

## Using the Favorites ⭐️ Plugin

## Setting Favorite Documents for easy access

1. At the beginning, no items are in the Favorites list
2. Open up any document in the Editor
2. Run the `/fave` plugin to set the current document as a "Favorite"
3. [This adds a ⭐️ to the title, which indicates this file is a "Favorite"]
4. Now run the `/faves` command and you will see your favorites.
5. Choosing a favorite opens it in the Editor
6. Use the `/unfave`  command to remove the ⭐️ (or you can do it by hand)!

## Setting Favorite Commands (X-Callbacks and URLs)

You can also set up to 20 commands that can be called directly from the Command Bar to launch an X-Callback or a URL. If there are X-Callback commands you use frequently and want to have quick access to, this is a good way to get access to them by just typing `/<command name>`.

You can use this functionality for quick access to:

- Your favorite plugin commands with names you choose in a list of favorite commands you can glance at
- Open a specific document
- Open to a heading or line inside a document
- Inserting a particular template you use frequently with one command at your fingertips
- Opening some website/page you frequently use when you are inside noteplan

Favorite commands functionality is best used with the Link Creator plugin, which can be used to create URLs to launch a variety of functions inside NotePlan.

Set your favorite commands by typing:

`/Set/Change/Rename Preset Action`

This will ask you for:

- the name you want to call it (this is the name that will show up in the CommandBar when you type "/")
- the URL or X-Callback that should be launched when someone selects the command (you will be asked whether you know the URL or you want the wizard to guide you through creating it)

After that, the commands you create will be available as if they are any other plugin command, simply by typing `/foo` (for example).

## Examples

1. Create a command to insert a template (e.g. insert project metadata):

a) create a template, e.g.:

```
---
title: Project Metadata Snippet
type: snippet 
---
#project @start(<%- promptDate('startDate', 'Enter start date') %>) @due(<%- promptDate('dueDate', 'Enter due date - or enter') %>) @review(<%- promptDateInterval('question', 'Enter review interval') %>)

```

b) And then use this plugin to `/Set/Change/Rename Preset Action`:
- Use Link Creator to create a link (Run a plugin command + `np:insert`)
- Pass the title of the template as the first argument/parameter: "Project Metadata Snippet"

***Then insertion of this project metadata will always be just a few keystrokes away.***

2. Use it to create functionality in NotePlan that is missing for your workflow. For me, it's creating a new note in a folder of my choosing without opening the sidebar. To do this:

a) Create a Quick-note template, e.g.:

```
---
title: New Blank Note in (Choose Folder) - qtn version
type: quick-note 
folder: <select>
---
```

b) And then use this plugin to `/Set/Change/Rename Preset Action`:
- Use Link Creator to create a link (Run a plugin command + `np:qtn`)
- Pass the title of the template as the first argument/parameter: "New Blank Note in (Choose Folder) - qtn version"

***Then a few keystrokes will create a new document in a folder of your choosing***

3. Or combine the two ideas to create a new project note in a flash:


```
---
title: New Project note (qtn version)
type: quick-note
folder: <select>
---
#project @start(<%- promptDate('startDate', 'Enter start date') %>) @due(<%- promptDate('dueDate', 'Enter due date - or enter') %>) @review(<%- promptDateInterval('question', 'Enter review interval') %>)
```

b) And then use this plugin to `/Set/Change/Rename Preset Action`:
- Use Link Creator to create a link (Run a plugin command + `np:qtn`)
- Pass the title of the template as the first argument/parameter: "New Project note (qtn version)"

***Then a few keystrokes will create a new project note in a folder of your choosing***


### let us know of other examples you have and use!

## Settings

### Setting: "Characters to Prepend to Command"

If there are characters like “-⭐️” in front of each command, it will keep them together and float them to the top of the menu. So when you open the command bar and type the leading character (e.g. "-"), you will see all the favorite commands at a glance.  Whatever text you put here will be prepended to any command name you set. Blank this field out to not prepend any characters, and the command name will be exactly the text you enter. Thx @clayrussell for this idea!
