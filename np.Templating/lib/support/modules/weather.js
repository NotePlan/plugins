/*-------------------------------------------------------------------------------------------
 * Copyright (c) 2022 Mike Erickson / Codedungeon.  All rights reserved.
 * Licensed under the MIT license.  See LICENSE in the project root for license information.
 * -----------------------------------------------------------------------------------------*/

// @flow

export async function getWeather(): Promise<string> {
  try {
    // $FlowFixMe
    let response: any = await fetch(`https://wttr.in?format=3`, { timeout: 3000 })
    if (response) {
      response = response.startsWith('not found:') ? '**The weather service could not automatically determine your location from your IP address**' : response
    }
    return response ? response : '**weather() web service did not respond**'
  } catch (error) {
    return '**An error occurred accessing weather service**'
  }
}
