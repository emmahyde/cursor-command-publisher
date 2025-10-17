#!/usr/bin/env node
import { resolve, dirname } from 'path';
import { fileURLToPath } from 'url';

const __dirname = dirname(fileURLToPath(import.meta.url));

// Import and run the compiled JavaScript entry point
await import(resolve(__dirname, '../build/index.js'));
