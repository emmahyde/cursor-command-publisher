import { defineConfig } from 'tsup';

export default defineConfig({
  entry: ['src/index.ts'],
  format: ['esm'],
  dts: true,
  sourcemap: true,
  clean: true,
  outDir: 'build',
  splitting: false,
  treeshake: true,
  external: ['@modelcontextprotocol/sdk', 'chokidar', 'yaml'],
  platform: 'node',
  target: 'node20',
});
