// @flow

export async function getAdvice(): Promise<string> {
  const URL = `https://api.adviceslip.com/advice`
  try {
    const response: any = await fetch(URL)
    const data = JSON.parse(response)
    if (data.slip.advice.length > 0) {
      return data.slip.advice
    } else {
      return 'Advice returned empty response'
    }
  } catch (error) {
    return 'An error occurred accessing quoting service, please review configurtation'
  }
}
