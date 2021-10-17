// @flow

export async function getAffirmation(): Promise<string> {
  const URL = `https://affirmations.dev`
  try {
    const response: any = await fetch(URL)
    const data = JSON.parse(response)
    return data.affirmation
  } catch (error) {
    return '**An error occurred accessing quoting service**'
  }
}
