/*-------------------------------------------------------------------------------------------
 * Copyright (c) 2022 Mike Erickson / Codedungeon.  All rights reserved.
 * Licensed under the MIT license.  See LICENSE in the project root for license information.
 * -----------------------------------------------------------------------------------------*/

// @flow

// NOTE: Not using `@helpers/dev` here because it can't be resolved in jest tests
//       this should serve as a strong reason to support module aliases such as `@helpers`
//       as this is an ugly import
import { fetchWithTimeout } from '../../../../helpers/dev'

export async function getWeather(): Promise<string> {
  try {
    // return 'wttr.in unreachable'
    // $FlowFixMe
    return await fetchWithTimeout('https://wttr.in?format=3')
  } catch (error) {
    return '**An error occurred accessing weather service**'
  }
}
