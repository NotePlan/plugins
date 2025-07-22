// @flow

export async function journalingQuestion(): Promise<string> {
  try {
    const URL = `https://journaling.place/api/prompt`
    const response: any = await fetch(URL, { timeout: 3000 })
    if (!response) return `**journalingQuestion() web service did not respond**`
    const data = JSON.parse(response)
    return data?.text || ''
  } catch (err) {
    return `**An error occurred accessing journaling service**`
  }
}
