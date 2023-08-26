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

This is best used with the Link Creator plugin, which can be used to create URLs to launch a variety of functions inside NotePlan.

Set your favorite commands by typing:

`/Set/Change Preset Action`

This will ask you for:

- the name you want to call it (this is the name that will show up in the CommandBar when you type "/")
- the URL or X-Callback that should be launched when someone selects the command

After that, the commands you create will be available as if they are any other plugin command, simply by typing `/foo` (for example).
