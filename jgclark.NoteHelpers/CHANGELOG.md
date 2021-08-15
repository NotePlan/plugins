# What's changed in 📙 Note Helpers plugin?

### v0.10.3, 16.8.2021
- update: now compiled for versions of macOS back to 10.13.0

### v0.10.2, 30.7.2021
- add: **/onw** command to open a user-selected note in a new window.

### v0.10.1, 8.7.2021
- add: **/index** command to make/update note link Indexes for one or more folders 

### v0.9.2, 7.7.2021
- add: **/jn** command to jump to a different note, and then user selected heading
- fix: 'undefined' error in /mn

<!--### v0.9.3, 15.6.2021 (@dwertheimer)
- change: moved **/nns** (which was temporarily here) to Filer and cleaned up here

### v0.9.0, 12.6.2021
- [add]: **/nns** command to add a new note from selection (and leave link to it in its place) (@dwertheimer)
-->

### v0.8.2, 7.6.2021
- change: remove **/it** and **/nn** in favour of updated versions in the 'nmn.Templates' plugin

### v0.8.1, 26.5.2021
- change: **/jh** now indents the different heading levels

### v0.8.0, 26.5.2021
- change: **/nn** now asks for the folder to create the new note in
- fix: the **/jd** command now works if the Done section has been folded
- remove preference variables no longer needed with the '📋 Templates' folder mechanism

### v0.7.2, 22.5.2021
- Updated applyTemplate() and newNote() so that they pick a template from a folder. This '📋 Templates' folder - along with sample templates - will be created if non-existing.

### v0.7.1, 15.5.2021
- change to using two-letter command names, to match new style agreed with EM

### v0.7.0, 14.5.2021
- move the **show statistics** command to a separate statistics plugin
- add option to copy to clipboard statistics summary

### v0.6.1, 14.5.2021
- add the **jump to Done** command
- add option to copy to clipboard statistics summary

### v0.5.0, 8.5.2021
- include the example plugin **move Note** command to this plugin

### v0.4.0, 7.5.2021
- added multiple templates to **newNote**
- added **applyTemplate** command

### v0.3.2
- show statistics output on the command bar as well
 
### 0.3.0
- added **statistics**: for now this only writes to the console log (open from the Help menu)
 
### v0.2.0
- added **newNote**
