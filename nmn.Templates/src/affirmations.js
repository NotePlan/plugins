import { showMessage } from '../../helpers/userInput'

export async function getAffirmation() {
  const aff = await doFetchJson('https://affirmations.dev')
  if (aff.error) {
    return aff.msg
  } else {
    return aff.affirmation
  }
}

export async function getAdvice() {
  const aff = await doFetchJson('https://api.adviceslip.com/advice')
  if (aff.error) {
    return aff.msg
  } else {
    if (aff.slip.advice.length > 0) {
      return aff.slip.advice
    } else {
      return 'Advice returned empty advice'
    }
  }
}

// Assumes fetch JSON response as plain text payload
// So we parse it as JSON rather than response.json()
export async function doFetchJson(URL) {
  console.log(`Before API call: ${URL}`)
  try {
    const response = await fetch(URL)
    const data = JSON.parse(response)
    return data
  } catch (error) {
    showMessage(`External URL fetch failed: ${error}`)
    return { error, msg: `Fetch failed for ${URL}: ${JSON.stringify(error)}` }
  }
}
