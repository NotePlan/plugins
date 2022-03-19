/*-------------------------------------------------------------------------------------------
 * Copyright (c) 2022 Mike Erickson / Codedungeon.  All rights reserved.
 * Licensed under the MIT license.  See LICENSE in the project root for license information.
 * -----------------------------------------------------------------------------------------*/

// @flow

// $FlowIgnore
export async function getDailyQuote(quoteParams: mixed, config: { [string]: ?mixed }): Promise<string> {
  const quoteConfig: any = config.quote ?? null
  if (quoteConfig == null) {
    return `Missing 'quote' configuration in "Templates/_configuration"`
  }

  const pref_mode = 'random'

  const author = quoteConfig?.author // Available authors: https://premium.zenquotes.io/available-authors/
  const apiKey = quoteConfig?.zenquotesKey ?? '' // https://premium.zenquotes.io/
  const API = `https://zenquotes.io/api/`
  const URL = pref_mode === 'author' && author && apiKey ? `${API}quotes/${pref_mode}/${author}/${apiKey}` : `${API}${pref_mode}`

  const response = await fetch(URL)
  if (response) {
    //$FlowIgnore[incompatible-call]
    const quoteLines = JSON.parse(response)
    if (quoteLines.length > 0) {
      const data = quoteLines[0]
      return `${data.q} - *${data.a}*`
    }
  } else {
    return 'An error occurred accessing quoting service, please review configurtation'
  }
}

/**
 * INFO ON FETCH

Getting a response is usually a two-stage process.

First, the promise, returned by fetch, resolves with an object of the built-in Response class as soon as the server responds with headers.

At this stage we can check HTTP status, to see whether it is successful or not, check headers, but don't have the body yet.

The promise rejects if the fetch was unable to make HTTP-request, e.g. network problems, or there's no such site. Abnormal HTTP-statuses, such as 404 or 500 do not cause an error.

We can see HTTP-status in response properties:

status - HTTP status code, e.g. 200.
ok - boolean, true if the HTTP status code is 200-299.
For example:

let response = await fetch(url);

if (response.ok) { // if HTTP-status is 200-299
  // get the response body (the method explained below)
  let json = await response.json();
} else {
  alert("HTTP-Error: " + response.status);
}
Second, to get the response body, we need to use an additional method call.

Response provides multiple promise-based methods to access the body in various formats:

response.text() - read the response and return as text,
response.json() - parse the response as JSON,
response.formData() - return the response as FormData object (explained in the next chapter),
response.blob() - return the response as Blob (binary data with type),
response.arrayBuffer() - return the response as ArrayBuffer (low-level representation of binary data),
additionally, response.body is a ReadableStream object, it allows you to read the body chunk-by-chunk, we'll see an example later.


For instance, let's get a JSON-object with latest commits from GitHub:

let url = 'https://api.github.com/repos/javascript-tutorial/en.javascript.info/commits';
let response = await fetch(url);
let commits = await response.json(); // read response body and parse as JSON
alert(commits[0].author.login);

To get the response text, await response.text() instead of .json():

let response = await fetch('https://api.github.com/repos/javascript-tutorial/en.javascript.info/commits');
let text = await response.text(); // read response body as text
alert(text.slice(0, 80) + '...');


Response headers
The response headers are available in a Map-like headers object in response.headers.
It's not exactly a Map, but it has similar methods to get individual headers by name or iterate over them:

let response = await fetch('https://api.github.com/repos/javascript-tutorial/en.javascript.info/commits');
// get one header
alert(response.headers.get('Content-Type')); // application/json; charset=utf-8
// iterate over all headers
for (let [key, value] of response.headers) {
  alert(`${key} = ${value}`);
}

All options
  let promise = fetch(url, {
  method: "GET", // POST, PUT, DELETE, etc.
  headers: {
    // the content type header value is usually auto-set
    // depending on the request body
    "Content-Type": "text/plain;charset=UTF-8"
  },
  body: undefined // string, FormData, Blob, BufferSource, or URLSearchParams
  referrer: "about:client", // or "" to send no Referer header,
  // or an url from the current origin
  referrerPolicy: "no-referrer-when-downgrade", // no-referrer, origin, same-origin...
  mode: "cors", // same-origin, no-cors
  credentials: "same-origin", // omit, include
  cache: "default", // no-store, reload, no-cache, force-cache, or only-if-cached
  redirect: "follow", // manual, error
  integrity: "", // a hash, like "sha256-abcdef1234567890"
  keepalive: false, // true
  signal: undefined, // AbortController to abort request
  window: window // null
});

credentials
The credentials option specifies whether fetch should send cookies and HTTP-Authorization headers with the request.

"same-origin" - the default, don't send for cross-origin requests,
"include" - always send, requires Access-Control-Allow-Credentials from cross-origin server in order for JavaScript to access the response, that was covered in the chapter Fetch: Cross-Origin Requests,
"omit" - never send, even for same-origin requests.


 */
