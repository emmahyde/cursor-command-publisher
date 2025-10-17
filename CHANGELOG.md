# Changelog

All notable changes to this project will be documented in this file.

The format is based on [Keep a Changelog](https://keepachangelog.com/en/1.0.0/),
and this project adheres to [Semantic Versioning](https://semver.org/spec/v2.0.0.html).

## [Unreleased]

### Added
- Conditional block syntax: `#{?variable}...#{/variable}` for conditional content inclusion
- Blocks only render when control variable has a non-empty value
- Support for both `#{/variable}` and `#{/}` block end syntax
- 13 comprehensive tests for conditional blocks
- Template fixtures for conditional blocks in `tests/fixtures/templates.json`

### Changed
- Refactored parser from imperative `for` loops to `for...of` with handler functions
- Parser now uses stack-based approach for nested block handling
- Updated AST types to support `ConditionalBlock` nodes
- README documentation expanded with conditional block examples

### Fixed
- Fixed TypeScript imports to use `.js` extensions for ES modules
- Fixed `bin/cli.js` to use compiled build output instead of tsx runtime
- Fixed `package.json` files field to include `build` directory instead of `src`
- Fixed eslint configuration with separate `tsconfig.eslint.json` for linting tests
- Updated `.gitignore` to exclude compiled test artifacts

## [1.0.3] - 2025-10-17

### Changed
- Updated test script to run once and exit (using `vitest --run`)

### Fixed
- Fixed optional parameter test to use supported placeholder syntax

## [1.0.2] - 2025-10-17

### Added
- Initial published version with core functionality
- YAML frontmatter support for variable definitions
- `#{variable}` placeholder syntax
- Optional parameters with `variable?: "description"` syntax
- Live file watching with chokidar
- Dual registration as both MCP tools and prompts
- Code block skipping in parser

[Unreleased]: https://github.com/emmahyde/cursor-command-publisher/compare/v1.0.3...HEAD
[1.0.3]: https://github.com/emmahyde/cursor-command-publisher/compare/v1.0.2...v1.0.3
[1.0.2]: https://github.com/emmahyde/cursor-command-publisher/releases/tag/v1.0.2
