#!/usr/bin/env node

/**
 * MCP Command Server
 * Dynamically loads and executes command templates from .md files
 */

import path from "path";
import os from "os";
import { fileURLToPath } from "url";
import { StdioServerTransport } from "@modelcontextprotocol/sdk/server/stdio.js";
import { CommandServer } from "./server.js";

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

async function main(): Promise<void> {
  try {
    // Build list of directories to watch
    const commandsDirs: string[] = [];

    // Add custom directories from COMMANDS_DIR (comma-separated)
    if (process.env.COMMANDS_DIR) {
      commandsDirs.push(...process.env.COMMANDS_DIR.split(",").map((dir) => dir.trim()));
    } else {
      // Default behavior: check both global and project-local directories
      const globalDir = path.join(os.homedir(), ".cursor/command-publisher");
      const projectDir = path.join(process.cwd(), ".cursor/command-publisher");

      commandsDirs.push(globalDir, projectDir);
    }

    console.log(`Starting MCP Command Server`);
    console.log(`Commands directories:`);
    commandsDirs.forEach((dir) => console.log(`  - ${dir}`));

    const server = new CommandServer(commandsDirs);
    const transport = new StdioServerTransport();

    await server.start(transport);

    console.log("Server started successfully");

    // Graceful shutdown
    process.on("SIGINT", async () => {
      console.log("Shutting down...");
      await server.stop();
      process.exit(0);
    });
  } catch (error) {
    console.error("Fatal error:", error);
    process.exit(1);
  }
}

main();
