// @flow

export async function journalingQuestion(): Promise<string> {
  try {
    const URL = `https://journaling.place/api/prompt`
    const response: any = await await fetch(URL, { timeout: 3000 })
    const data = JSON.parse(response)
    return data?.text || ''
  } catch (err) {
    return `**An error occurred accessing journaling service**`
  }
}
