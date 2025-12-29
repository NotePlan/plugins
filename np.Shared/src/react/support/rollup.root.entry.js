// use rollup to create the bundle of these included files
/**
 * To re-bundle, from project root:
npx rollup -c np.Shared/src/react/support/rollup.root.cfg.js --watch
 **/

// import chroma from 'chroma-js'
// import debounce from 'lodash.debounce'
// import styled from 'styled-components'
// import DataTable, { createTheme } from 'react-data-table-component'
// import Select from 'react-select'
// import makeAnimated from 'react-select/animated'
// import AsyncSelect from 'react-select/async'
// import Creatable, { useCreatable } from 'react-select/creatable'
// import { CSSProperties } from 'react'
// import { ErrorBoundary } from 'react-error-boundary'

// export { chroma, styled, DataTable, Select, makeAnimated, AsyncSelect, Creatable, useCreatable, CSSProperties, debounce, ErrorBoundary, createTheme as createDataTableTheme }

// export { ErrorFallback } from '../_Cmp-ErrorFallback.jsx'
// export { StatusButton } from '../_Cmp-StatusButton.jsx'
// export { ThemedSelect } from '../_Cmp-ThemedSelect.jsx'
// export { WebView } from '../_Cmp-WebView.jsx'
export { logDebug } from '@helpers/react/reactDev'
export { Root } from '../Root.jsx'

// Export React and ReactDOM so they're available as globals for other bundles
import React, { createElement } from 'react'
export { React, React as react, createElement }

import * as ReactDOM from 'react-dom/client'
export { createRoot } from 'react-dom/client'
export { ReactDOM as reactDOM, ReactDOM as dom, ReactDOM }
