#!/usr/bin/env node

/**
 * Generates a Cursor deep link for one-click MCP server installation
 * Usage: node scripts/generate-deeplink.js
 */

const config = {
  command: "npx",
  args: ["-y", "cursor-command-publisher"]
};

const name = "cursor-command-publisher";
const configJson = JSON.stringify(config);
const base64Config = Buffer.from(configJson).toString('base64');
const deeplink = `cursor://anysphere.cursor-deeplink/mcp/install?name=${encodeURIComponent(name)}&config=${encodeURIComponent(base64Config)}`;

console.log("One-Click Install Link:");
console.log(deeplink);
console.log("\nMarkdown Link:");
console.log(`[Add to Cursor](${deeplink})`);
console.log("\nHTML Button:");
console.log(`<a href="${deeplink}"><img src="https://img.shields.io/badge/Add_to-Cursor-blue?style=for-the-badge&logo=cursor" alt="Add to Cursor"/></a>`);
