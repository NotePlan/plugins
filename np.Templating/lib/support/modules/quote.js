// @flow

// $FlowFixMe
export async function getDailyQuote(): Promise<string> {
  const response = await fetch(`https://zenquotes.io/api/random`)
  if (response) {
    //$FlowIgnore[incompatible-call]
    const quoteLines = JSON.parse(response)
    if (quoteLines.length > 0) {
      const data = quoteLines[0]
      return `${data.q} - *${data.a}*`
    }
  } else {
    return '**An error occurred accessing quoting service**'
  }
}
