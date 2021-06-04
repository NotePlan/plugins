// eslint-disable-next-line
import commonjs from "@rollup/plugin-commonjs"
import { babel } from "@rollup/plugin-babel"
import resolve from "@rollup/plugin-node-resolve"

export default {
  external: [],
  input: `${__dirname}/src/index.js`,
  output: {
    file: `${__dirname}/script.js`,
    format: "iife",
    name: "exports",
    footer: "Object.assign(globalThis, exports)",
  },
  plugins: [
    babel({ babelHelpers: "bundled" }),
    commonjs(),
    resolve({
      browser: false,
    }),
  ],
  context: "this",
}
