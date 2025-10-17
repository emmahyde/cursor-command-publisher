# MCP Command Server

A lightweight MCP (Model Context Protocol) server that dynamically loads and executes command templates from markdown files. Templates use simple `${variable, "description"}` syntax for parameterized commands.

## Features

- **Dynamic Command Loading**: Watch a directory for `.md` files and automatically register them as MCP tools
- **Live Reloading**: Changes to template files are detected instantly
- **Simple Template Syntax**: Use `${varName, "description"}` for parameters
- **Minimal Dependencies**: Only uses `@modelcontextprotocol/sdk` and `chokidar`
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

Create a `.cursor/commands/` directory and add markdown files with templates:

```bash
mkdir -p .cursor/commands
```

**Example: `.cursor/commands/summarize.md`**

```
Summarize the following text in ${format, "output format (bullet points, paragraph, etc)"} format:

${text, "the text to summarize"}
```

**Example: `.cursor/commands/translate.md`**

```
Translate the following text to ${language, "target language"} language:

${text, "the text to translate"}
```

### 4. Run the Server

```bash
# Default (looks for .cursor/commands in current directory)
node build/index.js

# Or specify a custom directory
COMMANDS_DIR=/path/to/commands node build/index.js
```

## Template Syntax

Templates use a simple variable placeholder format:

```
${variableName, "human-readable description"}
```

- Variable names must be valid identifiers (alphanumeric, underscore)
- Descriptions are optional
- Variables can appear multiple times in a template
- The tokenizer safely handles commas and quotes inside descriptions

### Examples

**Simple variable:**
```
Run: ${command}
```

**Variable with description:**
```
Execute: ${command, "shell command to run"}
```

**Multiple variables:**
```
Connect to ${host, "hostname or IP"} on port ${port, "port number"}
using username ${user, "login username"}
```

## How It Works

1. **Startup**: Server scans `.cursor/commands/` for `.md` files and parses them
2. **Registration**: Each template is registered as an MCP tool with variables as parameters
3. **Watching**: File changes are detected via `chokidar` and tools are updated in real-time
4. **Execution**: When a tool is called, variables are substituted and the result is returned

## MCP Configuration

To use this server with Claude in Cursor, add to your `.cursor/config.json`:

```json
{
  "mcpServers": {
    "command-server": {
      "command": "node",
      "args": ["/path/to/mcp-command-server/build/index.js"],
      "env": {
        "COMMANDS_DIR": "/path/to/.cursor/commands"
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

- **Parser**: Safe tokenizer that handles edge cases (commas in quotes, escaped characters)
- **Watcher**: Monitors directory and notifies of changes
- **Server**: Registers tools dynamically and executes template rendering

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

- `COMMANDS_DIR`: Directory to watch for template files (default: `.cursor/commands`)

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
