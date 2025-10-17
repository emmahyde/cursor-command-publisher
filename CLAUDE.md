# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Project Overview

**cursor-command-publisher** is an MCP (Model Context Protocol) server that dynamically loads and executes command templates from markdown files. It enables users to define reusable command templates with variable placeholders (`${varName, "description"}`) that can be executed through Claude in Cursor or other MCP clients.

The server watches a directory for `.md` files, parses them as templates, and exposes them as MCP tools with automatic schema generation and validation.

## Build & Development Commands

```bash
# Build TypeScript to JavaScript
npm run build

# Watch mode for active development
npm run watch

# Run tests
npm test

# Run tests with UI
npm test:ui

# Generate coverage report
npm test:coverage

# Run server in development (loads TypeScript directly)
npm run dev
```

## Architecture Overview

### Core Components

1. **Parser (`src/parser.ts`)** - Safe template tokenizer
   - Parses `${name, "description"}` syntax from markdown templates
   - Builds an AST (Abstract Syntax Tree) of template parts
   - Generates JSON Schema from variable definitions
   - Handles edge cases: escaped characters, quotes within descriptions, commas
   - Exports `parseTemplate()` and `renderTemplate()` functions

2. **Watcher (`src/watcher.ts`)** - File system monitor
   - Uses `chokidar` to watch `.cursor/commands/` for `.md` files
   - Emits events on file add/change/delete
   - Loads initial files on startup
   - Uses 300ms stability threshold to avoid race conditions

3. **Server (`src/server.ts`)** - MCP protocol handler
   - Manages tool registration via MCP SDK
   - Dynamically updates tools when files change
   - Implements `ListTools` and `CallTool` request handlers
   - Validates required arguments before template rendering
   - Extracts descriptions from template content (first non-comment line)

4. **Index (`src/index.ts`)** - Entry point
   - Initializes `CommandServer` with commands directory
   - Sets up STDIO transport for MCP communication
   - Handles graceful shutdown on SIGINT

### Data Flow

```
.md file → Watcher detects change → Parser extracts variables →
Server registers tool → MCP client lists/calls tool →
Template renders with substituted variables
```

## Template Syntax

Variables use the format: `${variableName, "description"}`

- Variable names must be valid identifiers (alphanumeric, underscore)
- Descriptions are optional but recommended
- Variables can appear multiple times (first occurrence defines the variable)
- Parser safely handles commas and quotes inside descriptions

Example template:
```
Summarize the following text in ${format, "output format (bullet points, paragraph, etc)"} format:

${text, "the text to summarize"}
```

## Key Implementation Details

- **Unique Variables**: Parser deduplicates variables using a `Map`, keeping only first occurrence
- **Schema Generation**: Variables automatically become required string properties in JSON Schema
- **Error Handling**: Parse errors are logged but don't crash the server; MCP errors report missing arguments
- **File Watching**: 300ms `awaitWriteFinish` threshold prevents reprocessing incomplete writes
- **STDIO Transport**: Uses MCP SDK's STDIO transport for parent process communication

## Environment Configuration

- `COMMANDS_DIR`: Directory to watch for template files (defaults to `.cursor/commands` in current directory)
- Set via environment variable before running server

## Testing

Tests are located alongside source files (`.test.ts` suffix) and use Vitest:
- `src/parser.test.ts` - Template parsing and rendering
- `src/server.test.ts` - MCP server behavior
- `src/watcher.test.ts` - File watching logic

Run individual test file: `npm test -- src/parser.test.ts`

## Performance Characteristics

- Startup: O(n) where n = number of template files
- File change: O(1) tool re-registration
- Tool execution: O(1) template substitution
- Memory: Minimal, only stores parsed templates

## Limitations & Design Decisions

- **Text-based templates only**: No support for structured output formats (JSON, XML, etc.)
- **No template inheritance**: Templates are standalone (by design, keep it lean)
- **Case-sensitive variables**: `${text}` and `${Text}` are different
- **Ordered unique variables**: First occurrence of a variable name defines it
- **No validation of substituted values**: Server doesn't validate argument types

## Publishing & Distribution

- Package name: `cursor-command-publisher`
- Published as npm package and MCP registry compatible
- Binary entrypoint: `cursor-command-publisher` command available after installation
- Configuration for `.cursor/config.json`:
  ```json
  {
    "mcpServers": {
      "command-server": {
        "command": "node",
        "args": ["/path/to/build/index.js"],
        "env": {
          "COMMANDS_DIR": "/path/to/.cursor/commands"
        }
      }
    }
  }
  ```

## Dependencies

- **Production**: `@modelcontextprotocol/sdk` (MCP protocol), `chokidar` (file watching)
- **Development**: TypeScript, Vitest, coverage tools
- **Node**: Requires Node 20.0.0+
- **Type**: ES2022 modules

## Common Development Workflows

1. **Adding a new feature**: Start `npm run watch` in one terminal, test in another
2. **Testing template parsing**: Add test cases to `src/parser.test.ts` with edge cases
3. **Debugging tool registration**: Check console.error output (logs go to stderr)
4. **Manual server testing**: Run `npm run dev` and connect MCP client to STDIO
