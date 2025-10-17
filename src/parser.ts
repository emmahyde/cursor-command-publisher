/**
 * @fileoverview Template Parser with YAML Frontmatter Support
 * Parses markdown templates to extract YAML frontmatter and #{name} placeholders.
 * Only placeholders defined in frontmatter are treated as variables.
 */

import YAML from 'yaml';
import { ParsedTemplate, Placeholder } from './types.ts';

const PLACEHOLDER_PATTERN = /#\{([^}?]+)(\?)?}/g;
const FRONTMATTER_PATTERN = /^---\s*\n([\s\S]*?)\n---\s*\n([\s\S]*)$/;

/**
 * Parses a markdown template and extracts #{name} placeholders.
 * @param {string} content - Full markdown content with optional YAML frontmatter
 * @returns {ParsedTemplate} Parsed template with AST, variables list, and JSON schema
 * @throws {Error} If YAML parsing fails (gracefully falls back to empty frontmatter)
 */
const parseTemplate = (content: string): ParsedTemplate => {
  const { frontmatter, body } = extractFrontmatter(content);
  const { ast, variables } = buildASTFromBody(body, frontmatter);
  const inputSchema = buildJSONSchema(variables);

  return {
    ast,
    vars: variables,
    template: content,
    inputSchema,
  };
};

/**
 * Builds an AST from the template body, extracting placeholders defined in frontmatter
 */
const buildASTFromBody = (
  body: string,
  frontmatter: Record<string, { value: string; optional: boolean }>
): { ast: Array<string | Placeholder>; variables: Placeholder[] } => {
  const ast: Array<string | Placeholder> = [];
  const variables: Placeholder[] = [];
  const seenVariables = new Map<string, Placeholder>();

  const placeholderMatches = Array.from(body.matchAll(PLACEHOLDER_PATTERN));
  let lastProcessedIndex = 0;

  for (const match of placeholderMatches) {
    const matchStartIndex = match.index ?? 0;
    const matchEndIndex = matchStartIndex + match[0].length;

    // Add any text before this match
    if (matchStartIndex > lastProcessedIndex) {
      ast.push(body.slice(lastProcessedIndex, matchStartIndex));
    }

    // Process placeholder - only treat as variable if defined in frontmatter
    const placeholderName = (match[1] || '').trim();
    const isOptional = !!match[2]; // Captures the ? if present

    const frontmatterEntry = frontmatter[placeholderName];
    if (placeholderName && frontmatterEntry !== undefined) {
      const placeholder = createPlaceholder(
        placeholderName,
        matchStartIndex,
        matchEndIndex,
        frontmatterEntry.value,
        isOptional || frontmatterEntry.optional
      );

      ast.push(placeholder);

      // Track unique variables
      if (!seenVariables.has(placeholderName)) {
        seenVariables.set(placeholderName, placeholder);
        variables.push(placeholder);
      }
    } else {
      // Not in frontmatter or invalid - keep as literal text
      ast.push(match[0]);
    }

    lastProcessedIndex = matchEndIndex;
  }

  // Add any remaining text after the last match
  if (lastProcessedIndex < body.length) {
    ast.push(body.slice(lastProcessedIndex));
  }

  return { ast, variables };
};

/**
 * Creates a placeholder object with metadata
 */
const createPlaceholder = (
  name: string,
  startIndex: number,
  endIndex: number,
  description?: string,
  optional: boolean = false
): Placeholder => ({
  name,
  description,
  start: startIndex,
  end: endIndex,
  optional,
});

/**
 * Builds a JSON Schema from extracted variables
 */
const buildJSONSchema = (variables: Placeholder[]) => {
  const properties = variables.reduce(
    (acc, variable) => {
      // Use fallback if description is undefined or empty string
      const description = variable.description?.trim()
        ? variable.description
        : `Variable: ${variable.name}`;

      acc[variable.name] = {
        type: 'string',
        description,
      };
      return acc;
    },
    {} as Record<string, { type: 'string'; description: string }>
  );

  const required = variables
    .filter(variable => !variable.optional)
    .map(variable => variable.name);

  return {
    type: 'object' as const,
    properties,
    required,
  };
};

/**
 * Extracts YAML frontmatter from markdown content.
 * @param {string} content - Full markdown content
 * @returns {{ frontmatter: Record<string, { value: string; optional: boolean }>; body: string }} Parsed YAML and body content
 */
const extractFrontmatter = (
  content: string
): {
  frontmatter: Record<string, { value: string; optional: boolean }>;
  body: string;
} => {
  const match = content.match(FRONTMATTER_PATTERN);
  if (!match) return { frontmatter: {}, body: content };

  const [, yamlContent, bodyContent] = match;
  const frontmatter = parseYAMLSafely(yamlContent);

  return { frontmatter, body: bodyContent };
};

/**
 * Safely parses YAML content with error handling
 * Supports both `name: "value"` and `name?: "value"` syntax
 */
const parseYAMLSafely = (
  yamlContent: string
): Record<string, { value: string; optional: boolean }> => {
  try {
    const parsed = YAML.parse(yamlContent);

    if (!parsed || typeof parsed !== 'object') {
      return {};
    }

    // Convert all values to strings and detect optional fields (name?)
    const processedEntries = Object.entries(parsed)
      .filter(([key]) => typeof key === 'string')
      .map(([key, value]) => {
        const isOptional = key.endsWith('?');
        const cleanKey = isOptional ? key.slice(0, -1) : key;
        return [
          cleanKey,
          { value: String(value), optional: isOptional },
        ] as const;
      });

    return Object.fromEntries(processedEntries);
  } catch (error) {
    console.error('Failed to parse YAML frontmatter:', error);
    return {};
  }
};

/**
 * Substitutes variables in a parsed template AST to produce final output.
 * For optional fields with empty string values, treats them as intentionally null and removes the placeholder.
 * @param {ParsedTemplate} parsed - Parsed template with AST
 * @param {Record<string, string>} variables - Map of variable names to values
 * @returns {string} Rendered output with variables substituted
 */
const renderTemplate = (
  parsed: ParsedTemplate,
  variables: Record<string, string>
): string => {
  return parsed.ast
    .map(astNode => {
      if (typeof astNode === 'string') {
        return astNode;
      }

      // Placeholder node - substitute or keep original format
      const substitutedValue = variables[astNode.name];

      // For optional fields: empty string = intentionally null, render as empty
      if (astNode.optional && substitutedValue === '') {
        return '';
      }

      return substitutedValue ?? `#{${astNode.name}}`;
    })
    .join('');
};

export { parseTemplate, renderTemplate };
