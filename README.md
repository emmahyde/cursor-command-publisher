# Command Publisher

[![npm version](https://img.shields.io/npm/v/cursor-command-publisher.svg)](https://www.npmjs.com/package/cursor-command-publisher)

[![Add to Cursor](https://img.shields.io/badge/Add_to-Cursor-000000?style=flat-square&logoColor=white)](https://cursor.com/en/install-mcp?name=cmdpublisher&config=eyJuYW1lIjoiY21kcHVibGlzaGVyIiwiY29tbWFuZCI6Im5weCIsImFyZ3MiOlsiLXkiLCJjdXJzb3ItY29tbWFuZC1wdWJsaXNoZXIiXSwiZW52Ijp7fX0=)

A lightweight MCP (Model Context Protocol) server that dynamically loads and executes command templates from markdown files. Templates use YAML frontmatter for variable definitions and `#{variable}` placeholders for parameterized commands.

Searches `~/.cursor/published` for `.md` files and parses front matter for interactive variable fillout.

https://github.com/user-attachments/assets/50efd387-6a83-4972-8028-7a777a3d1808

**Closer view of interactive modal:**

<img width="577" height="83" alt="Screenshot 2025-10-17 at 10 41 01" src="https://github.com/user-attachments/assets/9fa4c775-f25f-4b0b-a340-7b7aa3636e4b" />

## Getting Started

### Quick Install

Click the `Add to Cursor` button above. Then, create `~/.cursor/published`, or specify a different directory

### Manual Installation

#### MCP Configuration

```json
{
  "mcpServers": {
    "cmdpublisher": {
      "command": "npx",
      "args": ["-y", "cursor-command-publisher"],
    }
  }
}
```

Or specify a custom directory:

```json
{
  "mcpServers": {
    "cmdpublisher": {
      "command": "node",
      "args": ["/path/to/cursor-command-publisher/build/index.js"],
      "env": {
        "COMMANDS_DIR": ["/custom/path"]
      }
    }
  }
}
```

Note that `COMMANDS_DIR` must be an Array.

#### Manual Installation

Go to `Cursor Settings` -> `MCP` -> `Add new MCP Server`. Name to your liking, use `command` type with the command from the standard config above. You can also verify config or add command like arguments via clicking `Edit`.
</details>

### Configuration Details

- **Server Name:** `cmdpublisher`
- **Type:** NPX Package
- **Package:** `emmahyde/cursor-command-publisher`

## Features

- **Dynamic Command Loading**: Watch a directory for `.md` files and automatically register them as MCP tools and prompts
- **Live Reloading**: Changes to template files are detected instantly
- **YAML Frontmatter**: Clean variable definitions with descriptions in one place
- **Simple Template Syntax**: Use `#{varName}` for placeholders
- **Optional Params**: Use `variable?: "optional param"` syntax to allow null values.
- **Dual Registration**: Each template is exposed as both a tool and a prompt
- **Minimal Dependencies**: Only uses `@modelcontextprotocol/sdk`, `chokidar`, and `yaml`
- **Local Only**: No network ports or API keys required

## Usage

### Create Command Templates

Create a `.cursor/published/` directory and add markdown files with templates:

```bash
mkdir -p .cursor/published
```

**Example: `.cursor/published/summarize.md`**

```markdown
---
format: "output format (bullet points, paragraph, etc)"
text: "the text to summarize"
---

Summarize the following text in #{format} format:

#{text}
```

**Example: `.cursor/published/translate.md`**

```markdown
---
language: "target language"
text: "the text to translate"
---

Translate the following text to #{language} language:

#{text}
```

## Template Syntax

Templates use YAML frontmatter for variable definitions and `#{variableName}` for placeholders:

```markdown
---
variableName: "human-readable description"
anotherVar: "another description"
---

Template content with #{variableName} and #{anotherVar} placeholders.
```

### Examples

**Simple variables**

```markdown
---
command: "shell command to run"
---

Run: #{command}
```

**Multiple variables**

```markdown
---
host: "hostname or IP"
port: "port number"
user: "login username"
---

Connect to #{host} on port #{port} using username #{user}
```


**Optional variables:**
Can be null.

```markdown
---
host: "hostname or IP"
port: "port number"
user?: "login username"
---

Connect to #{host} on port #{port} using username #{user}
```

**Drop code into your Prompt**

```markdown
---
code: "the path/to/code.file:X-Y range"
audience: "who needs the explanation"
---

# Code Explanation

Explain the following code for #{audience}:

\```
#{code}
\```
Focus on what it does and why.
```

## How It Works

1. **Startup**: Server scans `.cursor/published/` for `.md` files and parses them
2. **Registration**: Each template is registered as both an MCP tool and prompt with variables as parameters
3. **Watching**: File changes are detected via `chokidar` and tools/prompts are updated in real-time
4. **Execution**: When a tool/prompt is called, variables are substituted and the result is returned

## Architecture

```
src/
├── index.ts       # Entry point with STDIO transport
├── server.ts      # MCP server with tool registration
├── parser.ts      # Template tokenizer and AST builder
└── watcher.ts     # File watcher using chokidar
```

### Key Components

- **Parser**: YAML frontmatter parser with `#{}` placeholder extraction, automatically skips fenced code blocks
- **Watcher**: Monitors directory and notifies of changes
- **Server**: Registers tools and prompts dynamically, executes template rendering

## Environment Variables

- `COMMANDS_DIR`: Directory to watch for template files (default: `~/.cursor/command-publisher` and `./.cursor/command-publisher`)

## File Watching Behavior

- Initial scan loads all existing `.md` files
- File changes are detected with a 300ms stability threshold (waits for write to complete)
- Supports: add, modify, and delete operations
- Only `.md` files are processed

## Error Handling

- Invalid template syntax is logged to stderr but doesn't crash the server
- Missing required arguments are reported as MCP errors
- File read errors are caught and logged
- Graceful shutdown on SIGINT (Ctrl+C)

## Performance Characteristics

- **Startup**: O(n) where n = number of template files
- **File Change**: O(1) to re-register affected tool
- **Tool Execution**: O(1) template substitution
- **Memory**: Minimal, stores only parsed templates

## Limitations

- Templates are text-based and returned as plain strings
- No built-in validation of substituted values
- Variable names are case-sensitive
- No template inheritance or includes (by design, keep it lean)

## Future Enhancements

- Template validation schemas
- Nested templates or includes
- Multiple output formats (JSON, XML, etc.)
- Pre/post-processing hooks
- Template caching and optimization
- Conditional blocks based on the value of the param

## License

MIT
