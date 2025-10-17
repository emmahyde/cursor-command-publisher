/**
 * MCP server with dynamic command registration from template files
 */

import path from "path";
import { Server } from "@modelcontextprotocol/sdk/server/index.js";
import {
  CallToolRequestSchema,
  ListToolsRequestSchema,
  ListPromptsRequestSchema,
  GetPromptRequestSchema,
} from "@modelcontextprotocol/sdk/types.js";
import { parseTemplate, renderTemplate, ParsedTemplate } from "./parser.js";
import { CommandWatcher } from "./watcher.js";

interface RegisteredTool {
  name: string;
  description: string;
  parsed: ParsedTemplate;
}

export class CommandServer {
  private server: Server;
  private tools: Map<string, RegisteredTool> = new Map();
  private watcher: CommandWatcher;

  constructor(commandsDirs: string | string[]) {
    this.server = new Server(
      {
        name: "mcp-command-server",
        version: "1.0.0",
      },
      {
        capabilities: {
          tools: {},
          prompts: {},
        },
      }
    );

    this.watcher = new CommandWatcher(commandsDirs);
    this.setupHandlers();
  }

  private setupHandlers(): void {
    // List available tools
    this.server.setRequestHandler(ListToolsRequestSchema, async () => {
      const tools = Array.from(this.tools.values()).map((tool) => ({
        name: tool.name,
        description: tool.description || `Execute ${tool.name}`,
        inputSchema: tool.parsed.inputSchema as Record<string, unknown>,
      }));

      return { tools };
    });

    // Execute tool
    this.server.setRequestHandler(CallToolRequestSchema, async (request) => {
      const { name, arguments: args = {} } = request.params;

      const tool = this.tools.get(name);
      if (!tool) {
        throw new Error(`Tool not found: ${name}`);
      }

      // Validate that all required variables are provided
      const missing: string[] = [];
      for (const v of tool.parsed.vars) {
        if (!(v.name in args)) {
          missing.push(v.name);
        }
      }

      if (missing.length > 0) {
        throw new Error(
          `Missing required arguments: ${missing.join(", ")}`
        );
      }

      // Render the template with provided arguments
      const result = renderTemplate(tool.parsed, args as Record<string, string>);

      return {
        content: [
          {
            type: "text",
            text: result,
          },
        ],
      };
    });

    // List available prompts (same as tools)
    this.server.setRequestHandler(ListPromptsRequestSchema, async () => {
      const prompts = Array.from(this.tools.values()).map((tool) => ({
        name: tool.name,
        description: tool.description || `Prompt for ${tool.name}`,
        arguments: tool.parsed.vars.map((v) => ({
          name: v.name,
          description: v.description || `Variable: ${v.name}`,
          required: true,
        })),
      }));

      return { prompts };
    });

    // Get specific prompt
    this.server.setRequestHandler(GetPromptRequestSchema, async (request) => {
      const { name, arguments: args = {} } = request.params;

      const tool = this.tools.get(name);
      if (!tool) {
        throw new Error(`Prompt not found: ${name}`);
      }

      // Render the template with provided arguments
      const result = renderTemplate(tool.parsed, args as Record<string, string>);

      return {
        description: tool.description || `Prompt for ${tool.name}`,
        messages: [
          {
            role: "user",
            content: {
              type: "text",
              text: result,
            },
          },
        ],
      };
    });

    // Set up file watcher
    this.watcher.onFileChange(async (event, filePath, content) => {
      const toolName = path.basename(filePath, ".md");

      if (event === "unlink") {
        this.tools.delete(toolName);
        console.log(`[–] Unregistered tool and prompt: ${toolName}`);
      } else if (content) {
        try {
          const parsed = parseTemplate(content);
          const description = extractDescription(content);

          this.tools.set(toolName, {
            name: toolName,
            description,
            parsed,
          });

          console.log(`[+] ${event === "add" ? "Registered" : "Updated"} tool and prompt: ${toolName}`);
        } catch (error) {
          console.error(`[!] Failed to parse ${toolName}:`, error);
        }
      }
    });
  }

  /**
   * Connect to transport and start watching for changes
   */
  async start(transport: any): Promise<void> {
    await this.watcher.start();
    await this.server.connect(transport);
  }

  /**
   * Stop watching and disconnect
   */
  async stop(): Promise<void> {
    await this.watcher.stop();
  }
}

/**
 * Extract description from template (first line or first paragraph)
 */
function extractDescription(content: string): string {
  const lines = content.split("\n");

  for (const line of lines) {
    const trimmed = line.trim();
    if (trimmed && !trimmed.startsWith("#") && !trimmed.startsWith("$")) {
      return trimmed.slice(0, 100);
    }
  }

  return "Command";
}
