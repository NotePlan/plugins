// @flow
// This file is only loaded and fetch is overridden if the import is enabled in the index file
import mercury from './fetchResponses/completions.mercury.json' // a JSON file with a sample server response
import mercuryKeyTopics from './fetchResponses/completions.mercuryKeyTopics.json'
import thermalProtection from './fetchResponses/completions.thermalProtection.json'
import thermalProtectionKeyTopics from './fetchResponses/completions.thermalProtectionKeyTopics.json'
import heatTransfer from './fetchResponses/completions.heatTransfer.json'
import heatTransferKeyTopics from './fetchResponses/completions.heatTransferKeyTopics.json'
import { FetchMock, type FetchMockResponse } from '@mocks/Fetch.mock'
import { logDebug } from '@helpers/dev'

const mockResponses: Array<FetchMockResponse> = [
  { match: { url: 'completions', optionsBody: 'topic of Mercury' }, response: JSON.stringify(mercury) },
  { match: { url: 'completions', optionsBody: 'key topics associated with Mercury' }, response: JSON.stringify(mercuryKeyTopics) },
  { match: { url: 'completions', optionsBody: 'topic of Thermal Protection' }, response: JSON.stringify(thermalProtection) },
  { match: { url: 'completions', optionsBody: 'key topics associated with Thermal Protection' }, response: JSON.stringify(thermalProtectionKeyTopics) },
  { match: { url: 'completions', optionsBody: 'topic of Heat Transfer' }, response: JSON.stringify(heatTransfer) },
  { match: { url: 'completions', optionsBody: 'Heat Transfer in the context of' }, response: JSON.stringify(heatTransfer) },
  { match: { url: 'completions', optionsBody: 'key topics associated with Heat Transfer' }, response: JSON.stringify(heatTransferKeyTopics) },
]
const fm = new FetchMock(mockResponses) // add one object to array for each mock response
fetch = async (url, opts) => {
  logDebug(`fetchOverrides.js`, `FetchMock faking response from: "${url}" (turn on/off in index.js)`)
  return await fm.fetch(url, opts)
} //override the global fetch
