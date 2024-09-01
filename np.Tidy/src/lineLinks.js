// @flow
// Written before 2023-08-27 by @dwertheimer
// Note: @jgclark sees that this is currently not used by any commands or functions.

type MatchResult = {
  fullMatch: string, // The full matched string.
  linkText: ?string, // The optional markdown link text (is null if match was not a markdown link)
  noteTitle: string, // The noteTitle part of the string.
  blockID: string, // The blockID part of the string.
}

/**
 * Finds and returns all matches of a specific x-callback formats in a multiline string.
 * @author @chatGPT and @dwertheimer
 * @param {string} inputString - The multiline string to be searched.
 * @returns {Array<MatchResult>} An array of objects, each representing a match.
 */
export function findLineLinks(inputString: string): Array<MatchResult> {
  let regex = /(?:\[(.*?)\]\()?(noteplan:\/\/x-callback-url\/openNote\?noteTitle=((?:\d{4}-\d{2}-\d{2}|[^\%]+))%5Ep{1}([a-zA-Z0-9]{6}))/g
  let matches
  let results: Array<MatchResult> = []

  while ((matches = regex.exec(inputString)) !== null) {
    let result: MatchResult = {
      // $FlowIgnore[incompatible-use]
      fullMatch: matches[0],
      // $FlowIgnore[incompatible-use]
      linkText: matches[1] || null,
      // $FlowIgnore[incompatible-use]
      noteTitle: matches[3],
      // $FlowIgnore[incompatible-use]
      blockID: matches[4]
    }
    results.push(result)
  }

  return results
}

let noteContentTestString = `Some text
[note1](noteplan://x-callback-url/openNote?noteTitle=2023-06-22%5Ep5e66a)
Other text
noteplan://x-callback-url/openNote?noteTitle=arbitraryString%5Ep5e66a
[note2](noteplan://x-callback-url/openNote?noteTitle=anotherString%5Ep5e66a)
End text`

let matches = findLineLinks(noteContentTestString);
console.log(matches)
