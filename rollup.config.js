// eslint-disable-next-line
import commonjs from '@rollup/plugin-commonjs';
import { babel } from '@rollup/plugin-babel';
import resolve from '@rollup/plugin-node-resolve';

export default {
  external: [],
  input: 'nmn.sweep/src/index.js',
  output: {
    file: 'nmn.sweep/script.js',
    format: 'iife',
  },
  plugins: [
    babel({ babelHelpers: 'bundled' }),
    commonjs(),
    resolve({
      browser: false,
    }),
  ],
  context: 'this',
};
