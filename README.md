# command-publisher

A lightweight MCP (Model Context Protocol) server that dynamically loads and executes command templates from markdown files. Templates use YAML frontmatter for variable definitions and `#{variable}` placeholders for parameterized commands.

## One-Click Install

[![Install in VS Code](https://img.shields.io/badge/Install_in-VS_Code-0098FF?style=flat-square&logo=visualstudiocode&logoColor=white)](https://vscode.dev/redirect/mcp/install?name=cursor-command-publisher&config=%7B%22command%22%3A%22npx%22%2C%22args%22%3A%5B%22-y%22%2C%22cursor-command-publisher%22%5D%2C%22env%22%3A%7B%7D%7D)
[![Install in Cursor](https://img.shields.io/badge/Install_in-Cursor-000000?style=flat-square&logoColor=white)](https://cursor.com/en/install-mcp?name=cursor-command-publisher&config=eyJuYW1lIjoiY3Vyc29yLWNvbW1hbmQtcHVibGlzaGVyIiwiY29tbWFuZCI6Im5weCIsImFyZ3MiOlsiLXkiLCJjdXJzb3ItY29tbWFuZC1wdWJsaXNoZXIiXSwiZW52Ijp7fX0=)

## Features

- **Dynamic Command Loading**: Watch a directory for `.md` files and automatically register them as MCP tools and prompts
- **Live Reloading**: Changes to template files are detected instantly
- **YAML Frontmatter**: Clean variable definitions with descriptions in one place
- **Simple Template Syntax**: Use `#{varName}` for placeholders
- **Code Block Aware**: Automatically ignores placeholders inside fenced code blocks
- **Dual Registration**: Each template is exposed as both a tool and a prompt
- **Minimal Dependencies**: Only uses `@modelcontextprotocol/sdk`, `chokidar`, and `yaml`
- **Local Only**: No network ports or API keys required

## Quick Start

### 1. Install Dependencies

```bash
npm install
```

### 2. Build

```bash
npm run build
```

### 3. Create Command Templates

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

### 4. Run the Server

```bash
# Default (looks for .cursor/published in current directory)
node build/index.js

# Or specify a custom directory
COMMANDS_DIR=/path/to/commands node build/index.js
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

**Key Features:**
- Variable names must be valid identifiers (alphanumeric, underscore)
- Descriptions defined in YAML frontmatter
- Variables can appear multiple times in the template body
- Uses `#{}` syntax (avoids conflicts with JavaScript templates)
- **Code blocks are ignored**: Placeholders inside ` ``` ` fenced blocks are treated as literal text
- YAML supports multiline values and special characters

### Examples

**Simple variables:**

```markdown
---
command: "shell command to run"
---

Run: #{command}
```

**Multiple variables:**

```markdown
---
host: "hostname or IP"
port: "port number"
user: "login username"
---

Connect to #{host} on port #{port} using username #{user}
```

**Complex template with multiline YAML:**

```markdown
---
code: "the code to explain"
audience: "who needs the explanation"
---

# Code Explanation

Explain the following code for #{audience}:

```
#{code}
```

Focus on what it does and why.
```

**Code block awareness:**

```markdown
---
name: "person's name"
---

Hello #{name}!

Here's the syntax we use:
\`\`\`
#{variable_name}  <- This is NOT extracted as a variable
\`\`\`

Goodbye #{name}!
```

In this example, only `name` is extracted as a variable. The `#{variable_name}` inside the code block is treated as literal text.

## How It Works

1. **Startup**: Server scans `.cursor/published/` for `.md` files and parses them
2. **Registration**: Each template is registered as both an MCP tool and prompt with variables as parameters
3. **Watching**: File changes are detected via `chokidar` and tools/prompts are updated in real-time
4. **Execution**: When a tool/prompt is called, variables are substituted and the result is returned

## MCP Configuration

To use this server with Claude in Cursor, add to your `.cursor/config.json`:

```json
{
  "mcpServers": {
    "command-publisher": {
      "command": "npx",
      "args": ["-y", "cursor-command-publisher"],
      "env": {}
    }
  }
}
```

Or specify a custom directory:

```json
{
  "mcpServers": {
    "command-publisher": {
      "command": "node",
      "args": ["/path/to/cursor-command-publisher/build/index.js"],
      "env": {
        "COMMANDS_DIR": "/custom/path"
      }
    }
  }
}
```

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

## Development

### Watch Mode

```bash
npm run watch
```

### Test a Command Manually

```bash
# Build first
npm run build

# Run server
node build/index.js

# In another terminal, test with MCP client
```

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

## Future Enhancements (Not Included)

- Template validation schemas
- Nested templates or includes
- Multiple output formats (JSON, XML, etc.)
- Pre/post-processing hooks
- Template caching and optimization

## License

MIT
