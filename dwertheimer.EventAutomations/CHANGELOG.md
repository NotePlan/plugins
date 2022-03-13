# dwertheimer.EventAutomations Changelog

## Changelog

[0.5.0] 2022-03-12
- add setting for appending link to task note

[0.4.7] 2022-02-18
- changed default timeblock line to "-" from "*"

[0.4.6] 2022-02-18
- fixing editor open bug

[0.4.5] 2022-02-04
- refactor calendar code under the hood + Eduard fixed some underlying migration code

[0.4.4] 2022-02-04
- add configuration migration

[0.4.3] 
- change config to make includeTasksWithText etc. not required

[0.4.2] 2022-01-02 @dwertheimer (in response to great feedback from @stacey)
- change default config to allow for timeblocks all day long (no workDay[Start/End]) sections]
- change preset to do the opposite (allow for workday)

[0.4.0] 2021-12-25 @dwertheimer
- Search today's note for items tagged as >today or >dated

[0.3.4] 2021-12-25 @dwertheimer
- Fixed include/exclude bug thanks to @stacey and @4nd3rs for helping me find it

[0.3.3] 2021-12-24 @dwertheimer
- Added tons of console.logging to help with debugging in NP

[0.3.0] 2021-12-24 @dwertheimer
- Fixed Catalina (and previous OS) date math inconsistency

[0.1.0] 2021-11-04 @dwertheimer
- Initial release
- "Create Note From Calendar Item" command (asks you for a template)
- "Create Note From Calendar Item w/QuickTemplate" command (uses a preset template you established in the _configuration file / quickNotes field)