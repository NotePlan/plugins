/*-------------------------------------------------------------------------------------------
 * Copyright (c) 2022 Mike Erickson / Codedungeon.  All rights reserved.
 * Licensed under the MIT license.  See LICENSE in the project root for license information.
 * -----------------------------------------------------------------------------------------*/

import affirmations from './data/affirmations'

export function getAffirmation() {
  return affirmations[Math.floor(Math.random() * affirmations.length)]
}
