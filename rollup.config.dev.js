import config from './rollup.config.js';
import serve from 'rollup-plugin-serve';
export default {
  ...config,
  plugins: [
    ...config.plugins,
    serve({
      contentBase: './dist',
      host: 'localhost',
      port: 5000,
      headers: { 'Access-Control-Allow-Origin': '*', 'Cache-Control': 'no-store' },
    }),
  ],
};
