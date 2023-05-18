# shared.AI (NotePlan AI) Changelog

See Plugin [README](https://github.com/NotePlan/plugins/blob/main/shared.AI/README.md) for details on available commands and use case.

## What's Changed?

## [0.8.0] - 2023-05-16 (@dwertheimer)

- Adding GPT-4 model choice1 

## [0.7.0-beta1] - 2023-03-31 (@dwertheimer)

- Add getChat command for using in templates
- Add retrying to network requests since chatGPT API fails so often
- Fix bug in create chat in new note
- Fix bug in continue chat in new note

## [0.6.0] - 2023-03-17 (@dwertheimer)

- Add date to calendar day summary so ChatGPT knows what this day 
- Simplify plugin preferences on iOS call (removed settings.js file)

## [0.5.0] - 2023-03-16 (@dwertheimer)

- add iOS settings editing v1 (for my mom)

## [0.4.3] - 2023-03-10 (@dwertheimer)

- Added summarize note/selection command and the start of some localizations.

[0.3.2] - 2023-01-07 (@shadowfigure)

#### **Added**
- Adding jsdoc data to several functions


#### **Changed**


#### **Fixed**


#### **Known Issues**

[0.3.2] - 2023-01-11 (@dwertheimer)

#### **Fixed**
- Fixed token count not being saved properly
- Consolidated all writing and reading of JSONs into one function each for clarity/consistency

[0.3.1] - 2023-01-06 (@shadowfigure)

#### **Added**
- Reworking the onboarding process for the plugin.
- onboarding.js
  - Handles the logic of setting up the plugin.
- onboardingText.js
  - Contains all of the prompt and page text data to be used by onboarding.js
- Both are a work in progress.

#### **Known Issues**
- Need to add escapes for each prompt of the onboarding process as well as a means to track progress/completion.

[0.3.0] - 2023-01-04 (@shadowfigure)

#### **Added**
- settingsAdjustments.js
  - changeDefaultMaxTokens
  - changeTargetSummaryParagraphs
  - changeDefaultTargetKeyTerms
  - setOpenAIAPIKey

[0.2.9] - 2023-01-03 (@shadowfigure)

#### **Added**
- **/Show NoteAI Commands**
  - Reveals a list of non-hidden NoteAI commands that can be launched directly from the list.

- Started implementation of adding the ability to track total token usage for each research tree. Pending resolution from NotePlan Json saving function.


[0.2.8] - 2023-01-03 (@shadowfigure)

#### **Changed**
- Moved a number of functions from BulletsAI_Main and NPAI to their own files to help with organization.
  - networking.js (for functions that primarily deal with API calls)
  - externalFileInteractions.js (for functions that deal primarily with loading and saving JSON)
  - non-implemented_functions.js (for the numerous functions that are not quite ready/necessary and still in progress.)

#### **Known Issues**
- After moving to a new directory, the final link in the subtitles that utilize the full history do not format properly and thus do not link back to the related heading.

[0.2.7] - 2023-01-02 (@dwertheimer)

### **Tweak**
- Tweaked the move function to move note to a folder (you can now choose from a list of existing folders or create one)

[0.2.6] - 2022-12-30 (@shadowfigure)

#### **Added**
- checkModel function added to remove ~50 lines of repeated code.
- moveNoteToResearchCollection functionality added
  - Moves the current note to a subdirectory inside the Research folder.
  - Creates top level Table of Contents for folder.

#### **Known Issues**
- Using the moveNoteToResearchCollection function currently breaks backlinks inside of subtitles. Currently working on a fix.

[0.2.5] - 2022-12-29 (@shadowfigure)

#### **Changed**
- Moved the createAIImages function to its own file imageAI.js


#### **Known Issues**
- Not properly calling the function that gathers both the prompt and the n amount for the number of images.

[0.2.4] - 2022-12-28 (@shadowfigure)

#### **Added**
- createOuterLink function formats the currently selected text to become an x-callback url link to a matching note.

#### **Changed**
- If text is selected, calling the /dig command will auto-populate the input prompt with the selected text. If 'Enter' is pressed without typing anything else, the selected text will generate a new research page and the selected text will become a link to it.


[0.2.3] - 2022-12-23 (@shadowfigure)

#### **Added**
- Added researchFromSelection which will take the highlighted text and continue the research within the context of the heading it was under.
  - Simply highlight any text inside of the summary and use "/rs" or "/researchFromSelection"

#### **Known Issues**
  - researchFromSelection *may* misattribute the heading that the selection belongs to.

[0.2.2] - 2022-12-23 (@dwertheimer)

#### **Added**
- Made Table of Contents heading clickable to toggle folding
- in scrollToEntry: toggleFolding can now be true|false|toggle

[0.2.1] - 2022-12-22 (@dwertheimer)

#### **Fixed**
- Table of Contents now goes to top of page
- Stop execution when remix text is blank
- Cleaned up some JS/Flow issues

[0.2] - 2022-12-21 (@shadowfigure)

#### **Added**


#### **Changed**


#### **Fixed**
- @dwertheimer fixed JSON updating issue.
- Bullets now properly format to change to x-callback urls once they have been used.
- Table of Contents heading is no longer duplicating.
- Removed (or changed) all of the unnecessary logError calls.

#### **Known Issues**
- Table of Contents is showing at the bottom of the page instead of the top. Probably an easy fix.


[0.1.99] - 2022-12-19 (@shadowfigure)


#### **Changed**
- createResearchDigSite now accepts incoming prompts

#### **Fixed**
- Fixed Alfred connection

[0.1.99] - 2022-12-20 (@dwertheimer)
- Moved DataStore.settings calls inside functions (no more calling globally)
- Finished JSON data storage link-clicking functions
- Wrote basic tests for the pure JS part of that function
- Added Flow types file in support folder

[0.1.98] - 2022-12-19 (@shadowfigure)

#### **Added**
- generateKeyTermsPrompt now accepts an array of strings to use as an exclusions list. Will be utilized soon.
- scrollToHeading now implemented to automatically scroll to the newest generated summary.
- Table of Contents now generates automatically.


#### **Changed**
- Removed the AI-Tools directory and changed the BulletsAI's output to the Research directory.


#### **Fixed**
- Key Terms generator should now return better contextual results.


#### **Known Issues**
- The Table of Content heading is duplicated with each regeneration. Will identify issue and resolve ASAP.


[0.1.97] - 2022-12-18 (@shadowfigure)

#### **Added**
- Explore function implemented in initial stages.
  - Similar to the idea of the previous Remix function (which may still return)
  - Will ask for heading (currently disabled) and for a search prompt.
  - Runs the summary generator with your prompt and specifies that it is in the context of whatever subject you clicked Explore on.

- Will update with a better solution for the heading as soon as possible.


[0.1.96] - 2022-12-18 (@shadowfigure)

#### **Added**
- RemoveEntry function added to remove the section under the current heading.

[0.1.95] - 2022-12-18 (@shadowfigure)

#### **Added**
- prompts.js file now holds all prompt generation functions.
- formatters.js now holds all formatting related functions.

#### **Changed**
- Removed tons of redundant code from BulletsAI-Main.js and NPAI.js
- Cleaned up the helpers.js file by moving functions into more appropriately handled files.

#### **Fixed**
- Fixed the circular dependency between BulletsAI-Main and NPAI

#### **Known Issues**


[0.1.94] - 2022-12-16 (@shadowfigure)

#### **Added**
- added Heat Transfer to the mock fetch list.
- In the Go Deeper section, there is now a [+] (that will probably be adjusted soon for usability).
  - Clicking this will create a new prompt by appending the selection to the full history of followed links.
    - For example, If you had started at 'Mercury', then clicked 'Thermal Protection' and then clicked the [+] next to 'Heat Transfer in the Go Further section under 'Thermal Protection', the following prompt would be be fed back into the summary generator:
      - 'Heat Transfer in the context of Thermal Protection in the context of Mercury.'
- Foundations of the data saving and parsing system in place.


#### **Fixed**
- Links in the Go Further section now behave as expected.

#### **Known Issues**
- Remix button is not currently functional. Has been temporarily removed.
- Back links are not always generated when clicking on links in Go Further section.
- Some minor formatting quirks.

[0.1.93] - 2022-12-15 (@shadowfigure)

#### **Added**
- @dwertheimer was kind of enough to write up a mock fetch request for me so I can stop flinging money at the wall with every test request. 

#### **Changed**
- Continuing to rework the BulletsAI so that future generations can have any hope of understanding it.

#### **Fixed**
- /dig command once again generates a new note and begins research properly.

#### **Known Issues**
- Remix currently does not work.
- Clicking the links does work, but does not properly contextualize the request.
- Not showing which links clicked.
- Not showing subtitle.
- JSON not saving properly.
- Hopefully have these things all addressed tomorrow.


[0.1.92] - 2022-12-14 (@shadowfigure)

#### **Fixed**
- Remixes should now generate the proper subtitle text

#### **Known Issues**
- Subtitle text is not properly creating backlinks.
- At first generation, the Title of the page is altered and turned into a backlink.
- Inconsistency with the generation of back links for existing "Go Further" bullets.
- The Go Further section doesn't seem to be reading the full context information.


[0.1.91] - 2022-12-13 (@shadowfigure)

#### **Added**
- Added AI - Tools folder
  - Can be set in the preferences
- Added createResearchDigSite function that prompts user for their initial search query.
  - Then creates a titled page in the AI - Tools folder
  - Runs the bulletsAI with their query.

#### **Known Issues** 
- Currently, the Remix button does not output the prompt properly on the other side of the request. It does, however, execute the prompt properly behind the scenes. This is a visual bug and is annoying me enough to fix it soon.


[0.1.9] - 2022-12-13 (@shadowfigure)

#### **Changed**
- When selecting one of the Go Further links, it will automatically generate a contextual prompt that will help to keep the resulting summaries related to the original subject matter. This is effectively creating a remix with the prompt "{New Query} in the context of {Previous Query}." These will stack.

- The remix prompt that is displayed under the section title has been reworked and will now contain backlinks to all previously created summaries.

#### **Known Issues**
- Learn more link sometimes has formatting issues and will occasionally link to non-existent pages.
- During generation, the new Go Further section will not automatically scan for existing backlinks. This is resolved at next generation cycle.
- Show Stats is still not functioning in BulletsAI. Please turn it off to use this feature.

#### **Todo**
- Go Further link refinement.
  - Would like each link to check to see if there is already a matching title or bullet so that it can regenerate that topic for a fresh one.
  - Button to 'rebase' the remixes for when they grow to be too large too be useful. 
    - Takes the new term and appends it only to the original source term for next regeneration.

[0.1.8] - 2022-12-13 (@shadowfigure)

#### **Added**
- bulletsSummaryParagraph parameter added to preferences.
  - Allows user to define how long summaries in BulletAI should be.

#### **Changed**
- Changed the work "term" to "topic" in formatBulletKeyTerms() as the word "term" was causing the related subjects to always be single word results.
- formatBulletSummary() no longer appends the extra empty bullet point as it has been made redundant by the Remix feature.



[0.1.7] - 2022-12-13 (@shadowfigure)

#### **Added**
- Remix functionality added to bulletsAI.
  - Allows user to type in a more specific prompt to regenerate a new summary.
  - Remix is displayed under the initial subject so that the user can know precisely what the context was.

- Fixed
  - Now checks all bullet points to see if they match any of the newly linked ones and updates them to also hold the link. This also fixed a problem with duplicating the prompt print outs.


[0.1.6] - 2022-12-12 (@shadowfigure)

#### **Added**
- bulletsAIKeyTerms added to the preferences to allow user to set the desired amount of Key Terms to be generated with their BulletsAI request.
- Clicking on any single bullet point in the "Go Further?" section will perform a summary search of only that item and will create a link from that bullet point to the new summary.

#### **Changed**
- bulletsToPrompt()
  - Changed formatting and generation behavior.
    - Now takes existing bullet points and turns them into x-callback links to the generated summary. (Requires beta version of NotePlan)
    - Detects and removes empty bullet points.

#### **Fixed**
- No longer necessary for user to manually remove researched bullet points to prevent the plugin from redoing the summary.

#### **Bugs**
- bulletsToPrompt() stats are not working. Must be disabled in settings to function properly.

#### **Todo**
- Make the BulletsAI use its own note. This will be to reserve the namespace to prevent issues with links. Currently, Any bullets created before the page has a title will end up with reference links that point to a filepath that does not exist.


[0.1.5] - 2022-12-07 (@shadowfigure)

#### **Added**
- bulletsToPrompt()
  - Scans note for bullet points, creates a **Summaries** section at the bottom of the page, and then generates a summary for each. Appends the Wikipedia entry to the end.
  - Web links are currently being formatted with problems. Will explore soon.
- Three formatting functions for the bulletsToPrompt() added to the *helpers.js* file.
- exploreList() added to facilitate createResearchListRequest() functionality.
  - Currently not functioning as desired.

#### **Changed**
- createResearchListRequest() has been modified
  - Currently not functioning as desired

#### **TODO/Bugs**
- Explore ways to generate *reliably* useable links beyond Wikipedia and fix the current issue with the Wikipedia links.
- Explore the possibility of handling nested bullet points.
- Find a better way to handle the createResearchListRequest data so that it can have a useful "memory" of the previous calls in that session.
- Occassionally, Wikipedia links use parenthesis at the end which causes formatting issues with the Markdown. 


[0.1.4b] - 2022-12-05 (@shadowfigure)

#### **Quick Fix**
  - Changed how the researchNote function handles note generation to fix a problem with calling it outside of the Quick Search.

---

[0.1.4] - 2022-12-05 (@shadowfigure)

#### **Added**

- Completed modelsInformation in introwizard.js
- Added externalReading in introwizard.js
  - Provides titles and links for more information.

* Added prompts for each model in learnMore
* learnMore for models now includes external links for additional information.
* Added generateREADMECommands() to the helpers.js file
  * Not currently working.
* Flow descriptions for most, if not all, of the unlabeled functions.

#### **Changed**

* learnMore now goes back to the beginning after reading about a model.

#### **Fixed**

* Formatting issues in numerous prompts. Primarily in the intro and help wizards.

---



[0.1.3] - 2022-12-05 (@shadowfigure)

#### **Added**

- Added createQuickSearch()
  - Alias: /fs (fast search), or /searchai
  - Quickly gathers a summary and displays it as a prompt.
  - Provides further option to append it to the current note or to do deeper research and create a new note from the results.
- Added preference for defining a default "Research" directory for notes to be saved in.

#### **Changed**

- createResearchRequest() now outputs to a new note in the user-defined "Research" directory. If no directory is set, it will output to the base level directory.

#### **Fixed**

- Adjusted some formatting issues that were occuring with the formatResearchRequest prompt.

#### **Todo**

- If no default research directory is set, may prompt user to choose a directory.
- May create a prompt advising user to use the *text-davinci-003* model for certain types of searches due to its ability to format the responses properly.
- Write README.md
- Make the introduction wizard do something.



[0.1.2] - 2022-12-05 (@shadowfigure)

#### **Added**

- Beginning ideation of /help and introduction.
  - Needs to be redone
- Initial construction of createResearchListRequest() endpoint

### [0.1.1] - 2022-12-05 (@shadowfigure)

#### **Added**

- DallERequestOptions type
- CompletionsRequest type
- insertStatsAtCursor
- availableModels const
- Preferences
  - Select Model
  - Max Tokens
  - Show Stats

#### **Changed**

- model preference key to defaultModel
- max_tokens preference key to maxTokens
- chooseModel() now displays the calculated max cost of running the query.
- If defaultModel is set to "Choose Model", functions that require a model will prompt user to select a model from list.
- chooseModel() now only shows pre-configured models to remove additional visual noise.

### [0.1.0] - 2022-12-05 (@shadowfigure)

- Initial build

- #### **Added**

  - **Endpoints**
    - createAIImages()
    - createResearchRequest()
    - summarizeNote()
    - summarizeSelection()
  - **Helpers**
    - chooseModel()
    - getPromptAndNumberOfResults()
    - makeRequest()
    - getRequestObj()

## Plugin Versioning Uses Semver

All NotePlan plugins follow `semver` versioning. For details, please refer to [semver website](https://semver.org/)
