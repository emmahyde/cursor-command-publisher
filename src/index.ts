#!/usr/bin/env node

/**
 * MCP Command Server
 * Dynamically loads and executes command templates from .md files
 */

import path from "path";
import { fileURLToPath } from "url";
import { StdioServerTransport } from "@modelcontextprotocol/sdk/server/stdio.js";
import { CommandServer } from "./server.js";

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

async function main(): Promise<void> {
  try {
    // Default to .cursor/commands in current working directory
    const commandsDir = process.env.COMMANDS_DIR || path.join(process.cwd(), ".cursor/commands");

    console.error(`Starting MCP Command Server`);
    console.error(`Commands directory: ${commandsDir}`);

    const server = new CommandServer(commandsDir);
    const transport = new StdioServerTransport();

    await server.start(transport);

    console.error("Server started successfully");

    // Graceful shutdown
    process.on("SIGINT", async () => {
      console.error("Shutting down...");
      await server.stop();
      process.exit(0);
    });
  } catch (error) {
    console.error("Fatal error:", error);
    process.exit(1);
  }
}

main();
