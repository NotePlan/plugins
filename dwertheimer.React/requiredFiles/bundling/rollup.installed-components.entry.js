// use browserify to create the bundle of these included files
/**
 * Using browserify to create a single bundle of included files which have require() statements
 * To re-bundle, from project root:
 browserify dwertheimer.React/requiredFiles/browserify.datatableBundle.js -r DataTable -o dwertheimer.React/requiredFiles/_dataTable.js -t [ babelify --presets [ @babel/preset-env @babel/preset-react ] ]
 **/

// const DataTable = require('./react-data-table-component.dev.js')
// import * as DataTable from './react-data-table-component.dev.js'
// import DataTable from 'react-data-table-component'

//  npx rollup -c dwertheimer.React/requiredFiles/rollup.installed-components.cfg.js

// export { DataTable } from './react-data-table-component.dev.js'
import DataTable from 'react-data-table-component'
import styled from 'styled-components'
import Select from 'react-select'
import makeAnimated from 'react-select/animated'
import AsyncSelect from 'react-select/async'
import Creatable, { useCreatable } from 'react-select/creatable'
import { CSSProperties } from 'react'
import chroma from 'chroma-js'
import debounce from 'lodash.debounce'
// export { Grid } from 'react-loader-spinner'

export { DataTable, styled, Select, makeAnimated, AsyncSelect, Creatable, useCreatable, CSSProperties, chroma, debounce }
// module.exports = {
//   default: function (n) {
//     console.log(DataTable)
//     return n
//   },
//   DataTable,
// }
