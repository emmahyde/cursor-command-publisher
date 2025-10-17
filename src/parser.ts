/**
 * @fileoverview Template Parser with YAML Frontmatter Support
 * Parses markdown templates to extract YAML frontmatter and #{name} placeholders.
 * Only placeholders defined in frontmatter are treated as variables.
 */

import YAML from 'yaml';
import type {
  ParsedTemplate,
  Placeholder,
  ASTNode,
  ConditionalBlock,
} from './types.js';

const PLACEHOLDER_PATTERN = /#\{(\?|\/)?([^}?]*?)(\?)?}/g;
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
 * Builds an AST from the template body, extracting placeholders and blocks defined in frontmatter
 */
const buildASTFromBody = (
  body: string,
  frontmatter: Record<string, { value: string; optional: boolean }>
): { ast: ASTNode[]; variables: Placeholder[] } => {
  type BlockContext = { variable?: string; content: ASTNode[] };

  const seenVariables = new Map<string, Placeholder>();
  const blockStack: BlockContext[] = [{ content: [] }];
  let lastIndex = 0;

  const placeholderMatches = Array.from(body.matchAll(PLACEHOLDER_PATTERN));

  // Process each match with handlers
  for (const match of placeholderMatches) {
    const matchStartIndex = match.index ?? 0;
    const matchEndIndex = matchStartIndex + match[0].length;
    const currentContext = blockStack[blockStack.length - 1];

    // Add preceding text
    const precedingText = body.slice(lastIndex, matchStartIndex);
    if (precedingText) {
      currentContext.content.push(precedingText);
    }

    const [fullMatch, prefix = '', name = '', suffix = ''] = match;
    const trimmedName = name.trim();

    // Handler for block start: #{?variable}
    const handleBlockStart = () => {
      if (!trimmedName) {
        currentContext.content.push(fullMatch);
        return;
      }

      if (!frontmatter[trimmedName]) {
        frontmatter[trimmedName] = {
          value: `Conditional block for ${trimmedName}`,
          optional: true,
        };
      }

      blockStack.push({ variable: trimmedName, content: [] });
    };

    // Handler for block end: #{/variable} or #{/}
    const handleBlockEnd = () => {
      if (blockStack.length <= 1) {
        currentContext.content.push(fullMatch);
        return;
      }

      const closedBlock = blockStack[blockStack.length - 1];
      const parentContext = blockStack[blockStack.length - 2];

      if (
        !closedBlock.variable ||
        (trimmedName && trimmedName !== closedBlock.variable)
      ) {
        closedBlock.content.push(fullMatch);
        return;
      }

      blockStack.pop();

      const block: ConditionalBlock = {
        type: 'block',
        variable: closedBlock.variable,
        content: closedBlock.content,
      };
      parentContext.content.push(block);

      // Track variable
      if (!seenVariables.has(closedBlock.variable)) {
        const placeholder: Placeholder = {
          type: 'placeholder',
          name: closedBlock.variable,
          description: frontmatter[closedBlock.variable]?.value,
          optional: true,
        };
        seenVariables.set(closedBlock.variable, placeholder);
      }
    };

    // Handler for regular placeholder: #{variable} or #{variable?}
    const handlePlaceholder = () => {
      const isOptional = !!suffix;
      const frontmatterEntry = frontmatter[trimmedName];

      if (!trimmedName || !frontmatterEntry) {
        currentContext.content.push(fullMatch);
        return;
      }

      const placeholder: Placeholder = {
        type: 'placeholder',
        name: trimmedName,
        description: frontmatterEntry.value,
        start: matchStartIndex,
        end: matchEndIndex,
        optional: isOptional || frontmatterEntry.optional,
      };

      currentContext.content.push(placeholder);

      if (!seenVariables.has(trimmedName)) {
        seenVariables.set(trimmedName, placeholder);
      }
    };

    // Route to appropriate handler
    if (prefix === '?') {
      handleBlockStart();
    } else if (prefix === '/') {
      handleBlockEnd();
    } else {
      handlePlaceholder();
    }

    lastIndex = matchEndIndex;
  }

  // Add remaining text
  const remainingText = body.slice(lastIndex);
  if (remainingText) {
    blockStack[blockStack.length - 1].content.push(remainingText);
  }

  // Handle unclosed blocks
  const unclosedCount = blockStack.length - 1;
  if (unclosedCount > 0) {
    console.warn(
      `Warning: ${unclosedCount} unclosed conditional block(s) detected`
    );
  }

  const ast =
    unclosedCount > 0
      ? [
          ...blockStack
            .slice(1)
            .reverse()
            .flatMap(block => [
              ...(block.variable ? [`#{?${block.variable}}`] : []),
              ...block.content,
            ]),
          ...blockStack[0].content,
        ]
      : blockStack[0].content;

  return {
    ast,
    variables: Array.from(seenVariables.values()),
  };
};

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
 * Conditional blocks are only rendered if their controlling variable has a non-empty value.
 * @param {ParsedTemplate} parsed - Parsed template with AST
 * @param {Record<string, string>} variables - Map of variable names to values
 * @returns {string} Rendered output with variables substituted
 */
const renderTemplate = (
  parsed: ParsedTemplate,
  variables: Record<string, string>
): string => {
  const renderNode = (node: ASTNode): string => {
    // Text node
    if (typeof node === 'string') {
      return node;
    }

    // Conditional block node
    if (node.type === 'block') {
      const controlValue = variables[node.variable];
      // Only render block if control variable has a non-empty value
      if (!controlValue || controlValue.trim() === '') {
        return '';
      }
      // Recursively render block content
      return node.content.map(renderNode).join('');
    }

    // Placeholder node
    const substitutedValue = variables[node.name];

    // For optional fields: empty string = intentionally null, render as empty
    if (node.optional && substitutedValue === '') {
      return '';
    }

    return substitutedValue ?? `#{${node.name}}`;
  };

  return parsed.ast.map(renderNode).join('');
};

export { parseTemplate, renderTemplate };
