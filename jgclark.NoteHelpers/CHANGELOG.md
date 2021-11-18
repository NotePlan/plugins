# What's changed in 📙 Note Helpers plugin?

## [0.10.6] - 2021-11-17
### Changed
- updated the 'jumping' commands /jh and /jd work better with API change

## [0.10.5] - 2021-10-24
### Changed
- now 'move' or 'jump' to daily notes, not just project notes

## [0.10.0..0.10.4] - 2021-08-31
### Added
- added **/onw** command to open a user-selected note in a new window.
- added **/index** command to make/update note link Indexes for one or more folders 

### Changed
- now allows notes to be moved to the special @Archive directory (requested by @brokosz)
- now compiled for versions of macOS back to 10.13.0

## [0.9.0..0.9.3] - 2021-07-07
### Added
- added **/jn** command to jump to a different note, and then user selected heading

### Changed
- moved **/nns** (which was temporarily here) to Filer and cleaned up here

### Fixed
- fix: 'undefined' error in /mn

## [0.8.0..0.8.2] - 2021-06-07
### Changed
- change: remove **/it** and **/nn** in favour of updated versions in the 'nmn.Templates' plugin
- change: **/jh** now indents the different heading levels
- change: **/nn** now asks for the folder to create the new note in
- remove preference variables no longer needed with the '📋 Templates' folder mechanism

### Fixed
- fix: the **/jd** command now works if the Done section has been folded

## [0.7.0..0.7.2] - 2021-05-22
- Updated applyTemplate() and newNote() so that they pick a template from a folder. This '📋 Templates' folder - along with sample templates - will be created if non-existing.
- change to using two-letter command names, to match new style agreed with EM
- move the **show statistics** command to a separate statistics plugin
- add option to copy to clipboard statistics summary

## [0.6.1] - 2021-05-14
### Added
- add the **jump to Done** command
- add option to copy to clipboard statistics summary

## [0.5.0] - 2021-05-08
### Added
- moved the example plugin **move Note** command to this plugin

## [0.4.0] - 2021-05-07
### Added
- added multiple templates to **newNote**
- added **applyTemplate** command

## [0.3.0..0.3.2]
### Added
- show statistics output on the command bar as well
- added **statistics**: for now this only writes to the console log (open from the Help menu)
 
## [0.2.0]
- added **newNote** command
