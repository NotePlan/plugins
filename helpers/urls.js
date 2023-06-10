/* @flow */

export type LinkObject = {
  url: string,
  name: ?string,
  lineIndex: number,
  domain: string,
  page: string,
}

/**
 * Processes a given URL and returns a LinkObject (used by findURLsInText())
 *
 * @param {string} urlStr - The URL to process.
 * @param {?string} name - The name of the markdown link. If the URL is not a markdown link, this should be null.
 * @param {number} lineIndex - The index of the line the URL was found on.
 * @param {boolean} removeSubdomain - Whether to remove the subdomain (like www) from the URL or not.
 * @returns {LinkObject} The processed LinkObject.
 */
export function processURL(urlStr: string, name: ?string, lineIndex: number, removeSubdomain: boolean): LinkObject {
  let [domain, page] = urlStr.split(/\/+/g).slice(1)
  page = page ? page.split('?')[0] : '' // remove URL parameters

  if (removeSubdomain) {
    domain = domain.split('.').slice(1, -1).join('.')
  } else {
    domain = domain.split('.').slice(0, -1).join('.')
  }

  return {
    url: urlStr,
    name: name,
    lineIndex: lineIndex,
    domain: domain,
    page: page,
  }
}

/**
 * Scans multiple lines of text for URLs and returns an array of LinkObjects.
 *
 * @param {string} text - The text to scan for URLs.
 * @param {boolean} [removeSubdomain=false] - Whether to remove the subdomain (like www) from the URLs or not.
 * @returns {LinkObject[]} An array of LinkObjects.
 */
export function findURLsInText(text: string, removeSubdomain: boolean = false): Array<LinkObject> {
  const markdownURLPattern = /\[([^\]]+)\]\((https?:\/\/[^\)]+)\)/g
  const bareURLPattern = /(https?:\/\/[^\s]+)/g

  const lines = text.split('\n')
  const links: Array<LinkObject> = []

  for (let i = 0; i < lines.length; i++) {
    let line = lines[i]
    let match

    // Process markdown URLs first and replace them with placeholders in the line.
    while ((match = markdownURLPattern.exec(line)) !== null) {
      links.push(processURL(match[2], match[1], i, removeSubdomain))
      line = line.replace(match[0], 'MARKDOWN_LINK_PLACEHOLDER')
    }

    // Process bare URLs.
    while ((match = bareURLPattern.exec(line)) !== null) {
      links.push(processURL(match[1], null, i, removeSubdomain))
    }
  }

  return links
}
