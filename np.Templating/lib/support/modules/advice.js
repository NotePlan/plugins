// @flow

export async function getAdvice(): Promise<string> {
  try {
    const response: any = await fetch(`https://api.adviceslip.com/advice`)
    const data = JSON.parse(response)
    if (data.slip.advice.length > 0) {
      return data.slip.advice
    } else {
      return '**Advice returned empty response**'
    }
  } catch (error) {
    return '**An error occurred accessing quoting service**'
  }
}
