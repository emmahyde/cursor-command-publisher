#!/usr/bin/env node
import { register } from 'tsx/esm/api';
import { pathToFileURL } from 'url';
import { resolve, dirname } from 'path';
import { fileURLToPath } from 'url';

const __dirname = dirname(fileURLToPath(import.meta.url));
const unregister = register();

// Import and run the TypeScript entry point
await import(pathToFileURL(resolve(__dirname, '../src/index.ts')).href);
