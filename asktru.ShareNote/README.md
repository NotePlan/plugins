# Share Note

## Latest Updates

See [CHANGELOG](https://github.com/NotePlan/plugins/blob/main/asktru.ShareNote/CHANGELOG.md) for latest updates/changes to this plugin.

## About This Plugin 

This is aimed to be the improved version of "NotePlan Publish" built-in feature that allows you to share your notes to the web via a secret URL.

Main improvements are:

1. **Security out of the box**. You *always* set the password for your notes. This password is used to encrypt your note when it is being sent to the publish server. When anyone wants to view your shared content, he should also know the password to decrypt the note content. So the server has zero knowledge of your content and stores it encrypted. And you can be sure that no one will see your content unless they have a password.
2. **More flexibility in secure sharing**. You should be able to share your content to a specific list of people (by providing their emails). The backend then will send an email with personal secret link that only the receiver of that email will be able to open. You should also be able to easily limit the time that the note will be available via the secret link.
3. **Support for custom markup**. Tasks and checklists priorities via `!`, `!!` and `!!!`. Underline using `~`, strikethrough using `~~` and highlight using `::` are also supported. More to come (ideally full scope of the NotePlan themes, including custom markdown that is allowed in themes, should be supported).
4. **Recursive sharing**. The basic idea is to detect wiki-links in the note and check whether they are published with NotePlan Online. If they are, replace wiki-link with a NotePlan Online URL of the linked page (only in the published version of the note, keeping the original note content as it is). The next step would be to allow notes be published recursively with one command: if you reference some other note in your current note and choose to do recursive publishing, the plugin will publish "network of the notes" (interlinking them properly), not just the current note.

## Usage

After installing this plugin you should obtain your API key that the plugin will use for publishing the notes for you:

1. Visit https://sharednote.space/register and register an account for yourself (it does not matter whether you use your iCloud account email or any other email address).
2. Sign in to your account and visit https://sharednote.space/user/api-tokens
3. Create your first API token by giving it a name and pressing "Create". You will see your token. Copy it to the clipboard.
4. Open plugin settings in your NotePlan installation and paste your token into the "API key for managing your published notes".

You may also set a password for your published notes in the plugin settings dialog.

> Please be aware that when you *change* the password the notes that you've already shared before are not affected. This means that they will still be accessible using the old password. Only when you call `/publish` again will the note be uploaded with the new password.

If you do not want your viewers to enter the password every time they want to view the published note, you may check "Append the password to the URL" setting.

The plugin has only two commands:

- `/publish` to share your note securely (this command is also used to update the note that has already been shared via this plugin before)
- `/unpublish` to delete your published note from the server

As soon as the note is uploaded to the server, the plugin opens it for you in your default browser.

## Future Features Roadmap

- Check wiki-links in the shared note and replace them with shared URLs in the related notes, for the links to work correctly in the web version of the note
- Support recursive note sharing (publish current note and all the wiki-linked notes, including multiple levels of linkage)
- Limit access to the note content for specific list of emails or a specific email domain
- Support overriding the password from the plugin settings with a password specific to a current note
- Improvements on the backend: dashboard of your shared notes, sharing the notes within your team, displaying table of contents, filtering content by hashtag or mention, code blocks syntax highlighting, etc.
