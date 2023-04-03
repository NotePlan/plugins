# NotePlan Online Plugin

## Latest Updates

See [CHANGELOG](https://github.com/NotePlan/plugins/blob/main/asktru.NoteplanOnline/CHANGELOG.md) for latest updates/changes to this plugin.

## About This Plugin 

This is aimed to be the improved version of "NotePlan Publish" built-in feature that allows you to share your notes to the web via a secret URL.

Main improvements of `NotePlan Online` plugin over "NotePlan Publish" feature are:

1. **Security out of the box**. You *always* set the password for your notes in the plugin config. This password is used to encrypt your note when it is being sent to the publish server. When anyone wants to view your shared content, he should also know the password to decrypt the note content. So the server has zero knowledge of your content and stores it encrypted. And you can be sure that no one will see your content unless they have a password.
2. **Manual update & transparency**. When you publish your note, the URL is inserted into the note frontmatter, so you always know whether the note has been published or not. And the published content is not updated automatically as you edit the note, you can republish it using slash command or refresh link - so you always control what is being published.
3. **Support for custom markup**. Task priorities via `!`, `!!` and `!!!` are supported. Underline using `~`, strikethrough using `~~` and highlight using `::` are also supported. More to come.
4. **Recursive sharing**. *not yet implemented* The basic idea is to detect wiki-links in the note and check whether they are published with NotePlan Online. If they are, replace wiki-link with a NotePlan Online URL of the linked page (only in the published version of the note, keeping the original note content as it is). The next step would be to allow notes be published recursively: if you reference some other note in your current note and choose to do recursive publishing, the plugin will publish "network of the notes", not just the current note.

The backend for this plugin is open-source and can be examined here: https://gitlab.com/antony.sklyar/noteplan-online

## Future Features Roadmap

- (backend) Improvement in markdown display in various cases
- Detect published linked note and replace wiki-link with NP Online link in the published note (without touching the original note content)
- Support recursive note sharing (publish current note and all the wiki-linked notes)
- Limit access to the note content for specific list of emails or a specific email domain
- Support overriding the password from the plugin settings with a password specific to a current note
