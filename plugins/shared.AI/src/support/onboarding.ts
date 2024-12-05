import { changeDefaultMaxTokens, changeTargetSummaryParagraphs, changeDefaultTargetKeyTerms, setOpenAIAPIKey } from "./settingsAdjustments"

import { noteAIWizardPrompts, noteAIWizardPages } from "./onboardingText"

export async function firstLaunch() {
    // Welcome splash screen
    let selection = 0
    // selection = await CommandBar.prompt('Welcome to NoteAI', 'To get things connected and working, follow this short guide to learn the basics.', ['Continue', 'Cancel'])
    selection = await CommandBar.prompt(noteAIWizardPrompts.gettingStarted.title, noteAIWizardPrompts.gettingStarted.message, noteAIWizardPrompts.gettingStarted.buttons)
    if (selection == 0) {
        // Instructions to get API key
        selection = await CommandBar.prompt(noteAIWizardPrompts.aboutGPT3.title, noteAIWizardPrompts.aboutGPT3.message, noteAIWizardPrompts.aboutGPT3.buttons)
        
        if (selection == 0) {
            NotePlan.openURL('https://beta.openai.com/signup')
            await CommandBar.prompt('Generate API Key', `Once you have created your account, click below to obtain your API Key to use with this plugin. Copy your API Key to the clipboard.`, ['Get API Key'])
        }

        NotePlan.openURL('https://beta.openai.com/account/api-keys')
        await CommandBar.prompt('Copy API Key to Clipboard', `Click 'Continue' when you've copied your new API key to the clipboard.`, ['Continue'])
        // await setOpenAIAPIKey(true) // Deactivated to prevent removing API key accidentally
        // Consider a way to check to verify that the API Key is correctly set

        selection = await CommandBar.prompt('Test Run', 'With the AI connected, go ahead and perform your first search.', ['Continue', 'Cancel'])
        if (selection == 0) {
            let subject = await CommandBar.showInput('Type in the subject you would like to learn more about.', 'Search', 'Research', 'Machine Learning')
            if (subject) {
                DataStore.invokePluginCommandByName('Create Research Dig Site', 'shared.AI', [subject])
            }
        }
    }

    // Walkthrough of the settings, (with examples?)
}

export async function firstLaunch1() {
    await DataStore.newNoteWithContent(noteAIWizardPages.understandingModels.text, 'NoteAI', 'NoteAI - Understanding Models.md')
}