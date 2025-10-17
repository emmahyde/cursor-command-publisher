# Optional Fields Implementation

## Summary

Added support for optional fields in template placeholders, allowing fields to be marked as optional and treated as intentionally null when provided as empty strings.

## Syntax

### In Frontmatter
```yaml
---
required: "required field description"
optional?: "optional field description"
---
```

### In Template Body
```markdown
#{required} #{optional?}
```

## Behavior

1. **Optional Detection**: Fields are optional if:
   - Marked with `?` in frontmatter (`name?:`)
   - OR marked with `?` in placeholder (`#{name?}`)
   - Both can be combined for clarity

2. **Empty String Handling**: 
   - Empty string (`""`) for optional fields = intentionally null → renders as empty
   - Missing optional fields → keeps placeholder syntax `#{name}`
   - Non-empty values → renders normally

3. **JSON Schema**:
   - Optional fields excluded from `required` array
   - All fields still appear in `properties`

4. **Validation**:
   - Server only validates required fields
   - Optional fields can be omitted from arguments

## Changes Made

### Core Files
- `src/types.ts`: Added `optional: boolean` to `Placeholder` type
- `src/parser.ts`: 
  - Updated regex to capture `?` in placeholders
  - Modified frontmatter parser to detect `?` suffix
  - Updated JSON schema to exclude optional from required
  - Modified renderer to treat empty optional as null
- `src/server.ts`: 
  - Filter optional fields from validation
  - Mark optional in prompt arguments

### Test Infrastructure
- `tests/fixtures/templates.json`: Centralized test templates
- `tests/fixtures/loader.ts`: Template loading utility
- `tests/parser.test.ts`: 12 new tests for optional behavior
- `tests/server.test.ts`: 6 new server integration tests

## Test Coverage

- ✅ Parsing optional syntax (frontmatter & placeholder)
- ✅ Empty string as intentional null
- ✅ Omitted optional fields
- ✅ Mixed required/optional
- ✅ JSON schema generation
- ✅ Server validation
- ✅ Complex templates

All 86 tests passing.

