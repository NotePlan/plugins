// use rollup to create the bundle of these included files
// See directions in the performRollup.node.js file

// Even though we have named this FormView.jsx, it is exported as WebView.jsx because that
// is what the Root React Component expects

export { FormView as WebView } from '../reactForm/components/FormView.jsx'
