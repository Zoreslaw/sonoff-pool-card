import typescript from '@rollup/plugin-typescript';
import nodeResolve from '@rollup/plugin-node-resolve';
export default {
  input: 'src/sonoff-outdoor-light-card.ts',
  output: { file: 'dist/sonoff-pool-card.js', format: 'es', inlineDynamicImports: true },
  plugins: [nodeResolve(), typescript()],
};
