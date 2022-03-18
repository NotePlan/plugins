// @flow

export async function getAdvice(): Promise<string> {
  try {
    let response: any = await await fetch(`https://api.adviceslip.com/advice`, { timeout: 3000 })
    const data = JSON.parse(response)
    return data && data?.slip?.advice?.length > 0 ? data.slip.advice : '**Advice returned empty response**'
  } catch (err) {
    return `**An error occurred accessing quoting service**`
  }

  // try {
  //   const request = fetch(`https://api.adviceslip.com/advice`, { timeout: 1000 })
  //     .then((response: any) => {
  //       console.log('response')
  //       console.log(response)
  //       return response
  //     })
  //     .catch((err) => '**An error occurred accessing quoting service**')

  //   console.log('här')
  //   const response = await request
  //   const data = JSON.parse(response)
  //   return data && data?.slip?.advice?.length > 0 ? data.slip.advice : '**Advice returned empty response**'

  //   // const response: any = await fetch(`https://api.adviceslip.com/advice`, { timeout: 3000 })
  //   // const data = JSON.parse(response)
  //   // return data && data?.slip?.advice?.length > 0 ? data.slip.advice : '**Advice returned empty response**'
  // } catch (error) {
  //   return '**An error occurred accessing quoting service**'
  // }
}
