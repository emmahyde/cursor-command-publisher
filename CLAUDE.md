# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Project Overview

**cursor-command-publisher** is an MCP (Model Context Protocol) server that dynamically loads and executes command templates from markdown files. It enables users to define reusable command templates with YAML frontmatter for variable definitions and `#{varName}` placeholders that can be executed through Claude in Cursor or other MCP clients.

The server watches `.cursor/command-publisher/` directories for `.md` files, parses them as templates, and exposes them as both MCP tools and prompts with automatic schema generation and validation.

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

1. **Parser (`src/parser.ts`)** - Template parser with YAML frontmatter support
   - Extracts YAML frontmatter for variable definitions
   - Parses `#{name}` syntax from markdown templates
   - **Skips code blocks**: Ignores `#{...}` inside fenced code blocks (` ``` `)
   - Builds an AST (Abstract Syntax Tree) of template parts
   - Generates JSON Schema from variable definitions
   - Handles YAML edge cases: special characters, multiline values
   - Exports `parseTemplate()` and `renderTemplate()` functions

2. **Watcher (`src/watcher.ts`)** - File system monitor
   - Uses `chokidar` to watch one or more directories for `.md` files
   - Supports watching multiple directories simultaneously
   - Emits events on file add/change/delete
   - Loads initial files on startup
   - Uses 300ms stability threshold to avoid race conditions

3. **Server (`src/server.ts`)** - MCP protocol handler
   - Manages tool and prompt registration via MCP SDK
   - Dynamically updates tools and prompts when files change
   - Implements `ListTools`, `CallTool`, `ListPrompts`, and `GetPrompt` request handlers
   - Validates required arguments before template rendering
   - Extracts descriptions from template content (first non-comment line)
   - Each template is exposed as both a tool and a prompt

4. **Index (`src/index.ts`)** - Entry point
   - Initializes `CommandServer` with commands directories
   - By default watches both `~/.cursor/command-publisher` (global) and `./.cursor/command-publisher` (project-local)
   - Sets up STDIO transport for MCP communication
   - Handles graceful shutdown on SIGINT

### Data Flow

```
.md file → Watcher detects change → Parser extracts YAML + variables →
Server registers tool and prompt → MCP client lists/calls tool or prompt →
Template renders with substituted variables
```

## Template Syntax

Templates use YAML frontmatter for variable definitions and `#{variableName}` for placeholders:

```markdown
---
variableName: "description of the variable"
anotherVar: "another description"
---

Template content with #{variableName} and #{anotherVar} placeholders.
```

**Key Features:**
- Variable names must be valid identifiers (alphanumeric, underscore)
- Descriptions defined in YAML frontmatter
- Variables can appear multiple times in the template body
- Uses `#{}` syntax to avoid conflicts with JavaScript template literals
- **Code blocks are ignored**: Placeholders inside fenced code blocks (` ``` `) are treated as literal text
- YAML supports multiline values, special characters, and proper escaping

**Example template:**
```markdown
---
format: "output format (bullet points, paragraph, etc)"
text: "the text to summarize"
---

Summarize the following text in #{format} format:

#{text}

Note: Variables inside code blocks are ignored:
\`\`\`
#{this_is_not_a_variable}
\`\`\`
```

## Key Implementation Details

- **YAML Frontmatter**: Variable definitions centralized in YAML for better organization
- **Code Block Skipping**: Parser detects fenced code blocks (` ``` `) and ignores any `#{...}` patterns within them
- **Unique Variables**: Parser deduplicates variables using a `Map`, keeping only first occurrence
- **Schema Generation**: Variables automatically become required string properties in JSON Schema
- **Dual Registration**: Each template is registered as both a tool (executable) and a prompt (message template)
- **Error Handling**: Parse errors are logged but don't crash the server; MCP errors report missing arguments
- **File Watching**: 300ms `awaitWriteFinish` threshold prevents reprocessing incomplete writes
- **STDIO Transport**: Uses MCP SDK's STDIO transport for parent process communication

## Environment Configuration

- `COMMANDS_DIR`: Comma-separated list of directories to watch for template files
  - If set, overrides the default behavior
  - Example: `COMMANDS_DIR="/path/to/dir1,/path/to/dir2"`
  - If not set, defaults to watching both:
    - `~/.cursor/command-publisher` (global commands)
    - `./.cursor/command-publisher` (project-local commands)
- This allows commands to be defined globally or per-project
- **Why `.cursor/command-publisher/`**: Avoids conflicts with Cursor's automatic slash command discovery from `.cursor/commands/`

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
- **Case-sensitive variables**: `#{text}` and `#{Text}` are different
- **Ordered unique variables**: First occurrence of a variable name defines it
- **No validation of substituted values**: Server doesn't validate argument types
- **Simple syntax**: Uses `#{}` instead of `${}` to avoid JavaScript template literal conflicts

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
          "COMMANDS_DIR": "/custom/path1,/custom/path2"
        }
      }
    }
  }
  ```
- If `COMMANDS_DIR` is not specified, the server automatically watches:
  - `~/.cursor/command-publisher` (global commands shared across all projects)
  - `./.cursor/command-publisher` (project-specific commands in the current directory)

## Dependencies

- **Production**: `@modelcontextprotocol/sdk` (MCP protocol), `chokidar` (file watching), `yaml` (YAML parsing)
- **Development**: TypeScript, Vitest, coverage tools
- **Node**: Requires Node 20.0.0+
- **Type**: ES2022 modules

## Common Development Workflows

1. **Adding a new feature**: Start `npm run watch` in one terminal, test in another
2. **Testing template parsing**: Add test cases to `src/parser.test.ts` with edge cases
3. **Debugging tool registration**: Check console.error output (logs go to stderr)
4. **Manual server testing**: Run `npm run dev` and connect MCP client to STDIO
