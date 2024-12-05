// @flow

// This file is only loaded and fetch is overridden if the import is enabled in the index file

/**
 * FETCH MOCKING
 * This file is used to override the fetch function (calls to an external server) with a fake response
 * This allows you to test your plugin without having to have a server running or having to have a network connection
 * or wait/pay for the server calls
 * You can define your fake responses in this file or in a separate file (see below)
 * ...and when your code makes a fetch call to a server, it will get (an appropriate) fake response instead
 * You define the responses and the text that must be in the fetch call to yield a particular response
 * (see the mockResponses array below)
 */

/**
 * 1) Import any of your fake responses that are saved as files here (or see below for defining them as strings)
 * The file should contain the exact response that the live server would return
 * You can save the response as a JSON file (like sampleFileResponse below) or as a string (like sampleTextResponse below)
 */
import sampleFileResponse from './fetchResponses/google.search-for-something.json' // a sample fake response saved as a JSON file

// Other necessary imports
import { FetchMock, type FetchMockResponse } from '@mocks/Fetch.mock'
import { logDebug } from '@helpers/dev'

/**
 * 2) Or you can define your fake responses as strings in this file:
 */
// You could also just put all the fake responses here in this file
// A little messier, but if you don't have very many responses, or they are small/strings, it's fine
const sampleTextWeatherResponse = `Nuremberg: ☀️   +9°F`

// 3) So the mock knows when to send back which response, you need to define the match and response for each mock response
// Fill in the match and response for each mock response you want to use
// The match object hast following properties:
// url: string - the url to match (can be a partial string, or can even be a string that includes regex)
// optionsBody: string - a partial string or string/regex included in the POST body of the request to match (sent in options.body to fetch)
// optionsBody is optional. If you don't need to match on the POST body (matching URL is enough), just leave it out
// The response MUST BE A STRING. So either use a string response (like sampleTextWeatherResponse above) or
// JSON.stringify your response object (like sampleFileResponse above)
const mockResponses: Array<FetchMockResponse> = [
  // the first mock below will match a POST request to google.com with the words "search for something" in the POST body
  { match: { url: 'google.com', optionsBody: 'search for something' }, response: JSON.stringify(sampleFileResponse) },
  // the mock below will match any GET or POST request to "wttr.in/Nuremberg?format=3" regardless of the body
  { match: { url: 'wttr.in/Nuremberg?format=3' }, response: sampleTextWeatherResponse },
]

/**
 * DO NOT TOUCH ANYTHING BELOW THIS LINE
 */

const fm = new FetchMock(mockResponses) // add one object to array for each mock response
fetch = async (url, opts) => {
  logDebug(`fetchOverrides.js`, `FetchMock faking response from: "${url}" (turn on/off in index.js)`)
  return await fm.fetch(url, opts)
} //override the global fetch
