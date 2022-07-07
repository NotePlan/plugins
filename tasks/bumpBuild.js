#!/usr/bin/env node

/*-------------------------------------------------------------------------------------------
 * Copyright (c) 2018-2021 Mike Erickson / Codedungeon.  All rights reserved.
 * Licensed under the MIT license.  See LICENSE in the project root for license information.
 * -----------------------------------------------------------------------------------------*/

const fs = require('fs')
const colors = require('chalk')

const pkgInfo = require('../package.json')

let currBuild = parseInt(pkgInfo.build)

currBuild++

pkgInfo.build = currBuild.toString()

fs.writeFileSync('./package.json', JSON.stringify(pkgInfo, null, 2))

// important, do not add anything other than build number as it supplies
// return value which is used in the calling script (unless --verbose flag is supplied)

if (process.argv.includes('--verbose')) {
  console.log('')
  const versionStr = `v${pkgInfo.version} build ${currBuild}`
  console.log(colors.green(`${pkgInfo.name} updated to: `) + colors.cyan(versionStr))
} else {
  console.log(currBuild)
}
