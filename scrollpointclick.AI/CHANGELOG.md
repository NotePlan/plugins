# scrollpointclick.AI Changelog

See Plugin [README](https://github.com/NotePlan/plugins/blob/main/scrollpointclick.AI/README.md) for details on available commands and use case.

## What's Changed?

[0.1.6] - 2022-12-05 (@scrollpointclick)

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


[0.1.5] - 2022-12-05 (@scrollpointclick)

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


[0.1.4b] - 2022-12-05 (@scrollpointclick)

#### **Quick Fix**
  - Changed how the researchNote function handles note generation to fix a problem with calling it outside of the Quick Search.

---

[0.1.4] - 2022-12-05 (@scrollpointclick)

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



[0.1.3] - 2022-12-05 (@scrollpointclick)

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



[0.1.2] - 2022-12-05 (@scrollpointclick)

#### **Added**

- Beginning ideation of /help and introduction.
  - Needs to be redone
- Initial construction of createResearchListRequest() endpoint

### [0.1.1] - 2022-12-05 (@scrollpointclick)

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

### [0.1.0] - 2022-12-05 (@scrollpointclick)

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
