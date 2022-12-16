// @flow

export type FetchMockResponse = {
  match: { url: string /* a string to look for in the URL passed to fetch */, optionsBody?: string /* an (optional) string to look for in the options.body passed to fetch */ },
  response: string /* the response to return if the match is found */,
}

const defaultResponse = {
  match: { url: '', optionsBody: '' },
  response: 'Default fetch response string (did not match any mocks -- check the spelling in the URL and optionsBody matchers)',
}

/**
 * Mock the fetch() function to return a specific response for a given URL and options.body
 * You pass in text to the match object and if the url or options.body contain that text, the response is returned
 * Note: match.url is required but match.optionsBody is optional
 * If no match is found, the defaultResponse text is returned
 * @param {Array<FetchMockResponse>} mockResponses - Array of mock responses in the form of FetchMockResponse
 * @example
import response1 from './testJSONs/response1.json' // a JSON file with a sample server response (you will probably have several of these)
import { FetchMock, type FetchMockResponse } from '@mocks/Fetch.mock'
const OVERRIDE_FETCH = true // set to true to override the global fetch() function with fake responses passed below
if (OVERRIDE_FETCH) {
  const fm = new FetchMock([
    { match: { url: 'foo', optionsBody: 'bar' }, response: JSON.stringify(response1) }
   ]) // add one object to array for each mock response
  fetch = async (url, opts) => fm.fetch(url, opts) //override the global fetch
}
 * ...then wherever the code is using fetch, it will use the mock
 * const result = await fetch('http://foo', { body: 'has the word bar in it' }) // returns 'fake server response here' (the response text)
 */
export class FetchMock {
  responses: Array<FetchMockResponse> = [defaultResponse]
  constructor(mockResponses: Array<FetchMockResponse>) {
    if (mockResponses && !Array.isArray(mockResponses)) throw new Error('Fetch constructor requires an array of mock responses')
    this.responses = [...(mockResponses?.length ? mockResponses : []), ...this.responses]
  }
  fetch(url: string, options: FetchOptions) {
    const body = options?.body ?? null //
    const match = this.responses.find((r) => {
      const urlTest = r.match?.url ? new RegExp(r.match.url, 'ig').test(url) : false
      // body options will return true if it's a match or if it's not defined
      const optionsBodyTest = r.match?.optionsBody && options.body ? new RegExp(r.match.optionsBody, 'ig').test(options.body) : r.match?.optionsBody ? false : true
      return urlTest && optionsBodyTest
    })
    // return match ? Promise.resolve(match.response) : Promise.resolve(defaultResponse.response)
    return match ? match.response : defaultResponse.response
  }
}
