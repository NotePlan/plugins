// eslint-disable-next-line
import commonjs from '@rollup/plugin-commonjs';
import babel from '@rollup/plugin-babel';
import resolve from '@rollup/plugin-node-resolve';

export default {
  external: [],
  input: `src/index.js`,
  output: {
    file: `script.js`,
    format: 'iife',
  },
  plugins: [
    resolve({
      browser: false,
    }),
    babel({ babelHelpers: 'bundled' }),
    commonjs(),
  ],
  context: 'this',
};
