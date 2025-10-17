/**
 * @fileoverview Cursor Comamnd Publisher
 * Dynamically registers and executes command templates as tools and prompts.
 */

import path from 'path';
import { Server } from '@modelcontextprotocol/sdk/server/index.js';
import type { Transport } from '@modelcontextprotocol/sdk/shared/transport.js';
import {
  CallToolRequestSchema,
  ListToolsRequestSchema,
  ListPromptsRequestSchema,
  GetPromptRequestSchema,
} from '@modelcontextprotocol/sdk/types.js';
import { parseTemplate, renderTemplate } from './parser.js';
import { createCommandWatcher } from './watcher.js';
import type { RegisteredTool } from './types.js';

/**
 * Creates an MCP server with dynamic command loading from markdown templates.
 * @param {string[]} commandsDirs - Directory path(s) to watch for .md files, can be overridden by the COMMAND_DIRS environment variable
 * @returns {Object} Server instance with start/stop methods and internal references
 * @example
 * ```typescript
 * const server = createCommandServer(['.cursor/publisher']);
 * ```
 *
 * or in your .cursor/config.json:
 * ```json
 * {
 *   "mcpServers": {
 *     "command-publisher": {
 *       "command": "npx",
 *       "args": ["-y", "emmahyde/cursor-command-publisher"],
 *       "env": {
 *         "COMMAND_DIRS": [
 *           "path/to/commands/directory",
 *           "another/path/to/commands/directory"
 *         ]
 *       }
 *     }
 *   }
 * }
 * ```
 */
const createCommandServer = (commandsDirs: string[]) => {
  const server = new Server(
    { name: 'command-publisher', version: '1.0.0' },
    { capabilities: { tools: {}, prompts: {} } }
  );

  const tools: Map<string, RegisteredTool> = new Map();
  const watcher = createCommandWatcher(commandsDirs);

  /**
   * Lists all registered command tools.
   * @returns {Promise<{ tools: Array<{ name, description, inputSchema }> }>}
   */
  server.setRequestHandler(ListToolsRequestSchema, async () => ({
    tools: Array.from(tools.values()).map(tool => ({
      name: tool.name,
      description: tool.description ?? `Execute ${tool.name}`,
      inputSchema: tool.parsed.inputSchema as Record<string, unknown>,
    })),
  }));

  /**
   * Executes a command tool with variable substitution.
   * @param {Object} request - MCP request with tool name and arguments
   * @returns {Promise<{ content: Array<{ type, text }> }>} Rendered template output
   * @throws {Error} If tool not found or required arguments missing
   */
  server.setRequestHandler(CallToolRequestSchema, async request => {
    const { name, arguments: args = {} } = request.params;
    const tool = tools.get(name);
    if (!tool) throw new Error(`Tool not found: ${name}`);

    const missing = tool.parsed.vars
      .filter(v => !v.optional)
      .map(v => v.name)
      .filter(v => !(v in (args as Record<string, unknown>)));
    if (missing.length)
      throw new Error(`Missing required arguments: ${missing.join(', ')}`);

    const result = renderTemplate(tool.parsed, args as Record<string, string>);
    return { content: [{ type: 'text', text: result }] };
  });

  /**
   * Lists all available prompts (same as tools, different response format).
   * @returns {Promise<{ prompts: Array<{ name, description, arguments }> }>}
   */
  server.setRequestHandler(ListPromptsRequestSchema, async () => ({
    prompts: Array.from(tools.values()).map(tool => ({
      name: tool.name,
      description: tool.description ?? `Prompt for ${tool.name}`,
      arguments: tool.parsed.vars.map(v => ({
        name: v.name,
        description: v.description ?? `Variable: ${v.name}`,
        required: !v.optional,
      })),
    })),
  }));

  /**
   * Retrieves a specific prompt with rendered content.
   * @param {Object} request - MCP request with prompt name and arguments
   * @returns {Promise<{ description, messages }>} Rendered prompt in message format
   * @throws {Error} If prompt not found
   */
  server.setRequestHandler(GetPromptRequestSchema, async request => {
    const { name, arguments: args = {} } = request.params;
    const tool = tools.get(name);
    if (!tool) throw new Error(`Prompt not found: ${name}`);

    const result = renderTemplate(tool.parsed, args as Record<string, string>);
    return {
      description: tool.description ?? `Prompt for ${tool.name}`,
      messages: [{ role: 'user', content: { type: 'text', text: result } }],
    };
  });

  /**
   * Monitors file changes and updates tool/prompt registry.
   * Registers on 'add', updates on 'change', unregisters on 'unlink'.
   * @param {string} event - File event type: 'add' | 'change' | 'unlink'
   * @param {string} filePath - Path to the changed .md file
   * @param {string} content - File contents (undefined on 'unlink')
   */
  watcher.onFileChange(async ({ event, filePath, content }) => {
    const toolName = path.basename(filePath, '.md');
    if (event === 'unlink') {
      tools.delete(toolName);
      return;
    }
    if (!content) return;
    try {
      const parsed = parseTemplate(content);
      const description = extractDescription(content);
      tools.set(toolName, { name: toolName, description, parsed });
    } catch (error) {
      console.error(`Failed to parse ${toolName}:`, error);
    }
  });

  /**
   * Starts server and begins watching for file changes.
   * @param {Transport} transport - MCP transport layer (typically StdioServerTransport)
   * @returns {Promise<void>}
   */
  const start = async (transport: Transport): Promise<void> => {
    await watcher.start();
    await server.connect(transport);
  };

  /**
   * Gracefully shuts down server and file watcher.
   * @returns {Promise<void>}
   */
  const stop = async (): Promise<void> => {
    await watcher.stop();
  };

  return {
    start,
    stop,
    _server: server,
    _tools: tools,
    _watcher: watcher,
  } as const;
};

/**
 * Extracts a human-readable description from template content.
 * @param {string} content - Template markdown content
 * @returns {string} Description (max 100 chars) or fallback 'Command'
 */
const extractDescription = (content: string): string => {
  const lines = content.split('\n');
  const found = lines.find(line => {
    const trimmed = line.trim();
    return (
      Boolean(trimmed) && !trimmed.startsWith('#') && !trimmed.startsWith('$')
    );
  });
  return found?.trim().slice(0, 100) ?? 'Command';
};

export { createCommandServer };
