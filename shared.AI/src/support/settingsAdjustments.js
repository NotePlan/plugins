import { logDebug, logWarn } from "../../../helpers/dev"
import { isInt } from "../../../helpers/userInput"


export async function changeDefaultMaxTokens() {
    let { max_tokens } = DataStore.settings
    const newMaxTokens = await CommandBar.showInput(`Current Value: ${max_tokens}`, 'Update Max Token Target')
    if (isInt(newMaxTokens)) {
        DataStore.settings = {...DataStore.settings, max_tokens: Number(newMaxTokens)}
    } else {
        changeDefaultMaxTokens()
        logWarn(pluginJson, `Value for max_tokens must be an integer.`)
    }
}

export async function changeTargetSummaryParagraphs() {
    let { bulletsSummaryParagraphs } = DataStore.settings
    const newTargetParagraphs = await CommandBar.showInput(`Current Value: ${bulletsSummaryParagraphs}`, 'Update Summary Paragraphs Target')
    if (isInt(newTargetParagraphs)) {
        DataStore.settings = {...DataStore.settings, bulletsSummaryParagraphs: Number(newTargetParagraphs)}
    } else {
        // logWarn(pluginJson, `Value for bulletsSummaryParagraphs must be an integer.`)
        changeTargetSummaryParagraphs()
    }
}

export async function changeDefaultTargetKeyTerms() {
    let { bulletsAIKeyTerms } = DataStore.settings
    const newTargetKeyTerms = await CommandBar.showInput(`Current Value: ${bulletsAIKeyTerms}`, 'Update Key Terms Target')
    if (isInt(newTargetKeyTerms)) {
        DataStore.settings = {...DataStore.settings, bulletsAIKeyTerms: Number(newTargetKeyTerms)}
    } else {
        changeDefaultTargetKeyTerms()
        logWarn(pluginJson, `Value for bulletsAIKeyTerms must be an integer.`)
    }
}

export async function setOpenAIAPIKey(useClipboard: boolean = false) {
    let { apiKey } = DataStore.settings
    let newAPIKey = ''
    // logError(pluginJson, 'Starting the setOpenAIAPIKey call.')
    if (useClipboard && Clipboard.string != '') {
        logDebug(pluginJson, 'Trying to use the clipboard to fill the API Key.')
        newAPIKey = await CommandBar.showInput(`Key: ${Clipboard.string}`, 'Set API Key')
    } else {
        logDebug(pluginJson, 'Not trying to use the clipboard to fill the API Key.')
        newAPIKey = await CommandBar.showInput(`${(apiKey) ? `Current Key: ${apiKey}` : 'No API Key Set'}`)
    }
    // const newAPIKey2 = await CommandBar.showInput(`${(apiKey) ? `Current Key: ${apiKey} : ${(useClipboard) ? Editor.clipboard` : 'No API Key Set'`, `${(apiKey) ? 'Overwrite Existing API Key' : 'Set API Key'}`)
    DataStore.settings = {...DataStore.settings, apiKey: newAPIKey}
}

export async function updatePluginPreference(key: string, value: Any) {
    // let { key } = DataStore.settings
    // const newValue = await CommandBar.showInput(`Current Value for ${key}: ${key}`, 'Update Preference Value')
    // DataStore.settings = {...DataStore.settings, key: newValue}
}
