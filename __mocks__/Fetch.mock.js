// @flow

/**
 * Mock the fetch() function to return a specific response for a given URL and options.body
 * You pass in text to the match object and if the url or options.body contain that text, the response is returned
 * Note: match.url is required but match.optionsBody is optional
 * The matches are case-insensitive and are turned into RegExps so you can include regular expressions in the match strings
 * So you could match for "foo" (a plain string) or you could match for "foo.*bar" (a regular expression) that would be true for "foo bar" or "foo xxx bar"
 * The matches are done in order of the mockResponses array, so the first match is returned that matches the URL and/or options.body
 * So it's a good idea to put the more complex rules first and the simpler rules later in the array
 * For instance, if two requests are going to have the word "Mercury" in them, but one request will have "concept of Mercury", you might want to put the more specific rule first
 * It's generally a good idea to put as many words as possible in the match string to avoid false matches
 * If no match is found, the defaultResponse text is returned
 * @param {Array<FetchMockResponse>} mockResponses - Array of mock responses in the form of FetchMockResponse
 * @example
import response1 from './mockResponses/response1.json' // a JSON file with a sample server response (you will probably have several of these)
import { FetchMock, type FetchMockResponse } from '@mocks/Fetch.mock'
const OVERRIDE_FETCH = true // set to true to override the global fetch() function with fake responses passed below
if (OVERRIDE_FETCH) {
  const fm = new FetchMock([
    { match: { url: 'xxx', optionsBody: "foo.*bar" }, response: JSON.stringify(response1) }
   ]) // add one object to array for each mock response
  fetch = async (url, opts) => fm.fetch(url, opts) //override the global fetch
}
 * ...then wherever the code is using fetch, it will use the mock
 * const result = await fetch('http://xxx.com/api', { body: 'has foo and also has the word bar in it' }) // returns 'fake server response here' (the response text)
 */
export class FetchMock {
  responses: Array<FetchMockResponse> = [defaultResponse]
  constructor(mockResponses: Array<FetchMockResponse>) {
    if (mockResponses && !Array.isArray(mockResponses)) throw new Error('Fetch constructor requires an array of mock responses')
    this.responses = [...(mockResponses?.length ? mockResponses : []), ...this.responses]
  }
  fetch(url: string, options: FetchOptions): string {
    const match = this.responses.find((r) => {
      const urlTest = r.match?.url ? new RegExp(r.match.url, 'ig').test(url) : false
      // body options will return true if it's a match or if it's not defined
      const optionsBodyTest = r.match?.optionsBody && options.body ? new RegExp(r.match.optionsBody, 'ig').test(options?.body || '') : r.match?.optionsBody ? false : true
      return urlTest && optionsBodyTest
    })
    // return match ? Promise.resolve(match.response) : Promise.resolve(defaultResponse.response)
    return match ? match.response : defaultResponse.response
  }
}

export type FetchMockResponse = {
  match: { url: string /* a string to look for in the URL passed to fetch */, optionsBody?: string /* an (optional) string to look for in the options.body passed to fetch */ },
  response: string /* the response to return if the match is found */,
}

const defaultResponse = {
  match: { url: '', optionsBody: '' },
  response:
    'Fetch call mocking is turned on and received a request, but the request did not match any of the supplied mock responses -- check the spelling and/or RegEx patterns in the URL and optionsBody matchers.',
}
