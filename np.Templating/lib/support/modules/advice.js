// @flow

export async function getAdvice(): Promise<string> {
  try {
    const response: any = await fetch(`https://api.adviceslip.com/advice`, { timeout: 3000 })
    const data = JSON.parse(response)
    return data && data?.slip?.advice?.length > 0 ? data.slip.advice : '**Advice returned empty response**'
  } catch (err) {
    return `**An error occurred accessing quoting service**`
  }
}
