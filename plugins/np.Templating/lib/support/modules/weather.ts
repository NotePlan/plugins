/*-------------------------------------------------------------------------------------------
 * Copyright (c) 2022 Mike Erickson / Codedungeon.  All rights reserved.
 * Licensed under the MIT license.  See LICENSE in the project root for license information.
 * -----------------------------------------------------------------------------------------*/

// @flow

export async function getWeather(): Promise<string> {
  try {
    // $FlowFixMe
    const response: any = await await fetch(`https://wttr.in?format=3`, { timeout: 3000 })
    return response ? response : '**An error occurred accessing weather service**'
  } catch (error: any) {
    return '**An error occurred accessing weather service**'
  }
}
