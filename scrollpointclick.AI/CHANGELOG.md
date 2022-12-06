# scrollpointclick.AI Changelog

See Plugin [README](https://github.com/NotePlan/plugins/blob/main/scrollpointclick.AI/README.md) for details on available commands and use case.

## What's Changed?

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
