// @flow

export async function getAdvice(): Promise<string> {
  try {
    const response: any = await fetch(`https://api.adviceslip.com/advice`, { timeout: 5000 })
    if (!response) return `**advice() web service did not respond**`
    const data = JSON.parse(response)
    return data && data?.slip?.advice?.length > 0 ? data.slip.advice : '**Advice returned empty response**'
  } catch (err) {
    return `**Could not reach advice service (error: ${err.message})**`
  }
}
