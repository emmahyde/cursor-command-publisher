#!/usr/bin/env node

/**
 * @fileoverview MCP Command Server Entry Point
 * Dynamically loads and executes command templates from markdown files.
 */

import path from 'path';
import os from 'os';
import { StdioServerTransport } from '@modelcontextprotocol/sdk/server/stdio.js';
import { createCommandServer } from './server.js';

/**
 * Initializes and starts the MCP Command Server.
 * @returns {Promise<void>}
 * @throws {Error} Fatal errors logged to stderr with process exit
 */
const main = async (): Promise<void> => {
  try {
    const commandsDirs: string[] = [];

    // Check COMMANDS_DIR env var (comma-separated paths) or use defaults
    if (process.env.COMMANDS_DIR) {
      const dirs = process.env.COMMANDS_DIR.split(',')
        .map(dir => dir.trim())
        .filter(dir => dir.length > 0);
      commandsDirs.push(...dirs);
    } else {
      const globalDir = path.join(os.homedir(), '.cursor/published');
      const projectDir = path.join(process.cwd(), '.cursor/published');
      commandsDirs.push(globalDir, projectDir);
    }

    console.error(`Watching directories:`);
    commandsDirs.forEach(dir => console.error(`  - ${dir}`));

    const server = createCommandServer(commandsDirs);
    const transport = new StdioServerTransport();

    await server.start(transport);

    // Graceful shutdown on SIGINT
    process.on('SIGINT', async () => {
      await server.stop();
      process.exit(0);
    });
  } catch (error) {
    console.error('Fatal error:', error);
    process.exit(1);
  }
};

main();
